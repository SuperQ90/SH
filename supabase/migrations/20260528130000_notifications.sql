-- Notifications: new follower + song comment
-- Run in Supabase SQL Editor after artist_follows migration.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('new_follower', 'song_comment')),
  entity_type text NOT NULL CHECK (entity_type IN ('artist', 'song')),
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients can view own notifications" ON notifications;
CREATE POLICY "Recipients can view own notifications"
  ON notifications FOR SELECT
  USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can update own notifications" ON notifications;
CREATE POLICY "Recipients can update own notifications"
  ON notifications FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- No client INSERT/DELETE policies — rows created by SECURITY DEFINER functions/triggers only.

-- ---------------------------------------------------------------------------
-- Internal helper (service role / triggers / RPC only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internal_create_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_recipient IS NULL OR p_type IS NULL OR p_entity_type IS NULL OR p_entity_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_actor IS NOT NULL AND p_actor = p_recipient THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (
    recipient_user_id,
    actor_user_id,
    type,
    entity_type,
    entity_id,
    payload
  )
  VALUES (
    p_recipient,
    p_actor,
    p_type,
    p_entity_type,
    p_entity_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION internal_create_notification(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Trigger: new song comment → notify song owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_on_song_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_commenter uuid;
  v_title text;
  v_preview text;
BEGIN
  v_commenter := COALESCE(NEW.user_id, auth.uid());

  SELECT s.user_id, s.title
  INTO v_owner, v_title
  FROM songs s
  WHERE s.id = NEW.song_id;

  IF v_owner IS NULL OR v_commenter IS NULL OR v_owner = v_commenter THEN
    RETURN NEW;
  END IF;

  v_preview := left(trim(NEW.body), 120);
  IF length(trim(NEW.body)) > 120 THEN
    v_preview := v_preview || '…';
  END IF;

  PERFORM internal_create_notification(
    v_owner,
    v_commenter,
    'song_comment',
    'song',
    NEW.song_id,
    jsonb_build_object(
      'song_title', COALESCE(v_title, 'your song'),
      'comment_id', NEW.id,
      'comment_preview', v_preview
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_song_comment ON song_comments;
CREATE TRIGGER trg_notify_on_song_comment
  AFTER INSERT ON song_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_song_comment();

-- ---------------------------------------------------------------------------
-- Replace toggle_artist_follow: notify artist on new follow
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
  v_follower_name text;
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

    SELECT COALESCE(p.display_name, p.email, 'Someone')
    INTO v_follower_name
    FROM profiles p
    WHERE p.id = v_follower;

    PERFORM internal_create_notification(
      p_artist_user_id,
      v_follower,
      'new_follower',
      'artist',
      p_artist_user_id,
      jsonb_build_object('follower_display_name', v_follower_name)
    );

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

-- ---------------------------------------------------------------------------
-- RPC: unread count
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
    AND is_read = false;
$$;

REVOKE ALL ON FUNCTION get_unread_notification_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: list notifications (with actor profile hints)
-- ---------------------------------------------------------------------------
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
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION list_notifications(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_notifications(int, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: mark one / all read
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE notifications
  SET is_read = true
  WHERE id = p_notification_id
    AND recipient_user_id = auth.uid();

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE notifications
  SET is_read = true
  WHERE recipient_user_id = auth.uid()
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;

-- Mark song-comment notifications read when artist opens a song (optional sync with song_comment_reads)
CREATE OR REPLACE FUNCTION mark_notifications_read_for_song(p_song_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR p_song_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE notifications
  SET is_read = true
  WHERE recipient_user_id = auth.uid()
    AND type = 'song_comment'
    AND entity_type = 'song'
    AND entity_id = p_song_id
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION mark_notifications_read_for_song(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_notifications_read_for_song(uuid) TO authenticated;
