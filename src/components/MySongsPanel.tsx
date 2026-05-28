import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import EditSongDialog from "./EditSongDialog";

type SongRow = {
  id: string;
  user_id?: string | null;
  title: string | null;
  artist: string | null;
  genre: string | null;
  cover_url?: string | null;
  image_url?: string | null;
  created_at?: string | null;
};

export default function MySongsPanel() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<SongRow | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("songs")
      .select("id,user_id,title,artist,genre,cover_url,image_url,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (!error && data) setSongs(data as SongRow[]);
  };

  useEffect(() => {
    void load();
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {loading ? "Loading…" : `${songs.length} song(s)`}
      </div>

      <div className="grid gap-3">
        {songs.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{s.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.artist} • {s.genre}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSelected(s);
                setEditOpen(true);
              }}
            >
              Edit
            </Button>
          </div>
        ))}
      </div>

      <EditSongDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        song={selected}
        onUpdated={load}
      />
    </div>
  );
}
