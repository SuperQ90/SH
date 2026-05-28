// Single shared Realtime channel for public.songs — avoids duplicate
// `songs-changes` subscriptions (cannot .on() after .subscribe()).

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const CHANNEL_NAME = "songs-changes";

let channel: RealtimeChannel | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn("[songsRealtime] listener error:", err);
    }
  });
}

function ensureChannel() {
  if (channel) return;

  channel = supabase
    .channel(CHANNEL_NAME)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "songs" },
      () => notifyListeners()
    )
    .subscribe();
}

function teardownChannel() {
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
}

/**
 * Subscribe to song table changes. Ref-counted: one channel for the whole app.
 * @returns unsubscribe function
 */
export function subscribeSongsChanges(onChange: () => void): () => void {
  listeners.add(onChange);
  ensureChannel();

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      teardownChannel();
    }
  };
}
