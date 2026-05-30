-- Enable Supabase Realtime (WebSocket) for direct messaging tables.
-- Run in SQL Editor after prior message migrations.

-- Full row data on UPDATE (needed for receipt / read-state events).
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE message_thread_participants REPLICA IDENTITY FULL;
ALTER TABLE message_threads REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_thread_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_thread_participants;
  END IF;
END $$;
