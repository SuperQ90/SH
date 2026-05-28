import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Track } from '@/types/music';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TrackList from '@/components/TrackList';
import { RefreshCw } from 'lucide-react';

const GENRES = [
  'Acid Jazz', 'Afrobeat', 'Alternative', 'Ambient', 'Blues', 'Bluegrass', 'Breakbeat', 'CCM', 'Chillout',
  'Christian Djent', 'Christian Metal', 'Christian Rock', 'Classical', 'Comedy', 'Country', 'Dance', 'Disco',
  'Drum and Bass', 'Dub', 'Dubstep', 'Electronic', 'Ethereal', 'Experimental', 'Folk',
  'Funk', 'Garage', 'German Schlager', 'Gospel', 'Goth', 'Goth Metal', 'Goth Rock', 'Grime',
  'Hardcore', 'Healing Frequency', 'Hip Hop', 'Holiday Music', 'House', 'Indie', 'Industrial', 'Jazz', 'Jungle',
  'K-pop', 'Latin', 'Lo-Fi', 'Melodic Metal', 'Metal', 'New Age', 'Pop', 'Power Metal', 'Progressive', 'Psychobilly', 'Punk',
  'R&B', 'Rap', 'Reggae', 'Rock', 'Rockabilly', 'Romantic', 'Salsa', 'SKA Punk', 'Smooth Jazz', 'Soft Rock', 'Soul', 'Southern Metal',
  'Southern Rock', 'Stoner Rock', 'Techno', 'Trance', 'Trap', 'Trip Hop', 'World'
];




interface TopGenreSongsProps {
  onPlayTrack: (track: Track, playlist?: Track[]) => void;
  onLikeTrack?: (trackId: string) => void;
  likedTracks?: string[];
  currentTrack?: Track | null;
  onArtistClick?: (artist: string) => void;
}

type TopSongRow = {
  id: string;
  title?: string | null;
  artist?: string | null;
  genre?: string | null;
  duration?: number | null;
  audio_url?: string | null;
  user_id?: string | null;
  brand_url?: string | null;
  image_url?: string | null;
  cover_url?: string | null;
  purchase_url?: string | null;
  likes_count?: number | null;
  like_count?: number | null;
  likes?: number | null;
};

const TopGenreSongs: React.FC<TopGenreSongsProps> = ({
  onPlayTrack,
  onLikeTrack,
  likedTracks = [],
  currentTrack,
  onArtistClick
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('Rock');
  const [topSongs, setTopSongs] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadTopSongsByGenre = async (genre: string) => {
    setLoading(true);
    try {
      // Use the new edge function for better performance and consistent results
      const { data, error } = await supabase.functions.invoke('get-top-songs-by-genre', {
        body: { genre }
      });

      if (error) throw error;

      const edgeRows = (Array.isArray(data?.data) ? data.data : []) as TopSongRow[];
      const formattedSongs: Track[] = edgeRows.map((song) => ({
        id: song.id,
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        genre: song.genre || 'Other',
        duration: song.duration || 0,
        url: song.audio_url || '',
        user_id: song.user_id || undefined,
        brand_url: song.brand_url || undefined,
        image_url: song.image_url || song.cover_url || '/placeholder.svg',
        purchase_url: song.purchase_url || undefined,
        likes_count: Number(song.likes_count ?? song.like_count ?? song.likes ?? 0),
      }));

      // Ensure likes_count is always synced from DB even if edge payload omits it.
      const songIds = formattedSongs.map((song) => song.id);
      if (songIds.length === 0) {
        setTopSongs([]);
        return;
      }

      const { data: likesRows, error: likesError } = await supabase
        .from('songs')
        .select('id, likes_count')
        .in('id', songIds);

      if (likesError) {
        // Soft-fail to edge values so list still renders.
        setTopSongs(formattedSongs);
        return;
      }

      const likesMap = new Map(
        (likesRows || []).map((row) => [row.id, Number(row.likes_count ?? 0)])
      );

      const hydratedSongs = formattedSongs.map((song) => ({
        ...song,
        likes_count: likesMap.get(song.id) ?? song.likes_count ?? 0,
      }));

      setTopSongs(hydratedSongs);
    } catch (error: any) {
      console.error('Error loading top songs by genre:', error);
      toast({
        title: "Error",
        description: `Error loading top songs: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopSongsByGenre(selectedGenre);
  }, [selectedGenre]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black relative overflow-hidden -mx-4 px-2 sm:mx-0 sm:px-0">
      {/* Neon Concert Stage Lighting Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-cyan-400 rounded-full opacity-30 blur-3xl animate-pulse"></div>
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-green-400 rounded-full opacity-30 blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/4 left-1/2 w-24 h-24 bg-blue-400 rounded-full opacity-25 blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 left-1/6 w-28 h-28 bg-emerald-400 rounded-full opacity-25 blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
        <div className="absolute bottom-1/4 right-1/6 w-28 h-28 bg-teal-400 rounded-full opacity-25 blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>
      
      {/* Stage Spotlight Effect */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-80 h-80 bg-gradient-radial from-cyan-300/15 via-cyan-300/8 to-transparent rounded-full blur-xl"></div>
      
      <div className="relative z-10 space-y-3 p-3 sm:p-6 w-full max-w-none">
        {/* Compact Concert Stage Header */}
        <div className="text-center space-y-2">

          {/* Compact Concert Stage Text */}
          <div className="text-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent animate-pulse">
               🎧 LIVE ON STAGE 🎧

            </h1>
            <p className="text-gray-300 text-base">Tonight's Hottest {selectedGenre} Tracks</p>
            <p className="text-gray-400 text-sm">Select Your Genre</p>
          </div>
        </div>
        
        {/* Compact Concert Controls */}
        <div className="flex justify-center gap-3 items-center">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-cyan-400/40 shadow-lg">
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-44 bg-gray-800/90 border-cyan-500/60 text-white">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-cyan-500/60">
                {GENRES.map((genre) => (
                  <SelectItem key={genre} value={genre} className="text-white hover:bg-cyan-600/50">
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTopSongsByGenre(selectedGenre)}
            disabled={loading}
            className="bg-gradient-to-r from-cyan-500 to-green-500 hover:from-cyan-600 hover:to-green-600 border-0 text-black font-bold shadow-lg"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* Concert Stage Performance Area */}
        <div className="bg-gradient-to-b from-black/80 to-gray-900/80 backdrop-blur-sm rounded-xl border border-cyan-500/40 shadow-2xl p-3 sm:p-6 w-full">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                <span className="text-white text-base">Calculating rankings...</span>
                <div className="flex justify-center space-x-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          ) : (
            <TrackList
              tracks={topSongs}
              onPlayTrack={(track) => onPlayTrack(track, topSongs)}
              onLikeTrack={onLikeTrack}
              likedTracks={likedTracks}
              currentTrack={currentTrack}
              onTrackDeleted={() => loadTopSongsByGenre(selectedGenre)}
              selectedGenre={selectedGenre}
              onGenreSelect={setSelectedGenre}
              onSongAdded={() => loadTopSongsByGenre(selectedGenre)}
              onTrackUpdate={() => {}}
              onArtistClick={onArtistClick}
              showRanking={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TopGenreSongs;