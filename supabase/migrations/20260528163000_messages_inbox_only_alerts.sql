-- Direct messages: unread badge on message inbox only (not the bell)
-- Run after direct_messages migrations.

-- Clear existing message rows from the bell feed
UPDATE notifications
SET is_read = true
WHERE type = 'new_message'
  AND is_read = false;

-- ---------------------------------------------------------------------------
-- send_message: do not create bell notifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_message(p_thread_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_body text;
  v_other uuid;
  v_msg_id uuid;
  v_global_count int;
  v_thread_count int;
  v_dup boolean;
  v_preview text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_thread_id IS NULL THEN
    RAISE EXCEPTION 'Thread is required';
  END IF;

  v_body := trim(COALESCE(p_body, ''));

  IF length(v_body) < 1 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message is too long (max 4000 characters)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM message_thread_participants mtp
    WHERE mtp.thread_id = p_thread_id AND mtp.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT CASE
    WHEN t.user_low_id = v_me THEN t.user_high_id
    ELSE t.user_low_id
  END
  INTO v_other
  FROM message_threads t
  WHERE t.id = p_thread_id;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF _message_users_blocked(v_me, v_other) THEN
    RAISE EXCEPTION 'You cannot message this user';
  END IF;

  SELECT count(*)::int INTO v_global_count
  FROM messages
  WHERE sender_user_id = v_me
    AND created_at > now() - interval '1 hour';

  IF v_global_count >= 30 THEN
    RAISE EXCEPTION 'You are sending messages too quickly. Please wait and try again.';
  END IF;

  SELECT count(*)::int INTO v_thread_count
  FROM messages
  WHERE thread_id = p_thread_id
    AND sender_user_id = v_me
    AND created_at > now() - interval '1 hour';

  IF v_thread_count >= 20 THEN
    RAISE EXCEPTION 'Too many messages in this conversation. Please slow down.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM messages
    WHERE thread_id = p_thread_id
      AND sender_user_id = v_me
      AND body = v_body
      AND created_at > now() - interval '60 seconds'
  ) INTO v_dup;

  IF v_dup THEN
    RAISE EXCEPTION 'Duplicate message. Please wait before sending again.';
  END IF;

  INSERT INTO messages (thread_id, sender_user_id, body)
  VALUES (p_thread_id, v_me, v_body)
  RETURNING id INTO v_msg_id;

  v_preview := left(v_body, 120);
  IF length(v_body) > 120 THEN
    v_preview := v_preview || '…';
  END IF;

  UPDATE message_threads
  SET updated_at = now(),
      last_message_at = now(),
      last_message_preview = v_preview
  WHERE id = p_thread_id;

  UPDATE message_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id AND user_id = v_me;

  RETURN v_msg_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- mark_message_thread_read: inbox unread only (no bell sync)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_message_thread_read(p_thread_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE message_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- Bell: exclude direct messages from count and list
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM notifications
  WHERE recipient_user_id = auth.uid()
    AND is_read = false
    AND type <> 'new_message';
$$;

CREATE OR REPLACE FUNCTION list_notifications(
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  type text,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid,
  payload jsonb,
  is_read boolean,
  created_at timestamptz,
  actor_display_name text,
  actor_artist_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.type,
    n.entity_type,
    n.entity_id,
    n.actor_user_id,
    n.payload,
    n.is_read,
    n.created_at,
    COALESCE(ap.display_name, p.display_name, p.email, 'Someone') AS actor_display_name,
    ap.artist_slug AS actor_artist_slug
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_user_id
  LEFT JOIN artist_public_profiles ap ON ap.user_id = n.actor_user_id
  WHERE n.recipient_user_id = auth.uid()
    AND n.type <> 'new_message'
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
