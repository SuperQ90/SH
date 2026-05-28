import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, ListMusic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Track } from '@/types/music';

interface PlaylistSelectorProps {
  onPlayPlaylist: (tracks: Track[]) => void;
}

interface PlaylistSong {
  position: number;
  songs: {
    id: string;
    title: string;
    artist: string;
    genre: string;
    audio_url: string;
    duration: number;
    created_at: string;
    user_id: string;
  };
}

interface Playlist {
  id: string;
  name: string;
  created_at: string;
  playlist_songs: PlaylistSong[];
}

export const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({ onPlayPlaylist }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user]);

  const fetchPlaylists = async () => {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          id, name, created_at,
          playlist_songs(
            position,
            songs(id, title, artist, genre, audio_url, duration, created_at, user_id)
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPlaylists(data || []);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      toast({ title: 'Error loading playlists', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const tracks: Track[] = playlist.playlist_songs
      .sort((a, b) => a.position - b.position)
      .map(ps => ({
        id: ps.songs.id,
        title: ps.songs.title,
        artist: ps.songs.artist,
        genre: ps.songs.genre,
        url: ps.songs.audio_url,
        duration: ps.songs.duration || 180
      }));
    
    if (tracks.length === 0) {
      toast({ title: 'Playlist is empty', variant: 'destructive' });
      return;
    }
    
    onPlayPlaylist(tracks);
    toast({ title: `Playing ${playlist.name}`, description: `${tracks.length} songs` });
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ListMusic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No playlists yet. Create your first playlist!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {playlists.map((playlist) => (
        <Card key={playlist.id} className="p-4 hover:bg-accent transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <ListMusic className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{playlist.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {playlist.playlist_songs.length} songs
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePlayPlaylist(playlist)}
              className="text-primary hover:bg-primary/10"
            >
              <Play className="w-4 h-4 mr-1" />
              Play All
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};