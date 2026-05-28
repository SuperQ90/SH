// src/pages/TopPlayed.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TrackList from "@/components/TrackList";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";

type Row = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  user_id: string;
  brand_url: string | null;
  // from the view
  plays_total?: number;
  last_played_on?: string | null;
  listeners_unique?: number;
};

export default function TopPlayed() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [qArtist, setQArtist] = useState("");
  const [qSong, setQSong] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // Pull from v_songs_with_play_counts, order by plays_total desc
      const { data, error } = await supabase
        .from("v_songs_with_play_counts")
        .select("*")
        .order("plays_total", { ascending: false })
        .limit(100);

      if (!mounted) return;

      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows(data as Row[]);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // client-side filters (keeps it simple for now)
  const filtered = rows.filter((r) => {
    const a = qArtist.trim().toLowerCase();
    const s = qSong.trim().toLowerCase();
    const okA = !a || r.artist.toLowerCase().includes(a);
    const okS = !s || r.title.toLowerCase().includes(s);
    return okA && okS;
  });

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="container mx-auto max-w-5xl p-3 sm:p-4 space-y-4">
        <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {/* NEW: Home button (does not affect existing layout; stacks nicely on mobile) */}
            <div className="mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="w-full sm:w-auto"
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </div>

            <h1 className="text-xl font-semibold break-words">Top Played</h1>
            <p className="text-sm text-muted-foreground break-words">
              Most-played tracks (all-time), ordered by total plays.
            </p>
          </div>

          {/* Mobile-safe filters: stack on mobile, row on sm+ */}
          <div className="w-full sm:w-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Input
                placeholder="Search by artist…"
                value={qArtist}
                onChange={(e) => setQArtist(e.target.value)}
                className="w-full sm:w-48"
              />
              <Input
                placeholder="Search by song…"
                value={qSong}
                onChange={(e) => setQSong(e.target.value)}
                className="w-full sm:w-48"
              />
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  setQArtist("");
                  setQSong("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No results.</Card>
        ) : (
          <div className="min-w-0">
            {/* TrackList works as-is */}
            <TrackList
              tracks={filtered as any}
              onPlayTrack={() => {}}
              onLikeTrack={() => {}}
              likedTracks={[]}
              currentTrack={null}
              onTrackDeleted={() => {}}
              showRanking={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
