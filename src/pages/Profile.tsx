// src/pages/Profile.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, invokeEdge, SUPABASE_URL } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { deleteOwnProfile, isUserProfileDeleted } from "@/lib/profileDelete";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import MySongsPanel from "@/components/MySongsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateMessagingPolicy,
  type MessagingPolicy,
  MESSAGING_POLICY_LABELS,
} from "@/lib/messages";

const AVAILABLE_PLANS = [
  { id: "creator-monthly", label: "Creator (monthly)" },
  { id: "creator-yearly", label: "Creator (yearly)" },
  // legacy Stripe price ids kept for compatibility
  { id: "price_1Ryom7PJqUWAU2UQBomcID8Y", label: "Creator (monthly)" },
  { id: "price_1RyoplPJqUWAU2UQMDe9JlEi", label: "Creator (yearly)" },
];

// ---------- helpers ----------
const slugRegex = /^[a-z0-9-]{3,30}$/;
const clamp = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n));

function normalizeLinks(arr: string[]): string[] {
  // Store as plain text (no enforced https), max 3, trim empties
  return arr.map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

function parseGenresCSV(csv: string): string[] {
  return csv
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Row shape loaded from public.profiles on the profile page. */
type ProfileRow = {
  display_name: string | null;
  website: string | null;
  bio: string | null;
  genres: string[] | null;
  role: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_current_period_end: string | null;
  artist_slug: string | null;
  profile_image_url: string | null;
  hero_image_url: string | null;
  additional_links: string[] | null;
  messaging_policy: string | null;
};

const PROFILE_SELECT =
  "display_name,website,bio,genres,role,subscription_status,subscription_plan,subscription_current_period_end,artist_slug,profile_image_url,hero_image_url,additional_links,messaging_policy" as const;

// Edge Function uploader – expects formData with (kind, file)
// returns { ok, publicUrl, path }
async function uploadArtistMedia(kind: "profile" | "hero", file: File): Promise<string> {
  const { data: s } = await supabase.auth.getSession();
  const token = s?.session?.access_token;
  if (!token) throw new Error("Not authenticated. Please log in again.");

  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file, file.name);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/artist-media-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Upload failed (${res.status}).`);
  }

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Upload failed (${res.status}).`);
  }

  const url: string = json.publicUrl || json.public_url || json.url || json.data?.publicUrl || "";
  if (!url) throw new Error("Upload succeeded but no URL returned.");
  return url;
}

// ---------- draft persistence (unsaved form state) ----------
const DRAFT_VERSION = 1 as const;
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const DRAFT_DEBOUNCE_MS = 250;

type ProfileDraftData = {
  slug: string;
  displayName: string;
  website: string;
  bio: string;
  genres: string;
  link1: string;
  link2: string;
  link3: string;

  venmoUsername: string;
  paypalEmail: string;
  cashappUsername: string;
  zelleEmail: string;
  customPaymentLink: string;
};

type DraftEnvelope = {
  v: typeof DRAFT_VERSION;
  updatedAt: number;
  data: ProfileDraftData;
};

function readDraft(key: string): DraftEnvelope | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope;
    if (!env || env.v !== DRAFT_VERSION || typeof env.updatedAt !== "number" || !env.data) return null;

    if (Date.now() - env.updatedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return env;
  } catch {
    return null;
  }
}

