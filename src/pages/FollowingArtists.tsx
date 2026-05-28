import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getFollowedArtists, type FollowedArtistRow } from "@/lib/follows";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Users, RefreshCw } from "lucide-react";

const DEFAULT_AVATAR = "/placeholder.svg";

const FollowingArtists: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [artists, setArtists] = React.useState<FollowedArtistRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await getFollowedArtists();
      setArtists(rows);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load followed artists.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Radio
            </Button>
            <h1 className="text-xl font-bold text-white">Followed Artists</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Please sign in to see artists you follow.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 shrink-0"
            >
              <Home className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400 shrink-0" />
                Followed Artists
              </h1>
              <p className="text-xs text-cyan-400/80 truncate">
                Artists you follow on AI Music Radio
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-cyan-400/40 text-cyan-300 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-16">
        {loading ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Loading followed artists…</p>
          </Card>
        ) : error ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-red-400">{error}</p>
            <p className="text-sm text-gray-500 mt-2">
              If this is your first time, run the Supabase migration for{" "}
              <code className="text-cyan-400">artist_follows</code> in the SQL
              Editor.
            </p>
          </Card>
        ) : artists.length === 0 ? (
          <Card className="p-8 bg-black/40 border-white/10 text-center">
            <Users className="w-12 h-12 text-cyan-500/50 mx-auto mb-4" />
            <p className="text-gray-300">You are not following any artists yet.</p>
            <p className="text-sm text-gray-500 mt-2">
              Visit an artist page and tap <strong>Follow</strong>.
            </p>
            <Button
              asChild
              className="mt-6 bg-cyan-600 hover:bg-cyan-700"
            >
              <Link to="/featured-artists">Browse Featured Artists</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artists.map((artist) => (
              <Link
                key={artist.artist_user_id}
                to={`/artist/${artist.artist_slug}`}
                className="group block"
              >
                <Card className="p-4 bg-black/40 border-cyan-500/20 hover:border-cyan-400/50 transition-colors h-full">
                  <div className="flex items-center gap-3">
                    <img
                      src={artist.profile_image_url || DEFAULT_AVATAR}
                      alt={artist.display_name || artist.artist_slug}
                      className="w-14 h-14 rounded-lg object-cover border border-cyan-500/30"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate group-hover:text-cyan-200">
                        {artist.display_name || artist.artist_slug}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        /{artist.artist_slug}
                      </p>
                    </div>
                  </div>
                  {artist.genres && artist.genres.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {artist.genres.slice(0, 3).map((g) => (
                        <Badge
                          key={g}
                          variant="secondary"
                          className="text-[10px] max-w-full truncate"
                        >
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FollowingArtists;
