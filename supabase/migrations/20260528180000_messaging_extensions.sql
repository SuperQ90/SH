-- Messaging extensions: permissions, collaboration threads, attachments, reports
-- Run after messages_realtime migration.

-- ---------------------------------------------------------------------------
-- Profile messaging policy
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS messaging_policy text NOT NULL DEFAULT 'everyone';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_messaging_policy_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_messaging_policy_check
  CHECK (messaging_policy IN ('everyone', 'followers_only', 'mutual_follow', 'nobody'));

-- ---------------------------------------------------------------------------
-- Thread kind (direct vs collaboration)
-- ---------------------------------------------------------------------------
ALTER TABLE message_threads
  ADD COLUMN IF NOT EXISTS thread_kind text NOT NULL DEFAULT 'direct';

ALTER TABLE message_threads DROP CONSTRAINT IF EXISTS message_threads_kind_check;
ALTER TABLE message_threads ADD CONSTRAINT message_threads_kind_check
  CHECK (thread_kind IN ('direct', 'collaboration'));

-- ---------------------------------------------------------------------------
-- Message attachments
-- ---------------------------------------------------------------------------
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_attachment_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN ('image', 'audio', 'file', 'link')
  );

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_length;
ALTER TABLE messages ADD CONSTRAINT messages_body_or_attachment CHECK (
  (
    char_length(trim(COALESCE(body, ''))) >= 1
    AND char_length(body) <= 4000
  )
  OR (attachment_url IS NOT NULL AND char_length(trim(attachment_url)) >= 1)
);

