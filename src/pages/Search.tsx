import React from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TrackList from "@/components/TrackList";
import type { Track } from "@/types/music";
import { RefreshCw, Search as SearchIcon } from "lucide-react";

const PAGE_SIZE = 25;

const Search: React.FC = () => {
  const { toast } = useToast();
  const [q, setQ] = React.useState<string>("");
  const [results, setResults] = React.useState<Track[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [currentTrack, setCurrentTrack] = React.useState<Track | null>(null);

  const mapRows = React.useCallback((rows: any[]): Track[] => {
    return (rows || []).map((s: any) => ({
      id: s.id,
      title: s.title ?? "Unknown Title",
      artist: s.artist ?? "Unknown Artist",
      genre: s.genre ?? "Other",
      duration: s.duration ?? 0,
      url: s.audio_url ?? "",
      user_id: s.user_id ?? null,
      brand_url: s.brand_url ?? null,
      image_url: s.image_url ?? s.cover_url ?? "/placeholder.svg",
      purchase_url: s.purchase_url ?? null,
      created_at: s.created_at ?? undefined,
    }));
  }, []);


  const runSearch = React.useCallback(
    async (reset: boolean) => {
      const query = q.trim();
      const nextOffset = reset ? 0 : offset;

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("search_songs", {
          p_query: query,
          p_limit: PAGE_SIZE,
          p_offset: nextOffset,
        });

        if (error) throw error;

        const mapped = mapRows(data || []);
        setHasMore(mapped.length === PAGE_SIZE);

        if (reset) {
          setResults(mapped);
          setOffset(PAGE_SIZE);
        } else {
          setResults((prev) => [...prev, ...mapped]);
          setOffset((prev) => prev + PAGE_SIZE);
        }
      } catch (err: any) {
        console.error(err);
        toast({
          title: "Search failed",
          description: err.message ?? "Unexpected error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [q, offset, mapRows, toast]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(true);
  };

  const loadMore = () => runSearch(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/70 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SearchIcon className="w-5 h-5 text-cyan-400" />
            Search Songs
          </h1>
          <p className="text-xs text-cyan-400">Title, artist, or genre</p>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a title, artist, or genre…"
            className="bg-black/50 border-white/10 text-white"
          />
          <Button type="submit" disabled={loading}>
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4" />
            )}
          </Button>
        </form>

        {results.length === 0 && !loading ? (
          <div className="text-center text-gray-400 py-16 border border-white/10 rounded-lg bg-black/30">
            Enter a search term and press Enter.
          </div>
        ) : (
          <div className="space-y-4">
            <TrackList
              tracks={results}
              onPlayTrack={(track) => setCurrentTrack(track)}
              onLikeTrack={undefined}
              likedTracks={[]}
              currentTrack={currentTrack}
              onTrackDeleted={() => runSearch(true)}
              onArtistClick={() => {}}
              showRanking={false}
            />

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={!hasMore || loading}
                className="border-cyan-500/60"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Search;