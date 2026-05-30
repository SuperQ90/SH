-- Direct messaging (artist↔fan, artist↔artist) with anti-spam controls
-- Run after hire_requests migration.

-- ---------------------------------------------------------------------------
-- Extend notifications constraints
-- ---------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_follower', 'song_comment', 'hire_request', 'new_message'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_entity_type_check
  CHECK (entity_type IN ('artist', 'song', 'hire_request', 'message_thread'));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_low_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  last_message_preview text,
  CONSTRAINT message_threads_ordered CHECK (user_low_id < user_high_id),
  CONSTRAINT message_threads_unique_pair UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX IF NOT EXISTS idx_message_threads_updated
  ON message_threads (updated_at DESC);

CREATE TABLE IF NOT EXISTS message_thread_participants (
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_participants_user
  ON message_thread_participants (user_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messages (thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_blocks (
  blocker_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CONSTRAINT message_blocks_no_self CHECK (blocker_user_id <> blocked_user_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view threads" ON message_threads;
CREATE POLICY "Participants can view threads"
  ON message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM message_thread_participants p
      WHERE p.thread_id = message_threads.id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can view own participant row" ON message_thread_participants;
CREATE POLICY "Participants can view own participant row"
  ON message_thread_participants FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update own read state" ON message_thread_participants;
CREATE POLICY "Participants can update own read state"
  ON message_thread_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Participants can view messages in thread" ON messages;
CREATE POLICY "Participants can view messages in thread"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM message_thread_participants p
      WHERE p.thread_id = messages.thread_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own blocks" ON message_blocks;
CREATE POLICY "Users manage own blocks"
  ON message_blocks FOR ALL
  USING (blocker_user_id = auth.uid())
  WITH CHECK (blocker_user_id = auth.uid());

-- Inserts on threads/messages/participants only via SECURITY DEFINER RPCs

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _message_users_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM message_blocks
    WHERE (blocker_user_id = p_a AND blocked_user_id = p_b)
       OR (blocker_user_id = p_b AND blocked_user_id = p_a)
  );
$$;

REVOKE ALL ON FUNCTION _message_users_blocked(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RPC: get or create thread with another user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_or_create_message_thread(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_thread_id uuid;
  v_new_threads int;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_other_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _message_users_blocked(v_me, p_other_user_id) THEN
    RAISE EXCEPTION 'You cannot message this user';
  END IF;

  v_low := LEAST(v_me, p_other_user_id);
  v_high := GREATEST(v_me, p_other_user_id);

  SELECT id INTO v_thread_id
  FROM message_threads
  WHERE user_low_id = v_low AND user_high_id = v_high;

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  -- Anti-spam: max 10 new threads per user per 24 hours
  SELECT count(*)::int INTO v_new_threads
  FROM message_threads t
  WHERE (t.user_low_id = v_me OR t.user_high_id = v_me)
    AND t.created_at > now() - interval '24 hours';

  IF v_new_threads >= 10 THEN
    RAISE EXCEPTION 'Too many new conversations today. Please try again later.';
  END IF;

  INSERT INTO message_threads (user_low_id, user_high_id)
  VALUES (v_low, v_high)
  RETURNING id INTO v_thread_id;

  INSERT INTO message_thread_participants (thread_id, user_id, last_read_at)
  VALUES
    (v_thread_id, v_me, now()),
    (v_thread_id, p_other_user_id, '1970-01-01'::timestamptz);

  RETURN v_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_message_thread(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_or_create_message_thread(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: send message
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
    SELECT 1 FROM message_thread_participants
    WHERE thread_id = p_thread_id AND user_id = v_me
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

  -- Global rate: 30 messages per hour
  SELECT count(*)::int INTO v_global_count
  FROM messages
  WHERE sender_user_id = v_me
    AND created_at > now() - interval '1 hour';

  IF v_global_count >= 30 THEN
    RAISE EXCEPTION 'You are sending messages too quickly. Please wait and try again.';
  END IF;

  -- Per-thread rate: 20 messages per hour to same conversation
  SELECT count(*)::int INTO v_thread_count
  FROM messages
  WHERE thread_id = p_thread_id
    AND sender_user_id = v_me
    AND created_at > now() - interval '1 hour';

  IF v_thread_count >= 20 THEN
    RAISE EXCEPTION 'Too many messages in this conversation. Please slow down.';
  END IF;

  -- Duplicate spam: same body within 60 seconds
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

  -- Sender has read their own message
  UPDATE message_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id AND user_id = v_me;

  -- Unread count for DMs is via get_unread_message_count (message inbox icon only)

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION send_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION send_message(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: list inbox threads
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RPC: list messages in a thread
-- ---------------------------------------------------------------------------
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
  sender_artist_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.thread_id,
    m.sender_user_id,
    m.body,
    m.created_at,
    COALESCE(ap.display_name, p.display_name, 'User') AS sender_display_name,
    ap.artist_slug AS sender_artist_slug
  FROM messages m
  INNER JOIN message_thread_participants part
    ON part.thread_id = m.thread_id AND part.user_id = auth.uid()
  LEFT JOIN profiles p ON p.id = m.sender_user_id
  LEFT JOIN artist_public_profiles ap ON ap.user_id = m.sender_user_id
  WHERE m.thread_id = p_thread_id
    AND auth.uid() IS NOT NULL
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
$$;

REVOKE ALL ON FUNCTION list_thread_messages(uuid, int, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_thread_messages(uuid, int, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: mark thread read + clear related notifications
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

REVOKE ALL ON FUNCTION mark_message_thread_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_message_thread_read(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: unread message count (distinct from notification bell)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_unread_message_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(sub.cnt), 0)::bigint
  FROM (
    SELECT count(*)::bigint AS cnt
    FROM message_thread_participants part
    INNER JOIN messages m
      ON m.thread_id = part.thread_id
      AND m.sender_user_id <> part.user_id
      AND m.created_at > part.last_read_at
    WHERE part.user_id = auth.uid()
    GROUP BY part.thread_id
  ) sub;
$$;

REVOKE ALL ON FUNCTION get_unread_message_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_unread_message_count() TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: block user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION block_message_user(p_blocked_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_blocked_user_id IS NULL OR p_blocked_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  INSERT INTO message_blocks (blocker_user_id, blocked_user_id)
  VALUES (auth.uid(), p_blocked_user_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION block_message_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION block_message_user(uuid) TO authenticated;
