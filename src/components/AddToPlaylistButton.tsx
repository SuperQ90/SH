import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ListMusic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  songId: string;
  songTitle: string;
};

type Playlist = {
  id: string;
  name: string;
  song_count: number;
};

function AddToPlaylistButton({ songId, songTitle }: Props) {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // ---- helpers -------------------------------------------------------------

  const ensureAuthed = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      toast({ title: "Please sign in to use playlists" });
      // Keep UX simple: send them to the landing page where auth lives
      window.location.href = "/";
      return null;
    }
    return data.user.id as string;
  };

  const loadPlaylists = async (uid: string) => {
    setLoading(true);
    try {
      // get user's playlists
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      // attach counts and filter to <30
      const withCounts: Playlist[] = [];
      for (const p of data ?? []) {
        const { count, error: cntErr } = await supabase
          .from("playlist_songs")
          .select("*", { count: "exact", head: true })
          .eq("playlist_id", p.id);
        if (cntErr) throw cntErr;
        withCounts.push({ id: p.id, name: p.name, song_count: count ?? 0 });
      }
      setPlaylists(withCounts.filter((p) => p.song_count < 30));
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to load playlists", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = async () => {
    const uid = await ensureAuthed();
    if (!uid) return; // redirected
    await loadPlaylists(uid);
    setOpen(true);
  };

  const addToPlaylist = async (playlistId: string) => {
    setLoading(true);
    try {
      // prevent duplicates
      const { count: dupCount, error: dupErr } = await supabase
        .from("playlist_songs")
        .select("*", { count: "exact", head: true })
        .eq("playlist_id", playlistId)
        .eq("song_id", songId);
      if (dupErr) throw dupErr;
      if ((dupCount ?? 0) > 0) {
        toast({ title: "Already in this playlist" });
        return;
      }

      // find next position = current count + 1
      const { count, error: cntErr } = await supabase
        .from("playlist_songs")
        .select("*", { count: "exact", head: true })
        .eq("playlist_id", playlistId);
      if (cntErr) throw cntErr;
      const nextPos = (count ?? 0) + 1;

      const { error: insErr } = await supabase
        .from("playlist_songs")
        .insert({ playlist_id: playlistId, song_id: songId, position: nextPos });
      if (insErr) throw insErr;

      toast({ title: "Added to playlist", description: `"${songTitle}" added.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Add failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // keep list fresh when dialog re-opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await loadPlaylists(data.user.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---- render --------------------------------------------------------------

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <Plus className="h-4 w-4 mr-2" />
        Add to playlist
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to playlist</DialogTitle>
          </DialogHeader>

        <div className="space-y-2">
            {loading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : playlists.length === 0 ? (
              <div className="text-sm opacity-70">
                You have no playlists with room. Create one on the Playlists page.
              </div>
            ) : (
              playlists.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => addToPlaylist(p.id)}
                  disabled={loading}
                >
                  <ListMusic className="w-4 h-4 mr-2" />
                  {p.name} ({p.song_count}/30)
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AddToPlaylistButton;
export { AddToPlaylistButton };
