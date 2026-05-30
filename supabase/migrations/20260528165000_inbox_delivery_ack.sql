-- Mark messages delivered when recipient's inbox syncs (badge / header poll)
-- Run after receipt_ux migration.

CREATE OR REPLACE FUNCTION acknowledge_inbox_deliveries()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_count bigint;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE messages AS msg
  SET delivered_at = now()
  FROM message_thread_participants AS part
  WHERE part.thread_id = msg.thread_id
    AND part.user_id = v_me
    AND msg.sender_user_id <> v_me
    AND msg.delivered_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION acknowledge_inbox_deliveries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acknowledge_inbox_deliveries() TO authenticated;
