/**
 * Supabase Realtime (WebSocket) for direct messages.
 * RLS on messages / threads limits events to the signed-in user's conversations.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const INBOX_CHANNEL = "messages-inbox";
const NOTIFY_DEBOUNCE_MS = 120;

type Listener = () => void;

let inboxChannel: RealtimeChannel | null = null;
const inboxListeners = new Set<Listener>();

const threadChannels = new Map<
  string,
  { channel: RealtimeChannel; listeners: Set<Listener> }
>();

let notifyTimer: ReturnType<typeof setTimeout> | null = null;
const pendingInbox = new Set<Listener>();
const pendingThread = new Map<string, Set<Listener>>();

function scheduleInboxNotify() {
  inboxListeners.forEach((fn) => pendingInbox.add(fn));
  scheduleFlush();
}

function scheduleThreadNotify(threadId: string) {
  const entry = threadChannels.get(threadId);
  if (!entry) return;
  let batch = pendingThread.get(threadId);
  if (!batch) {
    batch = new Set();
    pendingThread.set(threadId, batch);
  }
  entry.listeners.forEach((fn) => batch!.add(fn));
  scheduleFlush();
}

function scheduleFlush() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    pendingInbox.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn("[messagesRealtime] inbox listener error:", err);
      }
    });
    pendingInbox.clear();

    pendingThread.forEach((listeners) => {
      listeners.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          console.warn("[messagesRealtime] thread listener error:", err);
        }
      });
    });
    pendingThread.clear();
  }, NOTIFY_DEBOUNCE_MS);
}

function ensureInboxChannel() {
  if (inboxChannel) return;

  inboxChannel = supabase
    .channel(INBOX_CHANNEL)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      () => scheduleInboxNotify()
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      () => scheduleInboxNotify()
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "message_threads" },
      () => scheduleInboxNotify()
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "message_thread_participants" },
      () => scheduleInboxNotify()
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("[messagesRealtime] inbox channel error");
      }
    });
}

function teardownInboxChannel() {
  if (!inboxChannel) return;
  void supabase.removeChannel(inboxChannel);
  inboxChannel = null;
}

function ensureThreadChannel(threadId: string) {
  if (threadChannels.has(threadId)) return;

  const listeners = new Set<Listener>();
  const filter = `thread_id=eq.${threadId}`;

  const channel = supabase
    .channel(`messages-thread:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter,
      },
      () => scheduleThreadNotify(threadId)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter,
      },
      () => scheduleThreadNotify(threadId)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "message_thread_participants",
        filter,
      },
      () => scheduleThreadNotify(threadId)
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("[messagesRealtime] thread channel error:", threadId);
      }
    });

  threadChannels.set(threadId, { channel, listeners });
}

function teardownThreadChannel(threadId: string) {
  const entry = threadChannels.get(threadId);
  if (!entry) return;
  void supabase.removeChannel(entry.channel);
  threadChannels.delete(threadId);
  pendingThread.delete(threadId);
}

/**
 * Inbox-wide changes (badge, toast, thread list). Ref-counted single channel.
 */
export function subscribeMessageInbox(onChange: Listener): () => void {
  inboxListeners.add(onChange);
  ensureInboxChannel();

  return () => {
    inboxListeners.delete(onChange);
    pendingInbox.delete(onChange);
    if (inboxListeners.size === 0) {
      teardownInboxChannel();
    }
  };
}

/**
 * Live updates for one conversation (new messages, delivered/read ticks).
 */
export function subscribeThreadMessages(
  threadId: string,
  onChange: Listener
): () => void {
  if (!threadId) return () => {};

  ensureThreadChannel(threadId);
  const entry = threadChannels.get(threadId)!;
  entry.listeners.add(onChange);

  return () => {
    entry.listeners.delete(onChange);
    const batch = pendingThread.get(threadId);
    batch?.delete(onChange);
    if (entry.listeners.size === 0) {
      teardownThreadChannel(threadId);
    }
  };
}