function writeDraft(key: string, data: ProfileDraftData) {
  try {
    const env: DraftEnvelope = { v: DRAFT_VERSION, updatedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // ignore quota / private mode issues
  }
}

const Profile: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // -------- left column (artist identity) --------
  const [slug, setSlug] = useState("");
  const [slugLocked, setSlugLocked] = useState(false);

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [link1, setLink1] = useState("");
  const [link2, setLink2] = useState("");
  const [link3, setLink3] = useState("");

  // Payment methods for tips
  const [venmoUsername, setVenmoUsername] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cashappUsername, setCashappUsername] = useState("");
  const [zelleEmail, setZelleEmail] = useState("");
  const [customPaymentLink, setCustomPaymentLink] = useState("");

  // -------- right column (profile + billing) --------
  const [displayName, setDisplayName] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [genres, setGenres] = useState(""); // csv text for UI
  const [role, setRole] = useState<string>("free");
  const [messagingPolicy, setMessagingPolicy] =
    useState<MessagingPolicy>("everyone");
  const [savingMessagingPolicy, setSavingMessagingPolicy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profileDeleted, setProfileDeleted] = useState(false);

  // billing
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState<string | null>(null);
  const [subEnd, setSubEnd] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("creator-monthly");

  const planLabel = useMemo(() => {
    switch (subPlan) {
      case "creator-monthly":
      case "price_1Ryom7PJqUWAU2UQBomcID8Y":
        return "Creator (monthly)";
      case "creator-yearly":
      case "price_1RyoplPJqUWAU2UQMDe9JlEi":
        return "Creator (yearly)";
      default:
        return subPlan || "-";
    }
  }, [subPlan]);

  // ---------- draft wiring ----------
  const draftKey = useMemo(() => {
    if (!user?.id) return null;
    return `airadio:profile:draft:${user.id}`;
  }, [user?.id]);

  const dirtyRef = useRef(false);
  const hasDraftRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const latestDraftRef = useRef<ProfileDraftData | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const buildDraftData = (): ProfileDraftData => ({
    slug,
    displayName,
    website,
    bio,
    genres,
    link1,
    link2,
    link3,
    venmoUsername,
    paypalEmail,
    cashappUsername,
    zelleEmail,
    customPaymentLink,
  });

  // keep latest snapshot in a ref so we can flush on unmount
  useEffect(() => {
    latestDraftRef.current = buildDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slug,
    displayName,
    website,
    bio,
    genres,
    link1,
    link2,
    link3,
    venmoUsername,
    paypalEmail,
    cashappUsername,
    zelleEmail,
    customPaymentLink,
  ]);

  const clearDraft = () => {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {}
    }
    dirtyRef.current = false;
    hasDraftRef.current = false;
    setDraftRestored(false);
    setDraftRestoredAt(null);
  };

  const flushDraftNow = () => {
    if (!draftKey) return;
    if (!dirtyRef.current) return;
    const data = latestDraftRef.current;
    if (!data) return;
    writeDraft(draftKey, data);
  };

  // Load draft (once per user)
  useEffect(() => {
    if (!draftKey) return;

    const env = readDraft(draftKey);
    if (!env) {
      hasDraftRef.current = false;
      setDraftRestored(false);
      setDraftRestoredAt(null);
      return;
    }

    hasDraftRef.current = true;
    dirtyRef.current = true; // treat restored draft as "unsaved changes exist"
    setDraftRestored(true);
    setDraftRestoredAt(env.updatedAt);

    // Apply draft to form fields
    const d = env.data;
    setSlug(d.slug || "");
    setDisplayName(d.displayName || "");
    setWebsite(d.website || "");
    setBio(clamp(d.bio || "", 500));
    setGenres(d.genres || "");
    setLink1(d.link1 || "");
    setLink2(d.link2 || "");
    setLink3(d.link3 || "");

    setVenmoUsername(d.venmoUsername || "");
    setPaypalEmail(d.paypalEmail || "");
    setCashappUsername(d.cashappUsername || "");
    setZelleEmail(d.zelleEmail || "");
    setCustomPaymentLink(d.customPaymentLink || "");
  }, [draftKey]);

  // Persist draft (debounced) after user edits
  useEffect(() => {
    if (!draftKey) return;
    if (!dirtyRef.current) return;

    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);

    persistTimerRef.current = window.setTimeout(() => {
      const data = latestDraftRef.current;
      if (data) writeDraft(draftKey, data);
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [
    draftKey,
    slug,
    displayName,
    website,
    bio,
    genres,
    link1,
    link2,
    link3,
    venmoUsername,
    paypalEmail,
    cashappUsername,
    zelleEmail,
    customPaymentLink,
  ]);

  // Flush on unmount / route change
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      flushDraftNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // ---------- load profile ----------
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const hasDraft = !!(draftKey && readDraft(draftKey));

        // Load profile data
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select(PROFILE_SELECT)
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (await isUserProfileDeleted(user)) {
          setProfileDeleted(true);
          await signOut();
          navigate("/", { replace: true });
          return;
        }

        const profile = profileData as ProfileRow | null;

        if (profile) {
          // Always update non-draft/system fields from DB
          setRole(profile.role ?? "free");
          setSubStatus(profile.subscription_status ?? null);
          setSubPlan(profile.subscription_plan ?? null);
          setSubEnd(profile.subscription_current_period_end ?? null);

          // Slug: if reserved in DB, it must win
          const dbSlug = profile.artist_slug ?? "";
          if (dbSlug) {
            setSlug(dbSlug);
            setSlugLocked(true);
          } else {
            setSlugLocked(false);
            if (!hasDraft) setSlug("");
          }

          setProfileImageUrl(profile.profile_image_url ?? null);
          setHeroImageUrl(profile.hero_image_url ?? null);

          const policy = profile.messaging_policy;
          if (
            policy === "everyone" ||
            policy === "followers_only" ||
            policy === "mutual_follow" ||
            policy === "nobody"
          ) {
            setMessagingPolicy(policy);
          } else {
            setMessagingPolicy("everyone");
          }

          // Only set editable form fields from DB if there is NO draft
          if (!hasDraft) {
            setDisplayName(profile.display_name ?? "");
            setWebsite(profile.website ?? "");
            setBio(clamp(profile.bio ?? "", 500));
            setGenres(Array.isArray(profile.genres) ? profile.genres.join(", ") : "");

            const links: string[] = Array.isArray(profile.additional_links)
              ? profile.additional_links
              : [];
            setLink1(links[0] || "");
            setLink2(links[1] || "");
            setLink3(links[2] || "");
          }
        }

        // Load payment methods (same rule: don’t overwrite if draft exists)
        const { data: paymentData } = await supabase
          .from("payment_methods")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (paymentData && !(draftKey && readDraft(draftKey))) {
          setVenmoUsername(paymentData.venmo_username ?? "");
          setPaypalEmail(paymentData.paypal_email ?? "");
          setCashappUsername(paymentData.cashapp_username ?? "");
          setZelleEmail(paymentData.zelle_email ?? "");
          setCustomPaymentLink(paymentData.custom_payment_link ?? "");
        }
      } catch (e: any) {
        console.error("loadProfile failed:", e);
        alert(e?.message || "Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, draftKey, signOut, navigate]);

  // ---------- actions ----------
  const publicArtistUrl = useMemo(() => {
    if (!slug) return "";
    try {
      return `${window.location.origin}/artist/${slug}`;
    } catch {
      return `/artist/${slug}`;
    }
  }, [slug]);

  const reserveSlug = async () => {
    if (!user) return;
    const candidate = slug.trim();
    if (!slugRegex.test(candidate)) {
      alert("Slug must be 3–30 chars, lowercase a–z, 0–9, or hyphen.");
      return;
    }
    if (slugLocked) return;

    try {
      const { count, error: cErr } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("artist_slug", candidate)
        .neq("id", user.id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        alert("This slug is already taken. Please choose another.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ artist_slug: candidate, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .is("artist_slug", null);

      if (error) throw error;

      setSlug(candidate);
      setSlugLocked(true);

      // slug is now saved in DB; draft can keep existing form edits, fine
      alert("Slug reserved.");
    } catch (e: any) {
      console.error("reserveSlug failed:", e);
      alert(e?.message || "Could not reserve slug.");
    }
  };

  const handleUpload = async (kind: "profile" | "hero") => {
    if (!user) return;

    const file = kind === "profile" ? profileImageFile : heroImageFile;
    if (!file) {
      alert("Please choose an image first.");
      return;
    }

    const ok = ["image/png", "image/jpeg", "image/webp"];
    if (!ok.includes(file.type)) {
      alert("Image must be PNG, JPG, or WEBP.");
      return;
    }

    try {
      const url = await uploadArtistMedia(kind, file);
      const column = kind === "profile" ? "profile_image_url" : "hero_image_url";

      const { error } = await supabase
        .from("profiles")
        .update({ [column]: url, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      if (kind === "profile") {
        setProfileImageUrl(url);
        setProfileImageFile(null);
      } else {
        setHeroImageUrl(url);
        setHeroImageFile(null);
      }
      alert("Image uploaded.");
    } catch (e: any) {
      console.error("upload failed:", e);
      alert(e?.message || "Upload failed.");
    }
  };

  const clearLocalFile = (kind: "profile" | "hero") => {
    if (kind === "profile") setProfileImageFile(null);
    else setHeroImageFile(null);
  };

  const handleDeleteProfile = async () => {
    if (!user || deleting) return;

    setDeleting(true);
    try {
      await deleteOwnProfile();
      clearDraft();
      await signOut();
      navigate("/", { replace: true });
    } catch (e: any) {
      console.error("deleteProfile failed:", e);
      alert(e?.message || "Could not delete profile. Please try again or contact support.");
    } finally {
      setDeleting(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const genresArr = parseGenresCSV(genres);
      const links = normalizeLinks([link1, link2, link3]);

      const payload: any = {
        id: user.id,
        display_name: displayName.trim(),
        website: website.trim(),
        bio: clamp(bio.trim(), 500),
        genres: genresArr,
        additional_links: links,
        role: role === "admin" ? "free" : role,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "id",
      });
      if (error) throw error;

      const paymentPayload = {
        user_id: user.id,
        venmo_username: venmoUsername.trim() || null,
        paypal_email: paypalEmail.trim() || null,
        cashapp_username: cashappUsername.trim() || null,
        zelle_email: zelleEmail.trim() || null,
        custom_payment_link: customPaymentLink.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: paymentError } = await supabase.from("payment_methods").upsert(paymentPayload, {
        onConflict: "user_id",
      });

      if (paymentError) throw paymentError;

      // Saved successfully — clear local draft
      clearDraft();

      alert("Profile saved.");
    } catch (e: any) {
      console.error("saveProfile failed:", e);
      alert(e?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Billing helpers (unchanged) ----
  const onCancelAtPeriodEnd = async () => {
    if (!user) return;
    if (!window.confirm("Cancel at period end?")) return;

    try {
      setCancelBusy(true);
      const out: any = await invokeEdge("stripe-cancel", {
        cancel_at_period_end: true,
      });
      if (!out?.ok) throw new Error(out?.message || "Cancel failed");
      setSubStatus("canceled");
      setRole("free");
      if (out?.stripe?.current_period_end) {
        setSubEnd(new Date(out.stripe.current_period_end * 1000).toISOString());
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Could not cancel at period end.");
    } finally {
      setCancelBusy(false);
    }
  };

  const onCancelNow = async () => {
    if (!user) return;
    if (!window.confirm("Cancel immediately?")) return;

    try {
      setCancelBusy(true);
      const out: any = await invokeEdge("stripe-cancel", { cancel_now: true });
      if (!out?.ok) throw new Error(out?.message || "Cancel failed");
      setSubStatus("canceled");
      setRole("free");
      setSubEnd(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Could not cancel now.");
    } finally {
      setCancelBusy(false);
    }
  };

  const onOpenBillingPortal = async () => {
    try {
      setBillingBusy(true);
      const out: any = await invokeEdge("stripe-portal", {});
      if (!out?.ok || !out?.url) throw new Error(out?.message || "Could not open billing portal");
      window.location.href = out.url;
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Could not open billing portal.");
    } finally {
      setBillingBusy(false);
    }
  };

  const onChangePlan = async () => {
    try {
      setChangingPlan(true);
      const payload: Record<string, any> = { action: "change_plan" };
      if (selectedPlan.startsWith("price_")) payload.price_id = selectedPlan;
      if (selectedPlan.startsWith("creator-")) payload.plan_code = selectedPlan;

      const out: any = await invokeEdge("stripe-subscription", payload);
      if (!out?.ok) throw new Error(out?.message || "Could not change plan");

      const newPlan = selectedPlan || out.stripe?.items?.data?.[0]?.price?.id || subPlan;

      setSubStatus(out.stripe?.status ?? "active");
      setSubPlan(newPlan || null);
      setRole("paid");
      if (out?.stripe?.current_period_end) {
        setSubEnd(new Date(out.stripe.current_period_end * 1000).toISOString());
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Could not change plan.");
    } finally {
      setChangingPlan(false);
    }
  };

  const onResume = async () => {
    try {
      setBillingBusy(true);
      const out: any = await invokeEdge("stripe-subscription", { action: "resume" });

      if (!out?.ok) {
        if (out?.require_checkout) {
          alert("This subscription was canceled in Stripe. Please purchase again from Pricing.");
          navigate("/pricing");
          return;
        }
        throw new Error(out?.message || "Could not resume subscription");
      }

      setSubStatus(out.stripe?.status ?? "active");
      setRole("paid");
      if (out?.stripe?.items?.data?.[0]?.price?.id) {
        setSubPlan(out.stripe.items.data[0].price.id);
      }
      if (out?.stripe?.current_period_end) {
        setSubEnd(new Date(out.stripe.current_period_end * 1000).toISOString());
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Could not resume subscription.");
    } finally {
      setBillingBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p>You must be logged in to view your profile.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Home
          </Button>
        </div>

        {/* FIX: prevent long emails from forcing horizontal scroll */}
        <div className="text-xs text-muted-foreground break-all text-right min-w-0 max-w-[55%] sm:max-w-none">
          Logged in as {user.email}
        </div>
      </div>

      <h1 className="text-2xl font-bold">My Profile</h1>

      {draftRestored && (
        <Card className="p-3">
          <p className="text-sm">
            Unsaved changes restored from this device
            {draftRestoredAt ? ` (last edit: ${new Date(draftRestoredAt).toLocaleString()})` : ""}. Don’t forget to
            hit <strong>Save</strong>.
          </p>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={clearDraft}>
              Discard local draft
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Artist Identity */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Artist Identity</h2>

          {/* Slug */}
          <div>
            <label className="block text-sm mb-1">Artist Brand Url</label>

            <div className="flex gap-2">
              <Input
                value={slug}
                disabled={slugLocked || loading}
                onChange={(e) => {
                  markDirty();
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="your-handle"
              />
              <Button
                onClick={reserveSlug}
                disabled={slugLocked || !slugRegex.test(slug)}
                className={slugLocked ? "bg-emerald-600 hover:bg-emerald-600" : undefined}
              >
                {slugLocked ? "Reserved" : "Reserve"}
              </Button>
            </div>

            {/* FIX: long public URL wraps on mobile */}
            <div className="text-xs mt-2 min-w-0">
              <span className="mr-1">Public page:</span>
              {slug ? (
                <a
                  className="underline text-primary break-all whitespace-normal block max-w-full"
                  href={publicArtistUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publicArtistUrl}
                </a>
              ) : (
                <span className="opacity-70">—</span>
              )}
            </div>
          </div>

          {/* Profile image */}
          <div>
            <label className="block text-sm mb-1">
              Profile image (square) <span className="text-xs">Recommended 1:1</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
              />
              <Button variant="secondary" onClick={() => handleUpload("profile")} disabled={!profileImageFile}>
                Upload
              </Button>
              <Button variant="outline" onClick={() => clearLocalFile("profile")}>
                Clear
              </Button>
            </div>

            {/* FIX: long storage URL wraps on mobile */}
            {profileImageUrl && (
              <div className="mt-2 text-xs min-w-0">
                <span className="mr-1">Current:</span>
                <a
                  className="underline text-primary break-all whitespace-normal block max-w-full"
                  href={profileImageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {profileImageUrl}
                </a>
              </div>
            )}
          </div>

          {/* Hero image */}
          <div>
            <label className="block text-sm mb-1">
              Hero image (wide banner) <span className="text-xs">Recommended 3:1</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setHeroImageFile(e.target.files?.[0] || null)}
              />
              <Button variant="secondary" onClick={() => handleUpload("hero")} disabled={!heroImageFile}>
                Upload
              </Button>
              <Button variant="outline" onClick={() => clearLocalFile("hero")}>
                Clear
              </Button>
            </div>

            {/* FIX: long storage URL wraps on mobile */}
            {heroImageUrl && (
              <div className="mt-2 text-xs min-w-0">
                <span className="mr-1">Current:</span>
                <a
                  className="underline text-primary break-all whitespace-normal block max-w-full"
                  href={heroImageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {heroImageUrl}
                </a>
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <label className="block text-sm mb-1">Additional links (max 3)</label>
            <Input
              placeholder="youtube.com/yourchannel"
              value={link1}
              onChange={(e) => {
                markDirty();
                setLink1(e.target.value);
              }}
              className="mb-2"
            />
            <Input
              placeholder="example.com/page"
              value={link2}
              onChange={(e) => {
                markDirty();
                setLink2(e.target.value);
              }}
              className="mb-2"
            />
            <Input
              placeholder="example.com/page"
              value={link3}
              onChange={(e) => {
                markDirty();
                setLink3(e.target.value);
              }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">No need to include https:// — plain text is fine.</p>
          </div>
        </Card>

        {/* RIGHT: Profile details */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Profile</h2>

          <div>
            <label className="block text-sm mb-1">Artist Name</label>
            <Input
              value={displayName}
              onChange={(e) => {
                markDirty();
                setDisplayName(e.target.value);
              }}
              placeholder="e.g. RoundTheGlobe"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Website / Brand URL</label>
            <Input
              value={website}
              onChange={(e) => {
                markDirty();
                setWebsite(e.target.value);
              }}
              placeholder="https://example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Bio</label>
            <Textarea
              value={bio}
              onChange={(e) => {
                markDirty();
                setBio(clamp(e.target.value, 500));
              }}
              placeholder="Tell listeners about yourself..."
              disabled={loading}
            />
            <div className="text-[11px] text-muted-foreground text-right">{bio.length}/500</div>
          </div>

          <div>
            <label className="block text-sm mb-1">
              Favorite genres <span className="text-xs">(comma separated)</span>
            </label>
            <Input
              value={genres}
              onChange={(e) => {
                markDirty();
                setGenres(e.target.value);
              }}
              placeholder="Afrobeat, Rock"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Who can message you</label>
            <Select
              value={messagingPolicy}
              disabled={loading || savingMessagingPolicy}
              onValueChange={(v) => {
                const policy = v as MessagingPolicy;
                setMessagingPolicy(policy);
                setSavingMessagingPolicy(true);
                void updateMessagingPolicy(policy)
                  .then(() => {
                    // saved
                  })
                  .catch((err: unknown) => {
                    alert(
                      err instanceof Error
                        ? err.message
                        : "Could not update messaging settings"
                    );
                  })
                  .finally(() => setSavingMessagingPolicy(false));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MESSAGING_POLICY_LABELS) as MessagingPolicy[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {MESSAGING_POLICY_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Controls who can start new conversations with you. Existing chats
              are not affected.
            </p>
          </div>

          <div>
            <label className="block text-sm mb-1">Current role</label>
            <Input value={role} readOnly className="bg-muted" />
            <p className="text-[10px] text-muted-foreground">This is controlled by billing / admin / Stripe.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={() => {
                flushDraftNow();
                saveProfile();
              }}
              disabled={saving || deleting || profileDeleted}
            >
              {saving ? "Saving..." : "Save"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={saving || deleting || profileDeleted || loading}
                >
                  {deleting ? "Deleting..." : "Delete Profile"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will set your account status to <strong>Deleted</strong>. Your profile, artist
                    page, and related information will no longer be accessible. This action cannot be
                    undone from the app.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleting}
                    onClick={(e) => {
                      e.preventDefault();
                      void handleDeleteProfile();
                    }}
                  >
                    {deleting ? "Deleting..." : "Yes, delete my profile"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      </div>

      {/* Payment Methods for Tips */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Payment Methods for Tips & Donations</h2>
        <p className="text-sm text-muted-foreground">Add your payment details so fans can send you tips and donations.</p>

        <div>
          <label className="block text-sm mb-1">Venmo Payment Link</label>
          <Input
            value={venmoUsername}
            onChange={(e) => {
              markDirty();
              setVenmoUsername(e.target.value);
            }}
            placeholder="@Michael-Rutter-14"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">PayPal Email</label>
          <Input
            value={paypalEmail}
            onChange={(e) => {
              markDirty();
              setPaypalEmail(e.target.value);
            }}
            placeholder="michaelrutter270"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Cash App Link</label>
          <Input
            value={cashappUsername}
            onChange={(e) => {
              markDirty();
              setCashappUsername(e.target.value);
            }}
            placeholder="$yourusername"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Zelle Email or Phone</label>
          <Input
            value={zelleEmail}
            onChange={(e) => {
              markDirty();
              setZelleEmail(e.target.value);
            }}
            placeholder="your@email.com or phone number"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Custom Payment Link</label>
          <Input
            value={customPaymentLink}
            onChange={(e) => {
              markDirty();
              setCustomPaymentLink(e.target.value);
            }}
            placeholder="https://your-payment-link.com"
            disabled={loading}
          />
        </div>

        <Button
          onClick={() => {
            flushDraftNow();
            saveProfile();
          }}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Payment Methods"}
        </Button>

        <div className="pt-4 border-t">
          <Button
            onClick={() => window.location.href = 'https://aimusicradio.io/pricing'}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold"
          >
            Upgrade
          </Button>
        </div>
      </Card>


      {/* My Songs (list + editor) */}
      <MySongsPanel />

      {/* Subscription section hidden */}

    </div>
  );
};

export default Profile;
