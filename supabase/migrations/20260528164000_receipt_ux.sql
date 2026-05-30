-- Receipt UX: optional delivery ack on list + clearer read vs delivered timing
-- Run after fix_thread_id_ambiguous migration.

DROP FUNCTION IF EXISTS list_thread_messages(uuid, int, timestamptz, boolean);
DROP FUNCTION IF EXISTS list_thread_messages(uuid, int, timestamptz);

CREATE OR REPLACE FUNCTION list_thread_messages(
  p_thread_id uuid,
  p_limit int DEFAULT 50,
  p_before timestamptz DEFAULT NULL,
  p_mark_delivered boolean DEFAULT true
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

  -- Delivered = recipient fetched the thread (skip when sender polls for tick updates only)
  IF COALESCE(p_mark_delivered, true) THEN
    UPDATE messages AS msg
    SET delivered_at = now()
    WHERE msg.thread_id = p_thread_id
      AND msg.sender_user_id <> v_me
      AND msg.delivered_at IS NULL;
  END IF;

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

REVOKE ALL ON FUNCTION list_thread_messages(uuid, int, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_thread_messages(uuid, int, timestamptz, boolean) TO authenticated;
