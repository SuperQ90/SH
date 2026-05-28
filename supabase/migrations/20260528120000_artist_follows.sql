-- Artist follow system: table, RLS, and RPC helpers
-- Run in Supabase SQL Editor (or via supabase db push) before using the frontend.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artist_follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_follows_no_self CHECK (follower_user_id <> artist_user_id),
  CONSTRAINT artist_follows_unique UNIQUE (follower_user_id, artist_user_id)
);

CREATE INDEX IF NOT EXISTS idx_artist_follows_follower ON artist_follows(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_artist_follows_artist ON artist_follows(artist_user_id);
CREATE INDEX IF NOT EXISTS idx_artist_follows_created_at ON artist_follows(created_at DESC);

ALTER TABLE artist_follows ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own follows" ON artist_follows;
CREATE POLICY "Users can view own follows"
  ON artist_follows FOR SELECT
  USING (follower_user_id = auth.uid());

DROP POLICY IF EXISTS "Artists can view their followers" ON artist_follows;
CREATE POLICY "Artists can view their followers"
  ON artist_follows FOR SELECT
  USING (artist_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can follow artists" ON artist_follows;
CREATE POLICY "Users can follow artists"
  ON artist_follows FOR INSERT
  WITH CHECK (
    follower_user_id = auth.uid()
    AND artist_user_id <> auth.uid()
  );

DROP POLICY IF EXISTS "Users can unfollow" ON artist_follows;
CREATE POLICY "Users can unfollow"
  ON artist_follows FOR DELETE
  USING (follower_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: public follower count (anon + authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_artist_follower_count(p_artist_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM artist_follows
  WHERE artist_user_id = p_artist_user_id;
$$;

REVOKE ALL ON FUNCTION get_artist_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_artist_follower_count(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: toggle follow (authenticated only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION toggle_artist_follow(p_artist_user_id uuid)
RETURNS TABLE(action text, followers_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follower uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_follower IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_artist_user_id IS NULL THEN
    RAISE EXCEPTION 'Artist user id is required';
  END IF;

  IF p_artist_user_id = v_follower THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM artist_follows
    WHERE follower_user_id = v_follower
      AND artist_user_id = p_artist_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM artist_follows
    WHERE follower_user_id = v_follower
      AND artist_user_id = p_artist_user_id;

    action := 'unfollowed';
  ELSE
    INSERT INTO artist_follows (follower_user_id, artist_user_id)
    VALUES (v_follower, p_artist_user_id);

    action := 'followed';
  END IF;

  followers_count := (
    SELECT count(*)::bigint
    FROM artist_follows
    WHERE artist_user_id = p_artist_user_id
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION toggle_artist_follow(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION toggle_artist_follow(uuid) TO authenticated;
