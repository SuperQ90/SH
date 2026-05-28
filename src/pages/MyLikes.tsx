import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import TrackList from '@/components/TrackList';
import type { Track } from '@/types/music';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Heart } from 'lucide-react';

const PAGE_SIZE = 100;

const MyLikes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = React.useState<Track | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMyLikes = React.useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      // Join songs <- likes (inner) for the current user
      // We strip the joined "likes" object from each row before casting to Track
      const { data, error } = await supabase
        .from('songs')
        .select('*, likes!inner(user_id)')
        .eq('likes.user_id', user.id)
        .order('likes_count', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const cleaned = (data as any[] | null)?.map(({ likes, ...song }) => song as Track) ?? [];
      setTracks(cleaned);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load your liked songs.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) fetchMyLikes();
  }, [user, fetchMyLikes]);

  const handlePlayTrack = (track: Track) => setCurrentTrack(track);
  const handleTrackDeleted = () => fetchMyLikes();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Radio
              </Button>
              <h1 className="text-xl font-bold text-white">My Likes</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">
              Please sign in to see your liked songs.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Radio
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-400" />
                  My Liked Songs
                </h1>
                <p className="text-xs text-cyan-400">Songs you've liked</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8 pb-32">
        {loading ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Loading your likes…</p>
          </Card>
        ) : error ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-red-400">Error: {error}</p>
          </Card>
        ) : !tracks.length ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">You haven't liked any songs yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {tracks.length} liked {tracks.length === 1 ? 'track' : 'tracks'}
              </h2>
            </div>

            <TrackList
              tracks={tracks}
              onPlayTrack={handlePlayTrack}
              onLikeTrack={() => fetchMyLikes()}
              onTrackDeleted={handleTrackDeleted}
              currentTrack={currentTrack}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default MyLikes;