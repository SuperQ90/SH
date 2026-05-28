// src/pages/PlaylistDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Trash2,
  Copy,
  Share2,
  Play,
  Shuffle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { moveSong, removeSong } from "@/lib/rpc";
import { Track } from "@/types/music";
import InlineAudioPlayer from "@/components/InlineAudioPlayer";

type PlaylistRow = {
  id: string;
  name: string;
  user_id: string;
  is_public: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function PlaylistDetail() {
  // Support both routes: /playlist/:id and /p/:playlistId
  const params = useParams();
  const playlistId = (params.id as string) ?? (params.playlistId as string);
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState<PlaylistRow | null>(null);
  const [songs, setSongs] = useState<Track[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${playlistId}`
      : "";

  const canEdit = useMemo(
    () => !!playlist?.user_id && !!userId && playlist!.user_id === userId,
    [playlist?.user_id, userId]
  );

  // ----- data loaders -------------------------------------------------------
  const loadHeader = async () => {
    const { data, error } = await supabase
      .from("playlists")
      .select("id, name, user_id, is_public, created_at, updated_at")
      .eq("id", playlistId)
      .maybeSingle();
    if (error) throw error;
    setPlaylist(data as PlaylistRow | null);
  };

  const loadSongs = async () => {
    // Join playlist_songs -> songs; order by position
    // IMPORTANT: include fields needed for playback
    const { data, error } = await supabase
      .from("playlist_songs")
      .select(
        "position, songs:song_id(id, title, artist, genre, audio_url, duration, image_url, cover_url)"
      )
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });

    if (error) throw error;

    const list: Track[] = (data ?? [])
      .map((r: any) => {
        const s = r.songs;
        if (!s?.id) return null;

        return {
          id: s.id,
          title: s.title ?? "Untitled",
          artist: s.artist ?? "",
          genre: s.genre ?? "",
          duration: Number(s.duration) || 180,
          url: s.audio_url ?? "",
          audio_url: s.audio_url ?? "",
          image_url: s.image_url ?? s.cover_url ?? undefined,
          cover_url: s.cover_url ?? undefined,
        } as Track;
      })
      .filter(Boolean) as Track[];

    setSongs(list);
  };

  // ----- effects ------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      await loadHeader();
      await loadSongs();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  // ----- handlers -----------------------------------------------------------
  const onMove = async (songId: string, direction: "up" | "down") => {
    if (!canEdit) return;
    setBusy(true);
    try {
      await moveSong(playlistId!, songId, direction);
      await loadSongs();
    } catch (e: any) {
      toast({
        title: "Reorder failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (songId: string) => {
    if (!canEdit) return;
    if (!window.confirm("Remove this song from the playlist?")) return;

    setBusy(true);
    try {
      await removeSong(playlistId!, songId);
      await loadSongs();
      toast({ title: "Removed from playlist" });
    } catch (e: any) {
      toast({
        title: "Remove failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onTogglePublic = async (next: boolean) => {
    if (!canEdit || !playlist) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("playlists")
        .update({ is_public: next, updated_at: new Date().toISOString() })
        .eq("id", playlist.id);
      if (error) throw error;
      setPlaylist({ ...playlist, is_public: next });
      toast({ title: `Playlist is now ${next ? "public" : "private"}` });
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handlePlayClick = (track: Track) => {
    if (!track.url && !track.audio_url) {
      toast({
        title: "Track Unavailable",
        description: `"${track.title}" is not available for playback.`,
        variant: "destructive",
      });
      return;
    }
    // Toggle expand to show inline player
    setExpandedTrack(expandedTrack === track.id ? null : track.id);
  };

  // Get the index of the currently playing track
  const currentTrackIndex = songs.findIndex(s => s.id === expandedTrack);

  // Handle when a song ends - automatically play the next song
  const handleSongEnded = () => {
    if (currentTrackIndex >= 0 && currentTrackIndex < songs.length - 1) {
      // Find the next playable song
      for (let i = currentTrackIndex + 1; i < songs.length; i++) {
        const nextSong = songs[i];
        if (nextSong.url || nextSong.audio_url) {
          setExpandedTrack(nextSong.id);
          return;
        }
      }
    }
    // If no next song, stop playback
    setExpandedTrack(null);
  };

  // Handle skip to next track
  const handleSkipNext = () => {
    handleSongEnded();
  };

  // Check if there's a next playable track
  const hasNextTrack = () => {
    if (currentTrackIndex < 0) return false;
    for (let i = currentTrackIndex + 1; i < songs.length; i++) {
      if (songs[i].url || songs[i].audio_url) {
        return true;
      }
    }
    return false;
  };

  const onPlayAll = () => {
    if (songs.length === 0) return;
    // Play the first song
    const firstPlayable = songs.find(s => s.url || s.audio_url);
    if (firstPlayable) {
      setExpandedTrack(firstPlayable.id);
    }
  };

  const onShuffleAll = () => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const firstPlayable = shuffled.find(s => s.url || s.audio_url);
    if (firstPlayable) {
      setExpandedTrack(firstPlayable.id);
    }
  };


  // ----- render -------------------------------------------------------------
  if (!playlist) {
    return (
      <div className="mx-auto max-w-3xl p-3 sm:p-4 pb-28 overflow-x-hidden">
        <div className="mb-4">
          <Link
            to="/playlists"
            className="inline-flex items-center text-sm opacity-80 hover:opacity-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Playlists
          </Link>
        </div>
        <Card className="p-6">
          <div className="text-sm opacity-80">
            Playlist not found or you don't have access.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-4 pb-28 overflow-x-hidden">
      <div className="mb-4">
        <Link
          to="/playlists"
          className="inline-flex items-center text-sm opacity-80 hover:opacity-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Playlists
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{playlist.name}</h1>
          <div className="text-xs opacity-70 mt-1">
            {canEdit
              ? "You are the owner"
              : playlist.is_public
                ? "Public playlist"
                : "Private playlist"}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onPlayAll}
              disabled={songs.length === 0}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Play className="mr-2 h-4 w-4" />
              Play all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onShuffleAll}
              disabled={songs.length === 0}
            >
              <Shuffle className="mr-2 h-4 w-4" />
              Shuffle
            </Button>
          </div>
        </div>

        {/* Public toggle + share */}
        <div className="flex flex-col gap-2 sm:items-end">
          {canEdit && (
            <div className="flex items-center gap-2">
              <Switch
                disabled={busy}
                checked={!!playlist.is_public}
                onCheckedChange={onTogglePublic}
              />
              <span className="text-sm">
                {playlist.is_public ? "Public" : "Private"}
              </span>
            </div>
          )}

          {playlist.is_public && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareLink}
                className="w-full sm:w-auto"
              >
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </Button>

              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto"
              >
                <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                  <Share2 className="mr-2 h-4 w-4" /> Open
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>

      <Card className="p-4">
        {songs.length === 0 ? (
          <div className="text-sm opacity-70">No songs in this playlist yet.</div>
        ) : (
          <div className="space-y-2">
            {songs.map((s, idx) => {
              const isExpanded = expandedTrack === s.id;
              const audioUrl = s.url || s.audio_url;

              return (
                <div
                  key={s.id}
                  className={`flex flex-col rounded-lg border border-white/10 bg-white/5 p-3 ${
                    isExpanded ? "ring-2 ring-cyan-500/60" : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-sm opacity-70 flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{s.title}</span>
                        {s.artist ? (
                          <span className="text-xs opacity-70 truncate">
                            {s.artist}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        disabled={busy || !audioUrl}
                        onClick={() => handlePlayClick(s)}
                        title="Play"
                      >
                        <Play className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-cyan-400 hover:text-green-400"
                        onClick={() => setExpandedTrack(isExpanded ? null : s.id)}
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>

                      {canEdit ? (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            disabled={busy || idx === 0}
                            onClick={() => onMove(s.id, "up")}
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            disabled={busy || idx === songs.length - 1}
                            onClick={() => onMove(s.id, "down")}
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-9 w-9"
                            disabled={busy}
                            onClick={() => onRemove(s.id)}
                            title="Remove from playlist"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Inline Audio Player with Waveform - Continuous Play enabled */}
                  {isExpanded && audioUrl && (
                    <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                      <InlineAudioPlayer
                        audioUrl={audioUrl}
                        title={s.title}
                        artist={s.artist}
                        songId={s.id}
                        autoPlay={true}
                        onEnded={handleSongEnded}
                        hasNextTrack={hasNextTrack()}
                        onSkipNext={handleSkipNext}
                      />
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
