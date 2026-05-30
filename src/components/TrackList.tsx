// src/components/TrackList.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, ExternalLink, Edit, Save, X, ChevronDown, ChevronUp, Bell } from "lucide-react";
import LikeButton from "@/components/LikeButton";
import AddToPlaylistButton from "@/components/AddToPlaylistButton";
import { DeleteSongButton } from "@/components/DeleteSongButton";
import InlineAudioPlayer from "@/components/InlineAudioPlayer";
import ShareButton from "@/components/ShareButton";
import SongComments from "@/components/SongComments";
import NewSongBadge from "@/components/NewSongBadge";
import { Track } from "@/types/music";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { markNotificationsReadForSong } from "@/lib/notifications";


interface TrackListProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
  onLikeTrack: (trackId: string) => void; // kept for API compatibility
  likedTracks: string[]; // kept for API compatibility
  currentTrack: Track | null;
  onTrackDeleted: () => void;
  selectedGenre?: string;
  onGenreSelect?: (genre: string) => void;
  onSongAdded?: () => void;
  onTrackUpdate?: (trackId: string, updates: Partial<Track>) => void;
  onArtistClick?: (artist: string) => void;
  showRanking?: boolean;
  hideArtistPageButton?: boolean;
  initialExpandedSongId?: string | null; // For shared song links
}


/** Safe reader in case Track type doesn't declare likes_count */
const getLikesCount = (t: Track) =>
  (t as unknown as { likes_count?: number }).likes_count ?? 0;

const LOG_WINDOW_MS = 60_000;
const PG_DUPLICATE_KEY = "23505";

// Default headphone icon (what you already use elsewhere)
const DEFAULT_COVER =
  "https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1755626920268_0d5db80b.png";

