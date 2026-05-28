// src/components/AddSongModal.tsx
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, getAuthedClient } from "@/lib/supabase";
import { GENRES } from "@/types/music";
import { Crown } from "lucide-react";

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongAdded: () => void;
}

export const AddSongModal: React.FC<AddSongModalProps> = ({
  isOpen,
  onClose,
  onSongAdded,
}) => {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  if (!user) return null;

  const email = (user.email || "").toLowerCase();
  const isPledge = email.endsWith("@pledge.ai");
  const isAdminEmail = email === "mrutter@gmail.com";
  const isAdminRole = profile?.role === "admin";
  const isLegacyFree = profile?.subscription_status === "free_legacy";
  const isNewFree =
    !isAdminEmail &&
    !isPledge &&
    !isAdminRole &&
    !isLegacyFree &&
    (profile?.subscription_status === "free_new" ||
      profile?.plan_source === "auth_bootstrap");

  // ---------- file handlers ----------

  const handleAudioPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const okTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave"];
    const ext = file.name.toLowerCase().split(".").pop();
    const okExt = ["mp3", "wav"];
    if (okTypes.includes(file.type) || (ext && okExt.includes(ext))) {
      setAudioFile(file);
      toast({
        title: "Audio selected",
        description: `${file.name}`,
      });
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select an MP3 or WAV file only.",
        variant: "destructive",
      });
    }
  };

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // ---------- uploads (AUTHED CLIENT) ----------

  const uploadWithAuth = async (file: File, path: string): Promise<string> => {
    // 1) Get the user session -> token
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token || "";
    if (!token) throw new Error("No session token found. Please re-login.");

    // 2) Build a scoped client that *always* sends the Authorization header
    const authed = getAuthedClient(token);

    // 3) Upload (Storage requires Authorization for non-public writes)
    const { data, error } = await authed.storage
      .from("songs")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (error) throw error;

    // 4) Get a public URL (bucket must be public or has a public read policy)
    const { data: url } = authed.storage.from("songs").getPublicUrl(path);
    return url.publicUrl;
  };

  // ---------- submit ----------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Error", description: "Song title is required", variant: "destructive" });
      return;
    }
    if (!artist.trim()) {
      toast({ title: "Error", description: "Artist name is required", variant: "destructive" });
      return;
    }
    if (!genre) {
      toast({ title: "Error", description: "Please select a genre", variant: "destructive" });
      return;
    }

    // client-side block for new-free plans
    if (isNewFree) {
      toast({
        title: "Uploads locked for your plan",
        description: "Upgrade to upload music.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Backend guard (single source of truth)
      const { data: canUpload, error: rpcError } = await supabase.rpc(
        "can_upload_song",
        { p_user_id: user.id }
      );
      if (rpcError) {
        console.error("can_upload_song RPC error:", rpcError);
        toast({
          title: "Upload not allowed",
          description: "Your current plan cannot upload more songs right now.",
          variant: "destructive",
        });
        return;
      }
      if (canUpload === false) {
        toast({
          title: "Upload limit reached",
          description: "You have reached the song limit for your current plan. Go to Pricing to upgrade.",
          variant: "destructive",
        });
        return;
      }

      const songId = crypto.randomUUID();
      let audioUrl: string | null = null;
      let imageUrl: string | null = null;

      if (coverFile) {
        const coverExt = coverFile.name.split(".").pop() || "png";
        imageUrl = await uploadWithAuth(coverFile, `${songId}/cover.${coverExt}`);
      }

      if (audioFile) {
        const audioExt = audioFile.name.split(".").pop() || "mp3";
        audioUrl = await uploadWithAuth(audioFile, `${songId}/audio.${audioExt}`);
      }

      // Insert the song row (RLS expects user_id = auth.uid())
      const { error } = await supabase.from("songs").insert([
        {
          id: songId,
          user_id: user.id,
          title: title.trim(),
          artist: artist.trim(),
          genre,
          duration: Math.floor(Math.random() * 240) + 120,
          audio_url: audioUrl,
          cover_url: imageUrl || "/placeholder.svg",
          image_url: imageUrl || null,
          brand_url: brandUrl.trim() || null,
        },
      ]);

      if (error) throw error;

      toast({ title: "Song added successfully!" });
      onSongAdded();
      onClose();
      setTitle("");
      setArtist("");
      setGenre("");
      setBrandUrl("");
      setCoverFile(null);
      setAudioFile(null);
    } catch (err: any) {
      console.error("Error adding song:", err);
      toast({
        title: "Error",
        description: err?.message || "Failed to add song",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If user is new-free, show locked UI but allow close
  if (isNewFree) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[420px] bg-slate-950 border border-amber-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-50">
              <Crown className="w-4 h-4" />
              Uploads locked
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-amber-100/80">
            Your account was created after we restricted uploads. You can listen
            to everything, but to upload you need to upgrade.
          </p>
          <div className="flex gap-2 mt-4">
            <Button asChild className="bg-amber-500 text-amber-950 hover:bg-amber-600 flex-1">
              <a href="/pricing">Go to pricing</a>
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border neon-glow">
        <DialogHeader>
          <DialogTitle className="neon-text flex items-center gap-2">
            Add New Song
            <span className="text-sm font-normal text-red-400">
              You must own the music you upload!
            </span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Song Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-input border-border"
              placeholder="Enter song title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="artist">Artist Name *</Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="bg-input border-border"
              placeholder="Enter artist name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="genre">Genre *</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Select a genre" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g: any) => (
                  <SelectItem
                    key={typeof g === "string" ? g : g.value}
                    value={typeof g === "string" ? g : g.value}
                  >
                    {typeof g === "string" ? g : g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brandUrl">Brand Page URL (Optional)</Label>
            <Input
              id="brandUrl"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
              placeholder="https://your-brand-page.com"
              className="bg-input border-border"
            />
          </div>

          {/* Optional cover */}
          <div className="space-y-2">
            <Label htmlFor="cover">Cover Image (optional)</Label>
            <Input
              id="cover"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={handleCoverPick}
              className="bg-input border-border"
            />
            {coverFile && (
              <p className="text-sm text-muted-foreground">Selected: {coverFile.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="audio">Audio File (MP3 or WAV only)</Label>
            <Input
              id="audio"
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              onChange={handleAudioPick}
              className="bg-input border-border"
            />
            {audioFile && (
              <p className="text-sm text-muted-foreground">Selected: {audioFile.name}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 neon-glow"
              disabled={loading || !title.trim() || !artist.trim() || !genre}
            >
              {loading ? "Adding..." : "Add Song"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