-- ---------------------------------------------------------------------------
-- Message reports (moderation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES message_threads(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reports_reason_length CHECK (char_length(reason) >= 3 AND char_length(reason) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_message_reports_status
  ON message_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reports_reported
  ON message_reports (reported_user_id, created_at DESC);

ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters view own reports" ON message_reports;
CREATE POLICY "Reporters view own reports"
  ON message_reports FOR SELECT
  USING (reporter_user_id = auth.uid());

-- Inserts/updates via SECURITY DEFINER RPCs only

-- ---------------------------------------------------------------------------
-- Storage bucket for message attachments (public read URLs)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  true,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth users upload message attachments" ON storage.objects;
CREATE POLICY "Auth users upload message attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read message attachments" ON storage.objects;
CREATE POLICY "Public read message attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'message-attachments');

DROP POLICY IF EXISTS "Users delete own message attachments" ON storage.objects;
CREATE POLICY "Users delete own message attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _user_follows_artist(p_follower uuid, p_artist uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM artist_follows
    WHERE follower_user_id = p_follower
      AND artist_user_id = p_artist
  );
$$;

REVOKE ALL ON FUNCTION _user_follows_artist(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION _users_mutual_follow(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_follows_artist(p_a, p_b)
    AND _user_follows_artist(p_b, p_a);
$$;

REVOKE ALL ON FUNCTION _users_mutual_follow(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION _can_message_user(p_sender uuid, p_recipient uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy text;
BEGIN
  IF p_sender IS NULL OR p_recipient IS NULL OR p_sender = p_recipient THEN
    RETURN false;
  END IF;

  IF _message_users_blocked(p_sender, p_recipient) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(p.messaging_policy, 'everyone')
  INTO v_policy
  FROM profiles p
  WHERE p.id = p_recipient;

  IF v_policy IS NULL THEN
    v_policy := 'everyone';
  END IF;

  IF v_policy = 'nobody' THEN
    RETURN false;
  ELSIF v_policy = 'followers_only' THEN
    RETURN _user_follows_artist(p_sender, p_recipient);
  ELSIF v_policy = 'mutual_follow' THEN
    RETURN _users_mutual_follow(p_sender, p_recipient);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION _can_message_user(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RPC: check if current user can message someone (UI preflight)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_message_user(p_other_user_id uuid)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_policy text;
BEGIN
  IF v_me IS NULL THEN
    allowed := false;
    reason := 'Sign in to send messages';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    allowed := false;
    reason := 'Invalid user';
    RETURN NEXT;
    RETURN;
  END IF;

  IF _message_users_blocked(v_me, p_other_user_id) THEN
    allowed := false;
    reason := 'You cannot message this user';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(p.messaging_policy, 'everyone')
  INTO v_policy
  FROM profiles p
  WHERE p.id = p_other_user_id;

  IF v_policy = 'nobody' THEN
    allowed := false;
    reason := 'This user is not accepting messages';
    RETURN NEXT;
    RETURN;
  ELSIF v_policy = 'followers_only' AND NOT _user_follows_artist(v_me, p_other_user_id) THEN
    allowed := false;
    reason := 'Follow this artist to send a message';
    RETURN NEXT;
    RETURN;
  ELSIF v_policy = 'mutual_follow' AND NOT _users_mutual_follow(v_me, p_other_user_id) THEN
    allowed := false;
    reason := 'You must follow each other to message';
    RETURN NEXT;
    RETURN;
  END IF;

  allowed := true;
  reason := NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION can_message_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_message_user(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update own messaging policy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_messaging_policy(p_policy text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_policy NOT IN ('everyone', 'followers_only', 'mutual_follow', 'nobody') THEN
    RAISE EXCEPTION 'Invalid messaging policy';
  END IF;

  UPDATE profiles
  SET messaging_policy = p_policy,
      updated_at = now()
  WHERE id = auth.uid() OR user_id = auth.uid();

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION update_messaging_policy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_messaging_policy(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get or create thread (with kind + permission check)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_or_create_message_thread(uuid);

CREATE OR REPLACE FUNCTION get_or_create_message_thread(
  p_other_user_id uuid,
  p_thread_kind text DEFAULT 'direct'
)
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
  v_kind text;
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

  v_kind := CASE
    WHEN p_thread_kind = 'collaboration' THEN 'collaboration'
    ELSE 'direct'
  END;

  v_low := LEAST(v_me, p_other_user_id);
  v_high := GREATEST(v_me, p_other_user_id);

  SELECT id INTO v_thread_id
  FROM message_threads
  WHERE user_low_id = v_low AND user_high_id = v_high;

  IF v_thread_id IS NOT NULL THEN
    IF v_kind = 'collaboration' THEN
      UPDATE message_threads
      SET thread_kind = 'collaboration',
          updated_at = now()
      WHERE id = v_thread_id
        AND thread_kind <> 'collaboration';
    END IF;
    RETURN v_thread_id;
  END IF;

  IF NOT _can_message_user(v_me, p_other_user_id) THEN
    RAISE EXCEPTION 'This user does not accept messages from you';
  END IF;

  SELECT count(*)::int INTO v_new_threads
  FROM message_threads t
  WHERE (t.user_low_id = v_me OR t.user_high_id = v_me)
    AND t.created_at > now() - interval '24 hours';

  IF v_new_threads >= 10 THEN
    RAISE EXCEPTION 'Too many new conversations today. Please try again later.';
  END IF;

  INSERT INTO message_threads (user_low_id, user_high_id, thread_kind)
  VALUES (v_low, v_high, v_kind)
  RETURNING id INTO v_thread_id;

  INSERT INTO message_thread_participants (thread_id, user_id, last_read_at)
  VALUES
    (v_thread_id, v_me, now()),
    (v_thread_id, p_other_user_id, '1970-01-01'::timestamptz);

  RETURN v_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_message_thread(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_or_create_message_thread(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: send message (with optional attachment)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS send_message(uuid, text);

CREATE OR REPLACE FUNCTION send_message(
  p_thread_id uuid,
  p_body text,
  p_attachment_url text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_body text;
  v_url text;
  v_type text;
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
  v_url := trim(COALESCE(p_attachment_url, ''));
  v_type := NULLIF(trim(COALESCE(p_attachment_type, '')), '');

  IF length(v_body) < 1 AND length(v_url) < 1 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message is too long (max 4000 characters)';
  END IF;

  IF length(v_url) > 0 AND v_type IS NULL THEN
    RAISE EXCEPTION 'Attachment type is required when sending media';
  END IF;

  IF v_type IS NOT NULL AND v_type NOT IN ('image', 'audio', 'file', 'link') THEN
    RAISE EXCEPTION 'Invalid attachment type';
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

  IF length(v_body) >= 1 THEN
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
  END IF;

  INSERT INTO messages (thread_id, sender_user_id, body, attachment_url, attachment_type)
  VALUES (
    p_thread_id,
    v_me,
    CASE WHEN length(v_body) >= 1 THEN v_body ELSE '' END,
    NULLIF(v_url, ''),
    v_type
  )
  RETURNING id INTO v_msg_id;

  IF length(v_body) >= 1 THEN
    v_preview := left(v_body, 120);
    IF length(v_body) > 120 THEN
      v_preview := v_preview || '…';
    END IF;
  ELSIF v_type = 'image' THEN
    v_preview := '📷 Photo';
  ELSIF v_type = 'audio' THEN
    v_preview := '🎵 Audio';
  ELSIF v_type = 'file' THEN
    v_preview := '📎 File';
  ELSE
    v_preview := '🔗 Link';
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

REVOKE ALL ON FUNCTION send_message(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION send_message(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: list threads (include thread_kind)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS list_message_threads(int, int);

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
  updated_at timestamptz,
  thread_kind text
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
    t.updated_at,
    t.thread_kind
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
-- RPC: list messages (include attachments)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS list_thread_messages(uuid, int, timestamptz, boolean);

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
  receipt_status text,
  attachment_url text,
  attachment_type text
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
    )::text AS receipt_status,
    m.attachment_url,
    m.attachment_type
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

-- ---------------------------------------------------------------------------
-- RPC: submit message / conversation report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_message_report(
  p_message_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_reason text;
  v_msg record;
  v_recent int;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_reason := trim(COALESCE(p_reason, ''));
  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Please provide a reason';
  END IF;

  SELECT m.id, m.thread_id, m.sender_user_id
  INTO v_msg
  FROM messages m
  INNER JOIN message_thread_participants part
    ON part.thread_id = m.thread_id AND part.user_id = v_me
  WHERE m.id = p_message_id;

  IF v_msg.id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF v_msg.sender_user_id = v_me THEN
    RAISE EXCEPTION 'You cannot report your own message';
  END IF;

  SELECT count(*)::int INTO v_recent
  FROM message_reports
  WHERE reporter_user_id = v_me
    AND created_at > now() - interval '24 hours';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many reports today. Please try again later.';
  END IF;

  INSERT INTO message_reports (
    reporter_user_id,
    reported_user_id,
    message_id,
    thread_id,
    reason,
    details
  )
  VALUES (
    v_me,
    v_msg.sender_user_id,
    v_msg.id,
    v_msg.thread_id,
    v_reason,
    NULLIF(trim(COALESCE(p_details, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION submit_message_report(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_message_report(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION submit_conversation_report(
  p_thread_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_reason text;
  v_other uuid;
  v_recent int;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_reason := trim(COALESCE(p_reason, ''));
  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Please provide a reason';
  END IF;

  SELECT CASE
    WHEN t.user_low_id = v_me THEN t.user_high_id
    ELSE t.user_low_id
  END
  INTO v_other
  FROM message_threads t
  INNER JOIN message_thread_participants part
    ON part.thread_id = t.id AND part.user_id = v_me
  WHERE t.id = p_thread_id;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  SELECT count(*)::int INTO v_recent
  FROM message_reports
  WHERE reporter_user_id = v_me
    AND created_at > now() - interval '24 hours';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many reports today. Please try again later.';
  END IF;

  INSERT INTO message_reports (
    reporter_user_id,
    reported_user_id,
    thread_id,
    reason,
    details
  )
  VALUES (
    v_me,
    v_other,
    p_thread_id,
    v_reason,
    NULLIF(trim(COALESCE(p_details, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION submit_conversation_report(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_conversation_report(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs (message reports)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_list_message_reports(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  reporter_user_id uuid,
  reporter_email text,
  reported_user_id uuid,
  reported_email text,
  message_id uuid,
  thread_id uuid,
  reason text,
  details text,
  status text,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_role text;
  v_email text;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.role, p.email INTO v_role, v_email
  FROM profiles p
  WHERE p.id = v_admin OR p.user_id = v_admin
  LIMIT 1;

  IF v_role <> 'admin'
     AND COALESCE(v_email, '') <> 'mrutter@gmail.com'
     AND COALESCE(v_email, '') NOT LIKE '%@pledge.ai' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.reporter_user_id,
    pr.email AS reporter_email,
    r.reported_user_id,
    pd.email AS reported_email,
    r.message_id,
    r.thread_id,
    r.reason,
    r.details,
    r.status,
    r.admin_notes,
    r.created_at,
    r.updated_at
  FROM message_reports r
  LEFT JOIN profiles pr ON pr.id = r.reporter_user_id
  LEFT JOIN profiles pd ON pd.id = r.reported_user_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION admin_list_message_reports(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_message_reports(text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_resolve_message_report(
  p_report_id uuid,
  p_status text,
  p_admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_role text;
  v_email text;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('pending', 'reviewed', 'action_taken', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT p.role, p.email INTO v_role, v_email
  FROM profiles p
  WHERE p.id = v_admin OR p.user_id = v_admin
  LIMIT 1;

  IF v_role <> 'admin'
     AND COALESCE(v_email, '') <> 'mrutter@gmail.com'
     AND COALESCE(v_email, '') NOT LIKE '%@pledge.ai' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE message_reports
  SET status = p_status,
      admin_notes = NULLIF(trim(COALESCE(p_admin_notes, '')), ''),
      updated_at = now()
  WHERE id = p_report_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION admin_resolve_message_report(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_resolve_message_report(uuid, text, text) TO authenticated;
