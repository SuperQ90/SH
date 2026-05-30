-- Hire requests ("Want a song? Hire Me") + notification type extension
-- Run after notifications migration.

-- ---------------------------------------------------------------------------
-- Extend notifications constraints for hire_request
-- ---------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_follower', 'song_comment', 'hire_request'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_entity_type_check
  CHECK (entity_type IN ('artist', 'song', 'hire_request'));

-- ---------------------------------------------------------------------------
-- hire_requests table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hire_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  brief text NOT NULL,
  budget text,
  deadline date,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'accepted', 'declined', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hire_requests_no_self CHECK (requester_user_id <> artist_user_id)
);

CREATE INDEX IF NOT EXISTS idx_hire_requests_artist_status
  ON hire_requests (artist_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hire_requests_requester
  ON hire_requests (requester_user_id, created_at DESC);

ALTER TABLE hire_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Artists view received hire requests" ON hire_requests;
CREATE POLICY "Artists view received hire requests"
  ON hire_requests FOR SELECT
  USING (artist_user_id = auth.uid());

DROP POLICY IF EXISTS "Requesters view own hire requests" ON hire_requests;
CREATE POLICY "Requesters view own hire requests"
  ON hire_requests FOR SELECT
  USING (requester_user_id = auth.uid());

DROP POLICY IF EXISTS "Artists update received hire requests" ON hire_requests;
CREATE POLICY "Artists update received hire requests"
  ON hire_requests FOR UPDATE
  USING (artist_user_id = auth.uid())
  WITH CHECK (artist_user_id = auth.uid());

-- Inserts only via submit_hire_request RPC (SECURITY DEFINER)

-- ---------------------------------------------------------------------------
-- RPC: submit hire request + notify artist
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_hire_request(
  p_artist_user_id uuid,
  p_requester_name text,
  p_requester_email text,
  p_requester_phone text DEFAULT NULL,
  p_brief text DEFAULT NULL,
  p_budget text DEFAULT NULL,
  p_deadline date DEFAULT NULL
)
RETURNS TABLE(hire_request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid := auth.uid();
  v_name text;
  v_email text;
  v_brief text;
  v_new_id uuid;
  v_recent_count int;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_artist_user_id IS NULL THEN
    RAISE EXCEPTION 'Artist is required';
  END IF;

  IF p_artist_user_id = v_requester THEN
    RAISE EXCEPTION 'Cannot send a hire request to yourself';
  END IF;

  v_name := trim(COALESCE(p_requester_name, ''));
  v_email := trim(lower(COALESCE(p_requester_email, '')));
  v_brief := trim(COALESCE(p_brief, ''));

  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Please enter your name';
  END IF;

  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address';
  END IF;

  IF length(v_brief) < 10 THEN
    RAISE EXCEPTION 'Please describe what song you want (at least 10 characters)';
  END IF;

  IF length(v_brief) > 2000 THEN
    RAISE EXCEPTION 'Brief is too long (max 2000 characters)';
  END IF;

  -- Simple anti-spam: max 5 requests per requester→artist per 24h
  SELECT count(*)::int INTO v_recent_count
  FROM hire_requests
  WHERE requester_user_id = v_requester
    AND artist_user_id = p_artist_user_id
    AND created_at > now() - interval '24 hours';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many requests to this artist recently. Please try again later.';
  END IF;

  INSERT INTO hire_requests (
    artist_user_id,
    requester_user_id,
    requester_name,
    requester_email,
    requester_phone,
    brief,
    budget,
    deadline
  )
  VALUES (
    p_artist_user_id,
    v_requester,
    v_name,
    v_email,
    NULLIF(trim(COALESCE(p_requester_phone, '')), ''),
    v_brief,
    NULLIF(trim(COALESCE(p_budget, '')), ''),
    p_deadline
  )
  RETURNING id INTO v_new_id;

  PERFORM internal_create_notification(
    p_artist_user_id,
    v_requester,
    'hire_request',
    'hire_request',
    v_new_id,
    jsonb_build_object(
      'requester_name', v_name,
      'requester_email', v_email,
      'brief_preview', left(v_brief, 120) || CASE WHEN length(v_brief) > 120 THEN '…' ELSE '' END,
      'hire_request_id', v_new_id
    )
  );

  hire_request_id := v_new_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION submit_hire_request(uuid, text, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_hire_request(uuid, text, text, text, text, text, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: artist updates request status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_hire_request_status(
  p_hire_request_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('new', 'in_review', 'accepted', 'declined', 'completed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE hire_requests
  SET status = p_status,
      updated_at = now()
  WHERE id = p_hire_request_id
    AND artist_user_id = auth.uid();

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION update_hire_request_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_hire_request_status(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: list received (artist) / sent (requester)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hire_requests_received()
RETURNS SETOF hire_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM hire_requests
  WHERE artist_user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION list_hire_requests_received() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_hire_requests_received() TO authenticated;

CREATE OR REPLACE FUNCTION list_hire_requests_sent()
RETURNS SETOF hire_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM hire_requests
  WHERE requester_user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION list_hire_requests_sent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_hire_requests_sent() TO authenticated;
