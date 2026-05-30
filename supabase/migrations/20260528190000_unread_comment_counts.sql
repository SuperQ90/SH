-- Unread song comment counts (replaces get-unread-comments Edge Function)
-- Run in Supabase SQL Editor, then Settings → API → Reload schema.

-- ---------------------------------------------------------------------------
-- song_comment_reads — tracks when a song owner last viewed comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS song_comment_reads (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_song_comment_reads_song
  ON song_comment_reads (song_id);

ALTER TABLE song_comment_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own comment reads" ON song_comment_reads;
CREATE POLICY "Owners manage own comment reads"
  ON song_comment_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- song_comments — base table (may already exist from famous.ai)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS song_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_comments_body_length CHECK (char_length(trim(body)) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_song_comments_song_created
  ON song_comments (song_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RPC: unread counts per song for the current user (song owner only)
-- Returns jsonb: { "song-uuid": 3, ... } — only songs with unread > 0
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_unread_comment_counts(p_song_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_song_ids IS NULL OR cardinality(p_song_ids) = 0 THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(sub.song_id::text, sub.cnt),
    '{}'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      c.song_id,
      count(*)::int AS cnt
    FROM song_comments c
    INNER JOIN songs s
      ON s.id = c.song_id
     AND s.user_id = v_me
    LEFT JOIN song_comment_reads r
      ON r.song_id = c.song_id
     AND r.user_id = v_me
    WHERE c.song_id = ANY(p_song_ids)
      AND c.user_id <> v_me
      AND c.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)
    GROUP BY c.song_id
    HAVING count(*) > 0
  ) sub;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_unread_comment_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_unread_comment_counts(uuid[]) TO authenticated;
