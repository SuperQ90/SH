// src/pages/Playlists.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Globe,
  ArrowRight,
  ListMusic,
  Info,
  Eye,
  Home,
} from "lucide-react";

type PlaylistRow = {
  id: string;
  name: string;
  user_id: string;
  is_public: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

// NEW: limits + admin rules
const FREE_PLAYLIST_LIMIT = 3;
const LEGACY_ADMIN_EMAIL = "mrutter@gmail.com";
const ADMIN_DOMAIN = "@pledge.ai";

export default function PlaylistsPage() {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [busy, setBusy] = useState(false);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPublic, setCreatePublic] = useState(false);

  // rename modal
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  // delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isOwner = (p: PlaylistRow) => !!userId && p.user_id === userId;

  // ---------------- data loaders ----------------
  const loadUser = async () => {
    const { data } = await supabase.auth.getUser();
    const authUser = data.user;
    const uid = authUser?.id ?? null;
    const email = authUser?.email ?? null;

    setUserId(uid);
    setUserEmail(email);

    if (!uid) {
      // anon → no profile, treat as old-style
      setSubscriptionStatus(null);
      setProfileRole(null);
      return;
    }

    // important: our /profile upsert uses BOTH id and user_id
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("subscription_status, role")
      .or(`id.eq.${uid},user_id.eq.${uid}`)
      .maybeSingle();

    if (!profErr && prof) {
      setSubscriptionStatus(prof.subscription_status ?? null);
      setProfileRole(prof.role ?? null);
    } else {
      // no profile yet → grandfather
      setSubscriptionStatus(null);
      setProfileRole(null);
    }
  };

  const loadPlaylists = async () => {
    try {
      let query = supabase
        .from("playlists")
        .select("id, name, user_id, is_public, created_at, updated_at");

      if (userId) {
        query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
      } else {
        query = query.eq("is_public", true);
      }

      const { data, error } = await query
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // de-dupe if an owned playlist is also public
      const seen = new Set<string>();
      const list: PlaylistRow[] = [];
      (data ?? []).forEach((row: any) => {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          list.push(row as PlaylistRow);
        }
      });
      setPlaylists(list);
    } catch (e: any) {
      toast({
        title: "Failed to load playlists",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    (async () => {
      await loadUser();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await loadPlaylists();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------------- actions ----------------
  const onCreate = async () => {
    if (!userId) {
      toast({ title: "Please sign in to create playlists" });
      return;
    }
    if (!createName.trim()) {
      toast({ title: "Enter a playlist name" });
      return;
    }

    // derive flags
    const isAdmin =
      (userEmail && userEmail === LEGACY_ADMIN_EMAIL) ||
      (userEmail && userEmail.toLowerCase().endsWith(ADMIN_DOMAIN)) ||
      profileRole === "admin";

    const isPremium = subscriptionStatus === "active" || isAdmin || profileRole === "admin";

    // THIS is the “existing users can stay on free plan” rule:
    // if there's no subscription_status in profile, we don't block.
    const isGrandfathered = subscriptionStatus === null;

    if (!isPremium && !isGrandfathered) {
      // enforce the limit
      const { count, error: countErr } = await supabase
        .from("playlists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (!countErr && typeof count === "number" && count >= FREE_PLAYLIST_LIMIT) {
        toast({
          title: "Upgrade to create more playlists",
          description: `Free plan allows up to ${FREE_PLAYLIST_LIMIT} playlists. Premium unlocks unlimited.`,
        });
        return;
      }
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("playlists").insert({
        name: createName.trim(),
        is_public: createPublic,
        user_id: userId,
      });
      if (error) throw error;
      toast({ title: "Playlist created" });
      setCreateOpen(false);
      setCreateName("");
      setCreatePublic(false);
      await loadPlaylists();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openRename = (p: PlaylistRow) => {
    setRenameId(p.id);
    setRenameName(p.name);
    setRenameOpen(true);
  };

  const onRename = async () => {
    if (!renameId) return;
    if (!renameName.trim()) {
      toast({ title: "Enter a playlist name" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ name: renameName.trim(), updated_at: new Date().toISOString() })
        .eq("id", renameId);
      if (error) throw error;
      toast({ title: "Renamed" });
      setRenameOpen(false);
      await loadPlaylists();
    } catch (e: any) {
      toast({ title: "Rename failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openDelete = (p: PlaylistRow) => {
    setDeleteId(p.id);
    setConfirmOpen(true);
  };

  const onDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await supabase.from("playlist_songs").delete().eq("playlist_id", deleteId);
      const { error } = await supabase.from("playlists").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Playlist deleted" });
      setConfirmOpen(false);
      await loadPlaylists();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ---------------- render ----------------
  return (
    <div className="relative min-h-screen -mx-4 px-2 sm:mx-0 sm:px-0 overflow-hidden">
      {/* Background like Home tab */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900/60 to-black" />
      <div className="absolute top-0 left-1/3 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-16 right-1/4 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-24 left-1/5 w-56 h-56 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl mx-auto p-3 sm:p-6">
        {/* Header strip to echo Home look */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/40">
              <ListMusic className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Playlists</h1>
              <p className="text-xs text-cyan-400/90">Create • Organize • Share</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="border-cyan-400/40">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={busy}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Playlist
            </Button>
          </div>
        </div>

        {/* Onboarding / explainer card to match Home tab vibe */}
        <Card className="mb-4 border-cyan-400/20 bg-black/50">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-cyan-300" />
              <h2 className="font-semibold">How to Add Songs to Playlists</h2>
            </div>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>
                • Browse songs in the <span className="text-cyan-300">All Songs</span> or{" "}
                <span className="text-cyan-300">Top 20 By Genre</span> tabs.
              </li>
              <li>
                • Click the <span className="text-cyan-300">“+”</span> button next to a song to
                add it to a playlist.
              </li>
              <li>• Select an existing playlist or create a new one.</li>
              <li>
                • Each playlist can hold up to <span className="text-cyan-300">30 songs</span>.
              </li>
              <li>
                • You can delete and recreate playlists anytime to manage your collection.
              </li>
            </ul>
          </div>
        </Card>

        {/* Playlists grid */}
        {playlists.length === 0 ? (
          <Card className="p-6 bg-black/50 border-cyan-400/20">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 opacity-70" />
              <div className="text-sm opacity-80">
                No playlists yet. Click{" "}
                <span className="text-cyan-300 font-medium">Create Playlist</span> to start.
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {playlists.map((p) => {
              const owner = isOwner(p);
              return (
                <Card
                  key={p.id}
                  className="p-4 bg-white/5 border-white/10 hover:border-cyan-400/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.is_public ? (
                        <Globe className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <Lock className="h-4 w-4 text-amber-300" />
                      )}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs opacity-70">
                          {p.is_public ? "Public" : "Private"} {owner ? "• You own this" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/playlist/${p.id}`}>
                        <Button variant="outline" size="sm" className="border-cyan-400/40">
                          Open <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      {owner && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openRename(p)}
                            disabled={busy}
                            title="Rename"
                            className="border-cyan-400/40"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => openDelete(p)}
                            disabled={busy}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        <Dialog open={createOpen} onOpenChange={(v) => setCreateOpen(v)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Playlist name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createPublic}
                  onChange={(e) => setCreatePublic(e.target.checked)}
                />
                Make public
              </label>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onCreate} disabled={busy}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename modal */}
        <Dialog open={renameOpen} onOpenChange={(v) => setRenameOpen(v)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="New name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onRename} disabled={busy}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={confirmOpen} onOpenChange={(v) => setConfirmOpen(v)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete playlist?</DialogTitle>
            </DialogHeader>
            <div className="text-sm opacity-80">
              This cannot be undone. Songs stay in the library; only the playlist is removed.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={busy}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
