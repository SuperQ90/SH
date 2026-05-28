import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Headphones, Trash2, Plus } from 'lucide-react';
import { Track } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface FeaturedSong {
  id: string;
  position: number;
  song: Track;
}

export const FeaturedSongsManager: React.FC = () => {
  const [featuredSongs, setFeaturedSongs] = useState<FeaturedSong[]>([]);
  const [availableSongs, setAvailableSongs] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();

  const genres = [
    'Acid Jazz', 'Afrobeat', 'Alternative', 'Ambient', 'Blues', 'Bluegrass', 'Breakbeat', 'CCM', 'Chillout',
    'Christian Djent', 'Christian Metal', 'Christian Rock', 'Classical', 'Comedy', 'Country', 'Dance', 'Disco',
    'Drum and Bass', 'Dub', 'Dubstep', 'Electronic', 'Ethereal', 'Experimental', 'Folk', 'Funk',
    'Garage', 'Gospel', 'Goth', 'Goth Metal', 'Goth Rock', 'Grime', 'Hardcore', 'Healing Frequency', 'Hip Hop', 'Holiday Music', 'House',
    'Indie', 'Industrial', 'Jazz', 'Jungle', 'K-pop', 'Latin', 'Lo-Fi', 'Melodic Metal', 'Metal', 'New Age', 'Pop', 'Power Metal', 'Progressive',
    'Psychobilly', 'Punk', 'R&B', 'Rap', 'Reggae', 'Rockabilly', 'Rock', 'Romantic', 'Salsa', 'SKA Punk', 'Smooth Jazz', 'Soft Rock', 'Soul', 'Southern Metal', 'Southern Rock',
    'Stoner Rock', 'Techno', 'Trance', 'Trap', 'Trip Hop', 'World'
  ];



  // Filter songs based on selected genre
  const filteredSongs = selectedGenre && selectedGenre !== 'all'
    ? availableSongs.filter(song => song.genre === selectedGenre)
    : availableSongs;

  const isAdmin = user?.email === 'mrutter@gmail.com';

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [featuredResult, songsResult] = await Promise.all([
        supabase
          .from('featured_songs')
          .select(`
            id,
            position,
            song:songs(
              id,
              title,
              artist,
              genre,
              audio_url,
              image_url,
              purchase_url,
              created_at,
              user_id
            )
          `)
          .order('position'),
        supabase
          .from('songs')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (featuredResult.error) throw featuredResult.error;
      if (songsResult.error) throw songsResult.error;

      const formatted =
        featuredResult.data?.map(item => ({
          id: item.id,
          position: item.position,
          song: item.song as Track
        })) ?? [];

      setFeaturedSongs(formatted);
      setAvailableSongs(songsResult.data ?? []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔁 RPC version — atomic, conflict-free, respects RLS
  const addFeaturedSong = async () => {
    if (!selectedSong || !selectedPosition) return;
    try {
      const { error } = await supabase.rpc('put_featured_song', {
        p_song_id: selectedSong,
        p_position: parseInt(selectedPosition, 10),
      });
      if (error) throw error;

      toast({ title: 'Success', description: 'Featured song updated' });
      setSelectedSong('');
      setSelectedPosition('');
      fetchData();
    } catch (error) {
      console.error('Error updating featured song:', error);
      toast({
        title: 'Error',
        description: 'Failed to update featured song',
        variant: 'destructive',
      });
    }
  };

  const removeFeaturedSong = async (id: string) => {
    try {
      const { error } = await supabase
        .from('featured_songs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Featured song removed',
      });
      fetchData();
    } catch (error) {
      console.error('Error removing featured song:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove featured song',
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Featured Songs Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-cyan-400" />
          Featured Songs Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by genre (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {genres.map(genre => (
                <SelectItem key={genre} value={genre}>
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select value={selectedSong} onValueChange={setSelectedSong}>
            <SelectTrigger>
              <SelectValue placeholder="Select song" />
            </SelectTrigger>
            <SelectContent>
              {filteredSongs.map(song => (
                <SelectItem key={song.id} value={song.id}>
                  {song.title} - {song.artist} ({song.genre})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(pos => (
                <SelectItem key={pos} value={pos.toString()}>
                  Position {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={addFeaturedSong} disabled={!selectedSong || !selectedPosition}>
            <Plus className="w-4 h-4 mr-2" />
            Add Featured
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Current Featured Songs</h3>
          {featuredSongs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No featured songs set</p>
          ) : (
            featuredSongs.map(({ id, position, song }) => (
              <div key={id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">#{position}</Badge>
                  <div>
                    <p className="font-medium">{song.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {song.artist} • {song.genre}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => removeFeaturedSong(id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FeaturedSongsManager;
