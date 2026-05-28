export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PlaylistSong {
  id: string;
  playlist_id: string;
  song_id: string;
  position: number;
  added_at: string;
}

export interface PlaylistWithSongs extends Playlist {
  songs: Array<{
    id: string;
    title: string;
    artist: string;
    genre: string;
    file_url: string;
    position: number;
  }>;
}