const TrackList: React.FC<TrackListProps> = ({
  tracks,
  onPlayTrack,
  onLikeTrack: _onLikeTrack, // intentionally unused (API compatibility)
  likedTracks: _likedTracks, // intentionally unused (API compatibility)
  currentTrack,
  onTrackDeleted,
  selectedGenre: _selectedGenre,
  onGenreSelect: _onGenreSelect,
  onSongAdded: _onSongAdded,
  onTrackUpdate: _onTrackUpdate,
  onArtistClick,
  showRanking = false,
  hideArtistPageButton = false,
  initialExpandedSongId = null,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [brandUrl, setBrandUrl] = useState("");
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const lastLoggedAtRef = useRef<Map<string, number>>(new Map());
  const [expandedTrack, setExpandedTrack] = useState<string | null>(initialExpandedSongId);
  const initialExpandedRef = useRef(false);

  // -------- unread comment notifications --------
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const fetchUnreadCounts = useCallback(async (songIds: string[]) => {
    if (!user || songIds.length === 0) return;
    try {
      const { data, error } = await supabase.rpc('get_unread_comment_counts', {
        p_song_ids: songIds,
      });
      if (error) {
        console.error('Failed to fetch unread comments:', error);
        return;
      }
      if (data && typeof data === 'object') {
        setUnreadCounts(data as Record<string, number>);
      }
    } catch (e: any) {
      console.error('Failed to fetch unread comments:', e?.message || e);
    }
  }, [user]);

  // Fetch unread counts when tracks change or user logs in
  useEffect(() => {
    if (!user) {
      setUnreadCounts({});
      return;
    }
    const ids = tracks.map((t) => t.id);
    void fetchUnreadCounts(ids);
  }, [user, JSON.stringify(tracks.map((t) => t.id).sort()), fetchUnreadCounts]);

  const markCommentsRead = useCallback(async (songId: string) => {
    if (!user) return;
    // Only mark as read if this is the user's own song
    const track = tracks.find(t => t.id === songId);
    if (!track || track.user_id !== user.id) return;
    // Only if there are unread comments
    if (!unreadCounts[songId]) return;

    try {
      // Upsert into song_comment_reads
      const { error } = await supabase
        .from('song_comment_reads')
        .upsert(
          { user_id: user.id, song_id: songId, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,song_id' }
        );
      if (error) {
        console.error('Failed to mark comments as read:', error);
        return;
      }
      void markNotificationsReadForSong(songId);
      // Clear the unread count locally
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[songId];
        return next;
      });
    } catch (e: any) {
      console.error('Failed to mark comments as read:', e?.message || e);
    }
  }, [user, tracks, unreadCounts]);



  // Cache artist slugs by user_id
  const [artistSlugs, setArtistSlugs] = useState<Record<string, string | null>>(
    {}
  );

  const shortenUrl = (url: string, maxLength: number = 30): string => {
    if (url.length <= maxLength) return url;
    const cleanUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (cleanUrl.length <= maxLength) return cleanUrl;
    return cleanUrl.substring(0, maxLength - 3) + "...";
  };

  // Ensure brand URL is an absolute URL (add https:// if missing)
  const ensureAbsoluteUrl = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };


  const canEditTrack = (track: Track) => {
    if (!user) return false;
    return track.user_id === user.id;
    // NOTE: admins can override via server policies; keep client conservative.
  };

  // -------- play counts --------
  const fetchPlayCounts = async (ids: string[]) => {
    if (!ids.length) return;
    const { data, error } = await supabase
      .from("song_play_stats")
      .select("song_id, play_count")
      .in("song_id", ids);

    if (error) return; // soft-fail

    const map: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      map[r.song_id] = Number(r.play_count) || 0;
    });
    setPlayCounts((prev) => ({ ...prev, ...map }));
  };

  useEffect(() => {
    const ids = tracks.map((t) => t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchPlayCounts(ids);
  }, [JSON.stringify(tracks.map((t) => t.id).sort())]);

  // Handle initial expanded song from URL parameter
  useEffect(() => {
    if (initialExpandedSongId && !initialExpandedRef.current && tracks.length > 0) {
      const songExists = tracks.some(t => t.id === initialExpandedSongId);
      if (songExists) {
        setExpandedTrack(initialExpandedSongId);
        initialExpandedRef.current = true;
        // Scroll to the expanded track after a short delay
        setTimeout(() => {
          const trackElement = document.querySelector(`[data-track-id="${initialExpandedSongId}"]`);
          if (trackElement) {
            trackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [initialExpandedSongId, tracks]);


  // -------- load artist slugs once per set of user_ids (PUBLIC VIEW) --------
  useEffect(() => {
    const userIds = Array.from(
      new Set(tracks.map((t) => t.user_id).filter(Boolean))
    ) as string[];
    if (userIds.length === 0) return;

    (async () => {
      try {
        // Use the RLS-safe public view with the correct column names
        const { data, error } = await supabase
          .from("artist_public_profiles")
          .select("user_id, artist_slug")
          .in("user_id", userIds);

        if (error) throw error;

        const map: Record<string, string | null> = {};
        (data ?? []).forEach((row: any) => {
          const s = (row.artist_slug as string | null)?.trim() || null;
          if (s) map[row.user_id] = s;
        });
        setArtistSlugs((prev) => ({ ...prev, ...map }));
      } catch (e: any) {
        console.error("Failed to load artist slugs (public):", e?.message || e);
      }
    })();
  }, [JSON.stringify(tracks.map((t) => t.user_id).sort())]);

  // -------- brand url edit --------
  const handleEditBrandUrl = (trackId: string, currentUrl?: string) => {
    setEditingTrack(trackId);
    setBrandUrl(currentUrl || "");
  };

  const handleSaveBrandUrl = async (trackId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("songs")
        .update({ brand_url: brandUrl || null })
        .eq("id", trackId);

      if (error) throw error;

      toast({ title: "Brand URL updated successfully!" });
      setEditingTrack(null);
      setBrandUrl("");
      onTrackDeleted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingTrack(null);
    setBrandUrl("");
  };

  // -------- logging plays --------
  /** Returns true only when a new row was inserted into song_plays. */
  const logPlayOnce = async (songId: string): Promise<boolean> => {
    try {
      const now = Date.now();
      const last = lastLoggedAtRef.current.get(songId) ?? 0;
      if (now - last < LOG_WINDOW_MS) return false;

      if (!user) return false;

      const { error } = await supabase.from("song_plays").insert({
        song_id: songId,
      });

      if (error) {
        if ((error as any).code === PG_DUPLICATE_KEY) {
          lastLoggedAtRef.current.set(songId, now);
        } else {
          console.error("song_plays insert failed:", error);
        }
        return false;
      }

      lastLoggedAtRef.current.set(songId, now);
      return true;
    } catch {
      return false;
    }
  };

  const handlePlayClick = async (track: Track) => {
    // Expand the track to show inline player (don't call onPlayTrack to avoid old bottom player)
    const willExpand = expandedTrack !== track.id;
    setExpandedTrack(willExpand ? track.id : null);

    if (willExpand) {
      void markCommentsRead(track.id);
      const saved = await logPlayOnce(track.id);
      if (saved) {
        await fetchPlayCounts([track.id]);
      }
    }
  };


  // Handle when a song ends - advance to next track
  const handleSongEnded = (currentTrackId: string) => {
    const currentIndex = tracks.findIndex(t => t.id === currentTrackId);
    if (currentIndex !== -1 && currentIndex < tracks.length - 1) {
      // There's a next track, advance to it
      const nextTrack = tracks[currentIndex + 1];
      setExpandedTrack(nextTrack.id);
      void (async () => {
        const saved = await logPlayOnce(nextTrack.id);
        if (saved) await fetchPlayCounts([nextTrack.id]);
      })();

      // Scroll to the next track
      setTimeout(() => {
        const trackElement = document.querySelector(`[data-track-id="${nextTrack.id}"]`);
        if (trackElement) {
          trackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  // Handle skip to next track
  const handleSkipNext = (currentTrackId: string) => {
    handleSongEnded(currentTrackId);
  };

  // Check if there's a next track
  const hasNextTrack = (trackId: string) => {
    const currentIndex = tracks.findIndex(t => t.id === trackId);
    return currentIndex !== -1 && currentIndex < tracks.length - 1;
  };

  const toggleExpand = (trackId: string) => {
    const willExpand = expandedTrack !== trackId;
    setExpandedTrack(willExpand ? trackId : null);
    // Mark comments as read when expanding own song
    if (willExpand) void markCommentsRead(trackId);
  };




  if (tracks.length === 0) {
    return (
      <Card className="p-8 text-center bg-card border-border">
        <p className="text-muted-foreground">
          No tracks available. Select a genre to discover AI-generated music!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {tracks.map((track, index) => {
        const coverSrc =
          (track as any).image_url ||
          (track as any).cover_url ||
          DEFAULT_COVER;

        const slug = artistSlugs[track.user_id!];
        const artistHref = slug ? `/artist/${slug}` : undefined;
        const isExpanded = expandedTrack === track.id;

        const goToCreateArtistPage = (e: React.MouseEvent) => {
          e.stopPropagation();
          navigate("/profile");
        };

        return (

          <React.Fragment key={track.id}>









            {index === 10 && (
              <div className="my-6 flex justify-center">
                <a href="https://frostai.app/r/AIMUSICRADIO" target="_blank" rel="noopener">
                  <img
                    src="https://frostai.app/static/banners/frost-320x50.svg"
                    alt="Frost AI - Create AI Content"
                    width="320"
                    height="100"
                    className="max-w-full h-auto rounded-lg shadow-lg"
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(34, 197, 94, 0.3))",
                    }}
                  />
                </a>
              </div>
            )}

            {index === 15 && (
              <div className="my-6 flex justify-center">
                <a href="https://aimusicvids.io" target="_blank" rel="noopener noreferrer">
                  <img
                    src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1771314210601_0d10f70b.png"
                    alt="aimusicvids.io - AI Music Video Platform - Share Your AI Music Videos With the World"
                    className="max-w-full h-auto rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(34, 197, 94, 0.3))",
                      maxWidth: "320px",

                    }}
                  />
                </a>
              </div>
            )}


            <Card
              data-track-id={track.id}
              className={`p-3 bg-card border-border transition-all duration-200 hover:ring-2 hover:ring-primary ${
                currentTrack?.id === track.id || isExpanded ? "ring-2 ring-primary neon-glow" : ""
              }`}

            >


              <div className="flex flex-col gap-2">
                {/* Top area: mobile = stack; sm+ = single row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: cover + text */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {showRanking && (
                      <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-black font-bold text-xs sm:text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                    )}

                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded flex items-center justify-center neon-glow flex-shrink-0 overflow-hidden">
                      <img
                        src={coverSrc}
                        alt={track.title}
                        className="w-full h-full object-cover object-center rounded"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title + New Song Badge */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3
                          className={[
                            "text-foreground font-semibold text-sm leading-snug",
                            "break-words",
                            "overflow-hidden",
                            "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]",
                            "sm:block sm:truncate",
                            "min-w-0",
                          ].join(" ")}
                        >
                          {track.title}
                        </h3>
                        <NewSongBadge createdAt={track.created_at} />
                        {/* Red notification bell for unread comments on artist's own songs */}
                        {user && track.user_id === user.id && unreadCounts[track.id] > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isExpanded) {
                                toggleExpand(track.id);
                              }
                            }}
                            className="relative flex-shrink-0 p-0 border-none bg-transparent cursor-pointer group"
                            title={`${unreadCounts[track.id]} new comment${unreadCounts[track.id] !== 1 ? 's' : ''}`}
                          >
                            <Bell className="w-4 h-4 text-red-500 animate-[bell-ring_1s_ease-in-out_infinite] group-hover:text-red-400 transition-colors" fill="currentColor" />
                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none shadow-lg shadow-red-500/50">
                              {unreadCounts[track.id]}
                            </span>
                          </button>
                        )}
                      </div>



                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {/* Artist row: allow wrapping on mobile */}
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
                          <button
                            onClick={() => onArtistClick?.(track.artist)}
                            className={[
                              "text-muted-foreground text-xs hover:text-green-400 transition-colors",
                              "cursor-pointer bg-transparent border-none p-0 text-left font-medium",
                              "min-w-0 max-w-full",
                              "break-words overflow-hidden",
                              "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]",
                              "sm:block sm:truncate",
                            ].join(" ")}
                            title="View all songs by this artist"
                          >
                            {track.artist}
                          </button>

                          {(track as any).brand_url && (
                            <a
                              href={ensureAbsoluteUrl((track as any).brand_url)}

                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                              title="Visit artist's brand page"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <span
                          className="text-green-400 text-xs font-semibold"
                          style={{
                            textShadow: "0 0 10px rgba(34, 197, 94, 0.8)",
                          }}
                        >
                          {track.genre}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: actions (drops below on mobile) */}
                  <div className="flex items-center gap-1 justify-end sm:justify-start sm:flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayClick(track)}
                      className="h-8 w-8 p-0 text-foreground hover:bg-accent neon-glow"
                      title="Play with waveform visualizer"
                    >
                      <Play className="w-3 h-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(track.id)}
                      className="h-8 w-8 p-0 text-cyan-400 hover:text-green-400 hover:bg-accent"
                      title={isExpanded ? "Collapse player" : "Expand player"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>

                    <span className="text-xs text-muted-foreground tabular-nums px-2 select-none">
                      ▶ {playCounts[track.id] ?? 0}
                    </span>

                    <LikeButton songId={track.id} initialCount={getLikesCount(track)} />

                    <ShareButton 
                      songId={track.id} 
                      title={track.title} 
                      artist={track.artist}
                      className="h-8 w-8 p-0"
                    />

                    <DeleteSongButton track={track} onDeleted={onTrackDeleted} />
                  </div>
                </div>


                {/* Inline Audio Player with Waveform - shown when expanded */}
                {isExpanded && track.url && (
                  <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                    <InlineAudioPlayer
                      audioUrl={track.url}
                      title={track.title}
                      artist={track.artist}
                      songId={track.id}
                      autoPlay={true}
                      hasNextTrack={hasNextTrack(track.id)}
                      onSkipNext={() => handleSkipNext(track.id)}
                      onEnded={() => handleSongEnded(track.id)}
                    />
                  </div>
                )}

                {/* Comments - only visible when the song is expanded (same behavior as the inline player) */}
                {isExpanded && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <SongComments songId={track.id} />
                  </div>
                )}


                {/* Buttons row: wrap instead of overflow */}
                <div className="flex flex-wrap items-center gap-2">
                  {user && (
                    <div className="shrink-0">
                      <AddToPlaylistButton songId={track.id} songTitle={track.title} />
                    </div>
                  )}

                  {!hideArtistPageButton && (
                    <>
                      {slug ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="whitespace-nowrap"
                          title="Open this artist's page"
                        >
                          <Link to={artistHref!} onClick={(e) => e.stopPropagation()}>
                            Artist's Page
                          </Link>
                        </Button>
                      ) : (
                        canEditTrack(track) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToCreateArtistPage}
                            className="whitespace-nowrap"
                            title="Set up your artist page"
                          >
                            Create Artist Page
                          </Button>
                        )
                      )}
                    </>
                  )}
                </div>

                {/* Brand URL editor / display */}
                {editingTrack === track.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={brandUrl}
                      onChange={(e) => setBrandUrl(e.target.value)}
                      placeholder="Enter brand URL (e.g., https://example.com)"
                      className="text-xs h-8"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveBrandUrl(track.id)}
                        className="h-8 px-2"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-8 px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between min-w-0 gap-2">
                    {(track as any).brand_url ? (
                      <a
                        href={ensureAbsoluteUrl((track as any).brand_url)}

                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 font-semibold shadow-sm shadow-green-400/20 min-w-0"
                        title={(track as any).brand_url}
                        style={{
                          textShadow: "0 0 10px rgba(34, 197, 94, 0.8)",
                        }}
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {shortenUrl(
                            (track as any).brand_url
                              .replace(/^https?:\/\//, "")
                              .replace(/\/$/, "")
                          )}
                        </span>
                      </a>
                    ) : (
                      <span />
                    )}

                    {canEditTrack(track) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditBrandUrl(track.id, (track as any).brand_url)}
                        className="h-7 px-2 text-xs shrink-0"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {(track as any).brand_url ? "Edit URL" : "Add URL"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default TrackList;
