// src/pages/AdminDashboard.tsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  RefreshCw,
  AlertTriangle,
  Music,
  Users,
  Star,
  CreditCard,
  ShieldAlert,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type SongRow = {
  id: string;
  title: string | null;
  artist: string | null;
  genre: string | null;
  user_id: string | null;
  created_at: string | null;
  play_count?: number | null;
  brand_url?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  bio: string | null;
  website: string | null;
  role: string | null;
  subscription_status?: string | null;
  created_at: string | null;
};

type PlayRow = {
  id: string;
  song_id: string;
  user_id: string | null;
  created_at: string | null;
  listen_duration?: number | null;
};

type PaymentRow = {
  id?: string;
  stripe_session_id: string | null;
  amount: number | null;
  currency: string | null;
  customer_email: string | null;
  payment_status: string | null;
  metadata: any | null;
  created_at?: string | null;
};

const AdminDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"songs" | "profiles" | "plays" | "payments">("songs");

  const [songs, setSongs] = useState<SongRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [plays, setPlays] = useState<PlayRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [songFilter, setSongFilter] = useState("");

  // top metrics
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalSongs, setTotalSongs] = useState<number | null>(null);
  const [totalFeatured, setTotalFeatured] = useState<number | null>(null);
  const [activeSubs, setActiveSubs] = useState<number | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"song" | "profile" | null>(null);

  // 0) ADMIN GUARD
  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_admin", {
        p_user_id: user.id,
      });
      if (error) {
        console.error("is_admin error", error);
        setAdminCheckError(error.message);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean(data));
    };
    void run();
  }, [authLoading, user]);

  // ---------- FETCHERS (only for admins) ----------
  const fetchSongs = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, artist, genre, user_id, created_at, play_count, brand_url")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setSongs(data as SongRow[]);
    setLoading(false);
  }, [isAdmin]);

  const fetchProfiles = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, bio, website, role, subscription_status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setProfiles(data as ProfileRow[]);
    setLoading(false);
  }, [isAdmin]);

  const fetchPlays = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("song_plays")
      .select("id, song_id, user_id, created_at, listen_duration")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setPlays(data as PlayRow[]);
    setLoading(false);
  }, [isAdmin]);

  const fetchPayments = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, stripe_session_id, amount, currency, customer_email, payment_status, metadata, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setPayments(data as PaymentRow[]);
    } else {
      // RLS probably blocked
      setPayments([]);
    }
  }, [isAdmin]);

  const fetchMetrics = useCallback(async () => {
    if (!isAdmin) return;
    const [profilesCount, songsCount, featuredCount, activeSubsCount] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("songs").select("id", { count: "exact", head: true }),
      supabase.from("featured_songs").select("song_id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("subscription_status", "active"),
    ]);

    setTotalUsers(profilesCount.count ?? 0);
    setTotalSongs(songsCount.count ?? 0);
    setTotalFeatured(featuredCount.count ?? 0);
    setActiveSubs(activeSubsCount.count ?? 0);
  }, [isAdmin]);

  // initial load (only if admin)
  useEffect(() => {
    if (isAdmin) {
      void fetchMetrics();
      void fetchSongs();
      void fetchPayments();
    }
  }, [isAdmin, fetchMetrics, fetchSongs, fetchPayments]);

  // when switching tabs, load relevant data
  const handleTabChange = (tab: "songs" | "profiles" | "plays" | "payments") => {
    setActiveTab(tab);
    if (!isAdmin) return;
    if (tab === "songs") void fetchSongs();
    if (tab === "profiles") void fetchProfiles();
    if (tab === "plays") void fetchPlays();
    if (tab === "payments") void fetchPayments();
  };

  // safer delete: try RPC first, then fallback
  const handleDelete = async () => {
    if (!deleteId || !deleteType) return;
    if (!isAdmin) return;

    try {
      if (deleteType === "song") {
        // try RPC
        const { error: rpcErr } = await supabase.rpc("admin_delete_song", {
          p_song_id: deleteId,
        });
        if (rpcErr) {
          // fallback to direct delete (you have RLS anyway)
          await supabase.from("songs").delete().eq("id", deleteId);
        }
        void fetchSongs();
      } else if (deleteType === "profile") {
        const { error: rpcErr } = await supabase.rpc("admin_delete_profile", {
          p_profile_id: deleteId,
        });
        if (rpcErr) {
          await supabase.from("profiles").delete().eq("id", deleteId);
        }
        void fetchProfiles();
      }
      toast({
        title: "Deleted",
        description: `The ${deleteType} was deleted.`,
      });
    } catch (err: any) {
      console.error("admin delete error", err);
      toast({
        title: "Delete failed",
        description: err.message ?? "Check RLS / policies.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
      setDeleteType(null);
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      !songFilter ||
      s.title?.toLowerCase().includes(songFilter.toLowerCase()) ||
      s.artist?.toLowerCase().includes(songFilter.toLowerCase())
  );

  // detect “Stripe wired but no payments” situation
  const noPayments = payments.length === 0;

  // AUTH / ADMIN STATES
  if (authLoading || isAdmin === null) {
    return (
      <div className="p-6 text-sm text-muted-foreground flex gap-2 items-center">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Checking admin access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6 border-red-500/40 bg-red-500/5 flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-red-400 mt-1" />
          <div>
            <p className="font-semibold text-red-100">Not authorized</p>
            <p className="text-sm text-red-50/80">
              You’re signed in but not an admin for this project. Ask the owner to add you in
              Supabase (profiles.role = 'admin' or use the allowed domain).
            </p>
            {adminCheckError ? (
              <p className="text-xs mt-2 text-red-200/80">
                Admin check error: {adminCheckError}
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => void fetchMetrics()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh metrics
        </Button>
      </div>

      {/* warnings */}
      {noPayments && (
        <Card className="border-amber-500/60 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-1 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-100">
              Stripe is configured but there are no payments yet.
            </p>
            <p className="text-sm text-amber-50/80">
              If you just tested Stripe on localhost or via the vibe builder, make sure the webhook
              is actually hitting Supabase and inserting into <code>public.payments</code>.
            </p>
          </div>
        </Card>
      )}

      {/* metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded bg-slate-900/40">
            <Users className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Users</p>
            <p className="text-2xl font-semibold">{totalUsers ?? "—"}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded bg-slate-900/40">
            <Music className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Songs</p>
            <p className="text-2xl font-semibold">{totalSongs ?? "—"}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded bg-slate-900/40">
            <Star className="w-5 h-5 text-yellow-300" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Featured</p>
            <p className="text-2xl font-semibold">{totalFeatured ?? "—"}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded bg-slate-900/40">
            <CreditCard className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Active Subs</p>
            <p className="text-2xl font-semibold">{activeSubs ?? "0"}</p>
          </div>
        </Card>
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "songs" ? "default" : "outline"}
          onClick={() => handleTabChange("songs")}
        >
          Songs ({songs.length})
        </Button>
        <Button
          variant={activeTab === "profiles" ? "default" : "outline"}
          onClick={() => handleTabChange("profiles")}
        >
          Profiles
        </Button>
        <Button
          variant={activeTab === "plays" ? "default" : "outline"}
          onClick={() => handleTabChange("plays")}
        >
          Plays
        </Button>
        <Button
          variant={activeTab === "payments" ? "default" : "outline"}
          onClick={() => handleTabChange("payments")}
        >
          Payments
        </Button>
      </div>

      {/* SONGS TAB */}
      {activeTab === "songs" && (
        <Card className="p-4">
          <div className="flex justify-between mb-4">
            <Input
              placeholder="Filter songs..."
              value={songFilter}
              onChange={(e) => setSongFilter(e.target.value)}
              className="w-64"
            />
            <Button onClick={() => void fetchSongs()} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Artist</th>
                  <th className="text-left p-2">Genre</th>
                  <th className="text-left p-2">Plays</th>
                  <th className="text-left p-2">Date</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSongs.map((song) => (
                  <tr
                    key={song.id}
                    className="border-b border-slate-800/60 hover:bg-slate-900/30"
                  >
                    <td className="p-2">{song.title || "Untitled"}</td>
                    <td className="p-2">{song.artist || "Unknown"}</td>
                    <td className="p-2">{song.genre || "-"}</td>
                    <td className="p-2">{song.play_count || 0}</td>
                    <td className="p-2">
                      {song.created_at ? new Date(song.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeleteId(song.id);
                          setDeleteType("song");
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <p className="text-slate-400 text-sm mt-3">Loading songs…</p>}
        </Card>
      )}

      {/* PROFILES TAB */}
      {activeTab === "profiles" && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-left p-2">Sub</th>
                  <th className="text-left p-2">Joined</th>
                  <th className="text-left p-2"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-slate-800/60">
                    <td className="p-2">{profile.display_name || "Anonymous"}</td>
                    <td className="p-2">{profile.role || "user"}</td>
                    <td className="p-2">{profile.subscription_status || "—"}</td>
                    <td className="p-2">
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeleteId(profile.id);
                          setDeleteType("profile");
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <p className="text-slate-400 text-sm mt-3">Loading profiles…</p>}
        </Card>
      )}

      {/* PLAYS TAB */}
      {activeTab === "plays" && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-2">Song ID</th>
                  <th className="text-left p-2">Duration</th>
                  <th className="text-left p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {plays.map((play) => (
                  <tr key={play.id} className="border-b border-slate-800/60">
                    <td className="p-2 font-mono text-xs">
                      {play.song_id ? `${play.song_id.slice(0, 8)}...` : "—"}
                    </td>
                    <td className="p-2">{play.listen_duration || 0}s</td>
                    <td className="p-2">
                      {play.created_at ? new Date(play.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <p className="text-slate-400 text-sm mt-3">Loading plays…</p>}
        </Card>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === "payments" && (
        <Card className="p-4">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Payments</h2>
            <Button onClick={() => void fetchPayments()} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-2">Customer</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Currency</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Session</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-3 text-slate-500 text-center">
                      No payments found or RLS blocked access.
                    </td>
                  </tr>
                )}
                {payments.map((p) => (
                  <tr
                    key={p.id ?? p.stripe_session_id ?? Math.random().toString()}
                    className="border-b border-slate-800/60"
                  >
                    <td className="p-2">{p.customer_email || "—"}</td>
                    <td className="p-2">
                      {typeof p.amount === "number" ? (p.amount / 100).toFixed(2) : "—"}
                    </td>
                    <td className="p-2 uppercase">{p.currency || "—"}</td>
                    <td className="p-2">
                      <span
                        className={
                          p.payment_status === "completed"
                            ? "text-emerald-400"
                            : "text-slate-200"
                        }
                      >
                        {p.payment_status || "—"}
                      </span>
                    </td>
                    <td className="p-2">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {p.stripe_session_id ? p.stripe_session_id.slice(0, 10) + "..." : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Delete this {deleteType}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
