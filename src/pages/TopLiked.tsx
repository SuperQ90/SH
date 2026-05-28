// src/pages/TopLiked.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import TrackList from "@/components/TrackList";
import type { Track } from "@/types/music";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Heart } from "lucide-react";

const PAGE_SIZE = 50;

const TopLiked: React.FC = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = React.useState<Track | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTop = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("top_liked_songs")
        .select("*")
        .order("likes_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      setTracks((data as unknown as Track[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load Top Liked songs.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTop();
  }, [fetchTop]);

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
  };

  const handleTrackDeleted = () => {
    fetchTop();
  };

  const handleArtistClick = (artist: string) => {
    console.debug("Artist clicked:", artist);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-3 sm:px-4 py-4">
          {/* Stack on mobile so the button doesn't force overflow */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 justify-center sm:justify-start"
            >
              <Home className="w-4 h-4 mr-2" />
              <span className="sm:hidden">Back</span>
              <span className="hidden sm:inline">Back to Radio</span>
            </Button>

            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2 break-words">
                <Heart className="w-5 h-5 text-pink-400 shrink-0" />
                <span className="min-w-0 break-words">Top Liked Songs</span>
              </h1>
              <p className="text-xs text-cyan-400 break-words">
                Most loved tracks by the community
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-32">
        {loading ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Loading top liked songs…</p>
          </Card>
        ) : error ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-red-400">Error: {error}</p>
          </Card>
        ) : !tracks.length ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">
              No liked songs yet. Be the first to like something!
            </p>
          </Card>
        ) : (
          <div className="space-y-4 min-w-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-lg font-semibold text-white break-words">
                Top {tracks.length} Most Liked Tracks
              </h2>
              <p className="text-sm text-gray-400">Updated in real-time</p>
            </div>

            <TrackList
              tracks={tracks}
              onPlayTrack={handlePlayTrack}
              onLikeTrack={() => {}}
              likedTracks={[]}
              currentTrack={currentTrack}
              onTrackDeleted={handleTrackDeleted}
              onArtistClick={handleArtistClick}
              showRanking
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default TopLiked;
