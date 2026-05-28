# Supabase Setup Instructions for AI Music Radio Station

## Project Connection Details
- **Project URL**: https://mpjdjmatvuahnpflzeni.supabase.co
- **Status**: Connected ✅

## Database Setup

Run the following SQL commands in your Supabase SQL Editor to set up the required tables and policies:

### 1. Create Tables

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  favorite_genres TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create songs table
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  duration INTEGER,
  file_url TEXT NOT NULL,
  cover_url TEXT,
  plays INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create playlist_songs junction table
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- Create user_likes table
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

-- Create listening_history table
CREATE TABLE IF NOT EXISTS listening_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Create Indexes for Performance

```sql
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_user_id ON user_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_user_id ON listening_history(user_id);
```

### 3. Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_history ENABLE ROW LEVEL SECURITY;
```

### 4. Create Security Policies

```sql
-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Songs policies
CREATE POLICY "Songs are viewable by everyone" 
  ON songs FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert songs" 
  ON songs FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Playlists policies
CREATE POLICY "Public playlists are viewable by everyone" 
  ON playlists FOR SELECT 
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can create own playlists" 
  ON playlists FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists" 
  ON playlists FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists" 
  ON playlists FOR DELETE 
  USING (auth.uid() = user_id);

-- Playlist songs policies
CREATE POLICY "Playlist songs viewable if playlist is viewable" 
  ON playlist_songs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND (playlists.is_public = true OR playlists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage songs in own playlists" 
  ON playlist_songs FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_songs.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );

-- User likes policies
CREATE POLICY "Likes are viewable by everyone" 
  ON user_likes FOR SELECT 
  USING (true);

CREATE POLICY "Users can manage own likes" 
  ON user_likes FOR ALL 
  USING (auth.uid() = user_id);

-- Listening history policies
CREATE POLICY "Users can view own history" 
  ON listening_history FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" 
  ON listening_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
```

### 5. Create Storage Buckets

Go to Storage in your Supabase dashboard and create these buckets:

1. **avatars** - For user profile pictures
2. **songs** - For music files
3. **covers** - For album/song cover images

Set the buckets to public if you want direct URL access, or keep them private for controlled access.

### 6. Insert Sample Data (Optional)

```sql
-- Insert sample songs
INSERT INTO songs (title, artist, album, genre, duration, file_url, cover_url) VALUES
  ('Electric Dreams', 'AI DJ', 'Synthetic Beats', 'Electronic', 240, '/sample1.mp3', '/cover1.jpg'),
  ('Neural Network', 'The Algorithms', 'Machine Learning', 'Electronic', 180, '/sample2.mp3', '/cover2.jpg'),
  ('Digital Love', 'Cyber Romance', 'Virtual Hearts', 'Pop', 210, '/sample3.mp3', '/cover3.jpg'),
  ('Rock the Code', 'Binary Band', 'Compiled', 'Rock', 195, '/sample4.mp3', '/cover4.jpg'),
  ('Jazz.exe', 'Smooth Operators', 'Runtime', 'Jazz', 260, '/sample5.mp3', '/cover5.jpg'),
  ('Hip Hop Algorithm', 'MC Turing', 'Computational Flow', 'Hip Hop', 220, '/sample6.mp3', '/cover6.jpg');
```

### 7. Artist Follows (Follow button + Followed Artists page)

Run the migration file `supabase/migrations/20260528120000_artist_follows.sql` in the Supabase SQL Editor. It creates:

- `artist_follows` table with RLS
- `get_artist_follower_count(uuid)` — public follower count
- `toggle_artist_follow(uuid)` — follow/unfollow for logged-in users

After applying, test from the app: artist page **Follow** button and **Profile → Stats → Followed Artists**.

### 8. Notifications (new follower + song comment)

Run `supabase/migrations/20260528130000_notifications.sql` in the Supabase SQL Editor (after artist follows migration). It creates:

- `notifications` table with RLS (read/update own only; inserts via triggers/RPC)
- Trigger on `song_comments` → notifies song owner
- Updated `toggle_artist_follow` → notifies artist on new follow
- RPCs: `get_unread_notification_count`, `list_notifications`, `mark_notification_read`, `mark_all_notifications_read`, `mark_notifications_read_for_song`

Test: header **bell** icon, follow an artist, comment on someone's song (while signed in as another user).

## Environment Variables

Make sure your `.env.local` file contains:

```env
VITE_SUPABASE_URL=https://mpjdjmatvuahnpflzeni.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wamRqbWF0dnVhaG5wZmx6ZW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NzY5MDMsImV4cCI6MjA3NTU1MjkwM30.8s3pHsLEVVG0qposHT5hI7hJEWIQ9LQGwXX4wJuZxOI
```

## Testing the Connection

1. Restart your development server: `npm run dev`
2. Open the browser console and check for any connection errors
3. Try signing up a new user
4. Check your Supabase dashboard to see if the user appears in Authentication

## Troubleshooting

- **Connection refused**: Check if the URL and API key are correct
- **Authentication errors**: Verify email confirmation is disabled in Auth settings
- **Permission denied**: Check RLS policies are correctly set up
- **CORS errors**: Add your local development URL to allowed origins in Supabase

Your AI Music Radio Station is now connected to your new Supabase project!