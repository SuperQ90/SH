import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, getAuthedClient } from "@/lib/supabase";
import { GENRES } from "@/types/music";

type SongRow = {
  id: string;
  user_id?: string | null;
  title: string | null;
  artist: string | null;
  genre: string | null;
  cover_url?: string | null;
  image_url?: string | null;
};

interface EditSongDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void; // <- optional + may not be a function
  song: SongRow | null;
  onUpdated?: () => void;
}

export default function EditSongDialog({
  open,
  onOpenChange,
  song,
  onUpdated,
}: EditSongDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const songId = song?.id ?? null;

  useEffect(() => {
    if (!song) return;
    setTitle(song.title ?? "");
    setArtist(song.artist ?? "");
    setGenre(song.genre ?? "");
    setCoverFile(null);
  }, [song]);

  const canEdit = useMemo(() => {
    if (!user || !song) return false;
    if (!song.user_id) return true; // let RLS enforce if not selected
    return song.user_id === user.id;
  }, [user, song]);

  const safeOpenChange = (v: boolean) => {
    if (typeof onOpenChange === "function") onOpenChange(v);
  };

  const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const ok = ["image/png", "image/jpeg", "image/webp"];
    if (!ok.includes(file.type)) {
      toast({
        title: "Invalid image",
        description: "Cover must be PNG, JPG, or WEBP.",
        variant: "destructive",
      });
      return;
    }
    setCoverFile(file);
  };

  const uploadCoverIfNeeded = async (): Promise<string | null> => {
    if (!coverFile || !songId) return null;
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token || "";
    if (!token) throw new Error("Not authenticated.");

    const authed = getAuthedClient(token);
    const ext = coverFile.name.split(".").pop() || "png";
    const path = `${songId}/cover.${ext}`;

    const { error } = await authed.storage
      .from("songs")
      .upload(path, coverFile, { cacheControl: "3600", upsert: true });
    if (error) throw error;

    const { data } = authed.storage.from("songs").getPublicUrl(path);
    return data.publicUrl || null;
  };

  const onSave = async () => {
    if (!songId) return;
    if (!title.trim() || !artist.trim() || !genre) {
      toast({
        title: "Missing fields",
        description: "Title, Artist, and Genre are required.",
        variant: "destructive",
      });
      return;
    }
    if (!canEdit) {
      toast({
        title: "Not allowed",
        description: "You can only edit your own songs.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      let newCoverUrl: string | null = null;
      if (coverFile) newCoverUrl = await uploadCoverIfNeeded();

      const payload: Record<string, any> = {
        title: title.trim(),
        artist: artist.trim(),
        genre,
        updated_at: new Date().toISOString(),
      };
      if (newCoverUrl) {
        payload.cover_url = newCoverUrl;
        payload.image_url = newCoverUrl; // keep both in sync
      }

      const { error } = await supabase.from("songs").update(payload).eq("id", songId);
      if (error) throw error;

      toast({ title: "Saved", description: "Song updated successfully." });
      onUpdated?.();
      safeOpenChange(false); // <- guarded close
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err?.message || "Failed to update song.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => safeOpenChange(v)}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Edit song</DialogTitle>
        </DialogHeader>

        {!song ? (
          <div className="text-sm text-muted-foreground">No song selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">Artist</label>
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">Genre</label>
              <Select value={genre || ""} onValueChange={setGenre}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select a genre" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g: any) => {
                    const val = typeof g === "string" ? g : g.value;
                    const label = typeof g === "string" ? g : g.label;
                    return (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Replace Cover Image (optional)</label>
              <Input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={onPickCover}
                className="bg-input border-border"
              />
              {coverFile ? (
                <p className="text-xs text-muted-foreground">
                  Selected: {coverFile.name}
                </p>
              ) : song.cover_url ? (
                <div className="text-xs text-muted-foreground">
                  Current:&nbsp;
                  <a className="underline" href={song.cover_url || ""} target="_blank" rel="noreferrer">
                    open cover
                  </a>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={onSave} disabled={saving || !canEdit}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => safeOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
