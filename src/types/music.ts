export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  url: string;
  coverArt?: string;
  user_id?: string;
  audio_url?: string;
  cover_url?: string;
  brand_url?: string;
  image_url?: string;
  purchase_url?: string;

  /** Aggregated like count stored on `songs.likes_count` */
  likes_count?: number;

  /** Timestamp when the song was created/uploaded */
  created_at?: string;

}


export interface UserProfile {
  id: string;
  name: string;
  email: string;
  favoriteGenres: string[];
  createdAt: Date;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  genre: string;
  isPlaying: boolean;
}

export const GENRES = [
  'Acid Jazz',
  'Afrobeat',
  'Alternative',
  'Ambient',
  'Blues',
  'Bluegrass',
  'Breakbeat',
  'CCM',
  'Chillout',
  'Christian Djent',
  'Christian Metal',
  'Christian Rock',
  'Classical',
  'Comedy',
  'Country',
  'Dance',
  'Disco',
  'Drum and Bass',
  'Dub',
  'Dubstep',
  'Electronic',
  'Ethereal',
  'Experimental',
  'Folk',
  'Funk',
  'Garage',
  'German Schlager',
  'Gospel',
  'Goth',
  'Goth Metal',

  'Goth Rock',
  'Grime',
  'Hardcore',
  'Healing Frequency',
  'Hip Hop',
  'Holiday Music',
  'House',
  'Indie',
  'Industrial',
  'Jazz',
  'Jungle',
  'K-pop',
  'Latin',
  'Lo-Fi',
  'Melodic Metal',
  'Metal',
  'New Age',
  'Pop',
  'Power Metal',
  'Progressive',
  'Psychobilly',
  'Punk',

  'R&B',
  'Rap',
  'Reggae',
  'Rockabilly',
  'Rock',
  'Romantic',
  'Salsa',

  'SKA Punk',
  'Smooth Jazz',
  'Soft Rock',
  'Soul',
  'Southern Metal',
  'Southern Rock',
  'Stoner Rock',
  'Techno',
  'Trance',
  'Trap',
  'Trip Hop',
  'World'
] as const;


export type Genre = typeof GENRES[number];

