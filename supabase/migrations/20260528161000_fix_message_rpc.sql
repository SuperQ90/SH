-- Fix message load errors (run if conversation page shows "Failed to load conversation")
-- Safe to re-run. Run after 20260528150000_direct_messages.sql

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

DROP FUNCTION IF EXISTS list_thread_messages(uuid, int, timestamptz);

CREATE OR REPLACE FUNCTION list_thread_messages(
  p_thread_id uuid,
  p_limit int DEFAULT 50,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  thread_id uuid,
  sender_user_id uuid,
  body text,
  created_at timestamptz,
  sender_display_name text,
  sender_artist_slug text,
  receipt_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
  v_other_read timestamptz;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM message_thread_participants mtp
    WHERE mtp.thread_id = p_thread_id
      AND mtp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  UPDATE messages AS msg
  SET delivered_at = now()
  WHERE msg.thread_id = p_thread_id
    AND msg.sender_user_id <> v_me
    AND msg.delivered_at IS NULL;

  SELECT mtp.last_read_at
  INTO v_other_read
  FROM message_thread_participants AS mtp
  WHERE mtp.thread_id = p_thread_id
    AND mtp.user_id <> v_me
  LIMIT 1;

  RETURN QUERY
  SELECT
    m.id,
    m.thread_id,
    m.sender_user_id,
    m.body,
    m.created_at,
    COALESCE(ap.display_name, pr.display_name, 'User')::text AS sender_display_name,
    ap.artist_slug::text AS sender_artist_slug,
    (
      CASE
        WHEN m.sender_user_id = v_me THEN
          CASE
            WHEN v_other_read IS NOT NULL AND v_other_read >= m.created_at THEN 'read'
            WHEN m.delivered_at IS NOT NULL THEN 'delivered'
            ELSE 'sent'
          END
        ELSE NULL
      END
    )::text AS receipt_status
  FROM messages AS m
  LEFT JOIN profiles AS pr ON pr.id = m.sender_user_id
  LEFT JOIN artist_public_profiles AS ap ON ap.user_id = m.sender_user_id
  WHERE m.thread_id = p_thread_id
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$$;

REVOKE ALL ON FUNCTION list_thread_messages(uuid, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_thread_messages(uuid, int, timestamptz) TO authenticated;

-- Safer inbox list (avoid optional profiles columns)
CREATE OR REPLACE FUNCTION list_message_threads(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  thread_id uuid,
  other_user_id uuid,
  other_display_name text,
  other_artist_slug text,
  other_profile_image_url text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count bigint,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS thread_id,
    CASE
      WHEN t.user_low_id = auth.uid() THEN t.user_high_id
      ELSE t.user_low_id
    END AS other_user_id,
    COALESCE(ap.display_name, p.display_name, 'User') AS other_display_name,
    ap.artist_slug AS other_artist_slug,
    ap.profile_image_url AS other_profile_image_url,
    t.last_message_preview,
    t.last_message_at,
    (
      SELECT count(*)::bigint
      FROM messages m
      WHERE m.thread_id = t.id
        AND m.sender_user_id <> auth.uid()
        AND m.created_at > part.last_read_at
    ) AS unread_count,
    t.updated_at
  FROM message_threads t
  INNER JOIN message_thread_participants part
    ON part.thread_id = t.id AND part.user_id = auth.uid()
  LEFT JOIN profiles p ON p.id = CASE
    WHEN t.user_low_id = auth.uid() THEN t.user_high_id
    ELSE t.user_low_id
  END
  LEFT JOIN artist_public_profiles ap ON ap.user_id = CASE
    WHEN t.user_low_id = auth.uid() THEN t.user_high_id
    ELSE t.user_low_id
  END
  WHERE auth.uid() IS NOT NULL
  ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION list_message_threads(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_message_threads(int, int) TO authenticated;
