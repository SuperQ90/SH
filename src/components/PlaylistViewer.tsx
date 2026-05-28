import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Shuffle, SkipForward, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Track } from '@/types/music';

interface PlaylistViewerProps {
  playlistId: string;
  onPlayTrack: (track: Track, playlist: Track[]) => void;
  onPlayPlaylist: (tracks: Track[]) => void;
  onClose: () => void;
}

interface PlaylistSong {
  id: string;
  position: number;
  songs: {
    id: string;
    title: string;
    artist: string;
    genre: string;
    audio_url: string;
    duration: number;
  };
}

export const PlaylistViewer: React.FC<PlaylistViewerProps> = ({
  playlistId,
  onPlayTrack,
  onPlayPlaylist,
  onClose
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [playlist, setPlaylist] = useState<any>(null);
  const [songs, setSongs] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaylistData();
  }, [playlistId]);

  const fetchPlaylistData = async () => {
    try {
      // Get playlist info
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();

      if (playlistError) throw playlistError;
      setPlaylist(playlistData);

      // Get playlist songs - fixed column name
      const { data: playlistSongs, error: songsError } = await supabase
        .from('playlist_songs')
        .select(`
          id,
          position,
          songs (
            id,
            title,
            artist,
            genre,
            audio_url,
            duration
          )
        `)
        .eq('playlist_id', playlistId)
        .order('position');

      if (songsError) throw songsError;

      const tracks: Track[] = (playlistSongs || []).map((item: PlaylistSong) => ({
        id: item.songs.id,
        title: item.songs.title,
        artist: item.songs.artist,
        genre: item.songs.genre,
        url: item.songs.audio_url,
        duration: item.songs.duration || 180
      }));

      setSongs(tracks);
    } catch (error) {
      console.error('Error fetching playlist:', error);
      toast({ title: 'Error loading playlist', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const playAll = () => {
    if (songs.length > 0) {
      onPlayPlaylist(songs);
    }
  };

  const playRandom = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      onPlayPlaylist(shuffled);
    }
  };

  const removeSong = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);

      if (error) throw error;
      
      toast({ title: 'Song removed from playlist' });
      fetchPlaylistData();
    } catch (error) {
      console.error('Error removing song:', error);
      toast({ title: 'Error removing song', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="p-4">Loading playlist...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{playlist?.name}</h2>
          <p className="text-muted-foreground">{songs.length} songs</p>
        </div>
        <div className="flex space-x-2">
          <Button size="sm" onClick={playAll} disabled={songs.length === 0}>
            <Play className="w-3 h-3 mr-1" />Play All
          </Button>
          <Button size="sm" onClick={playRandom} disabled={songs.length === 0}>
            <Shuffle className="w-3 h-3 mr-1" />Shuffle
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
        {songs.map((song, index) => (
          <Card key={song.id} className="hover:bg-accent/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground w-8">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-medium">{song.title}</h3>
                    <p className="text-sm text-muted-foreground">{song.artist}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPlayTrack(song, songs)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSong(song.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {songs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No songs in this playlist yet.
        </div>
      )}
    </div>
  );
};