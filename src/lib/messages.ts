// src/lib/messages.ts
import { supabase } from "@/lib/supabase";

export const MESSAGES_CHANGED_EVENT = "airadio:messages-changed";

export type MessageThreadSummary = {
  thread_id: string;
  other_user_id: string;
  other_display_name: string;
  other_artist_slug: string | null;
  other_profile_image_url: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  updated_at: string;
  thread_kind: "direct" | "collaboration";
};

export type MessageAttachmentType = "image" | "audio" | "file" | "link";

export type MessageReceiptStatus = "sent" | "delivered" | "read";

export type ThreadMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  sender_display_name: string;
  sender_artist_slug: string | null;
  /** Set for outgoing messages only */
  receipt_status: MessageReceiptStatus | null;
  attachment_url: string | null;
  attachment_type: MessageAttachmentType | null;
};

export type MessagingPolicy =
  | "everyone"
  | "followers_only"
  | "mutual_follow"
  | "nobody";

export const MESSAGING_POLICY_LABELS: Record<MessagingPolicy, string> = {
  everyone: "Everyone can message me",
  followers_only: "Only my followers can message me",
  mutual_follow: "Only mutual follows can message me",
  nobody: "Nobody can start new conversations",
};

export type CanMessageResult = {
  allowed: boolean;
  reason: string | null;
};

/** Extract a useful message from Supabase RPC errors */
export function getMessageRpcError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) return parts.join(" — ");
    if (e.code === "42883") {
      return "Messaging is not set up on the server. Run the direct messages SQL migrations in Supabase.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Request failed";
}

export function emitMessagesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MESSAGES_CHANGED_EVENT));
  }
}

export async function getOrCreateMessageThread(
  otherUserId: string,
  threadKind: "direct" | "collaboration" = "direct"
): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_message_thread", {
    p_other_user_id: otherUserId,
    p_thread_kind: threadKind,
  });

  if (error) throw error;
  if (!data) throw new Error("Could not open conversation");
  return String(data);
}

export async function canMessageUser(
  otherUserId: string
): Promise<CanMessageResult> {
  const { data, error } = await supabase.rpc("can_message_user", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    reason: row?.reason ?? null,
  };
}

export async function updateMessagingPolicy(
  policy: MessagingPolicy
): Promise<void> {
  const { error } = await supabase.rpc("update_messaging_policy", {
    p_policy: policy,
  });
  if (error) throw error;
}

export type SendMessageOptions = {
  attachmentUrl?: string | null;
  attachmentType?: MessageAttachmentType | null;
};

export async function sendMessage(
  threadId: string,
  body: string,
  options?: SendMessageOptions
): Promise<string> {
  const { data, error } = await supabase.rpc("send_message", {
    p_thread_id: threadId,
    p_body: body,
    p_attachment_url: options?.attachmentUrl ?? null,
    p_attachment_type: options?.attachmentType ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error("Message was not sent");

  emitMessagesChanged();
  return String(data);
}

export async function listMessageThreads(
  limit = 50,
  offset = 0
): Promise<MessageThreadSummary[]> {
  const { data, error } = await supabase.rpc("list_message_threads", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    thread_id: row.thread_id,
    other_user_id: row.other_user_id,
    other_display_name: row.other_display_name ?? "User",
    other_artist_slug: row.other_artist_slug ?? null,
    other_profile_image_url: row.other_profile_image_url ?? null,
    last_message_preview: row.last_message_preview ?? null,
    last_message_at: row.last_message_at ?? null,
    unread_count: Number(row.unread_count) || 0,
    updated_at: row.updated_at,
    thread_kind:
      row.thread_kind === "collaboration" ? "collaboration" : "direct",
  }));
}

export type ListThreadMessagesOptions = {
  limit?: number;
  before?: string;
  /** When false, only refresh messages/receipts (sender tick poll). Default true. */
  markDelivered?: boolean;
};

export async function listThreadMessages(
  threadId: string,
  limitOrOptions: number | ListThreadMessagesOptions = 50,
  before?: string
): Promise<ThreadMessage[]> {
  const opts: ListThreadMessagesOptions =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions, before }
      : limitOrOptions;

  const { data, error } = await supabase.rpc("list_thread_messages", {
    p_thread_id: threadId,
    p_limit: opts.limit ?? 50,
    p_before: opts.before ?? null,
    p_mark_delivered: opts.markDelivered !== false,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    thread_id: row.thread_id,
    sender_user_id: row.sender_user_id,
    body: row.body,
    created_at: row.created_at,
    sender_display_name: row.sender_display_name ?? "User",
    sender_artist_slug: row.sender_artist_slug ?? null,
    receipt_status: parseReceiptStatus(row.receipt_status),
    attachment_url: row.attachment_url ?? null,
    attachment_type: parseAttachmentType(row.attachment_type),
  }));
}

function parseAttachmentType(
  value: unknown
): MessageAttachmentType | null {
  if (
    value === "image" ||
    value === "audio" ||
    value === "file" ||
    value === "link"
  ) {
    return value;
  }
  return null;
}

function parseReceiptStatus(
  value: unknown
): MessageReceiptStatus | null {
  if (value === "sent" || value === "delivered" || value === "read") {
    return value;
  }
  return null;
}

export async function markMessageThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_message_thread_read", {
    p_thread_id: threadId,
  });
  if (error) throw error;
  emitMessagesChanged();
}

export async function fetchUnreadMessageCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_message_count");
  if (error) throw error;
  return Number(data) || 0;
}

/** Mark incoming messages delivered when inbox syncs (header badge / messages list). */
export async function acknowledgeInboxDeliveries(): Promise<number> {
  const { data, error } = await supabase.rpc("acknowledge_inbox_deliveries");
  if (error) throw error;
  return Number(data) || 0;
}

/** Unread badge count + deliver pending messages for receipt ticks on sender side. */
export async function syncMessageInbox(): Promise<number> {
  await acknowledgeInboxDeliveries();
  return fetchUnreadMessageCount();
}

/** Inbox sync with thread list (for new-message toast copy). */
export async function syncMessageInboxWithThreads(): Promise<{
  unreadCount: number;
  threads: MessageThreadSummary[];
}> {
  try {
    await acknowledgeInboxDeliveries();
  } catch {
    // Delivery ack is optional until migration is applied
  }

  const [unreadCount, threads] = await Promise.all([
    fetchUnreadMessageCount(),
    listMessageThreads(30, 0),
  ]);
  return { unreadCount, threads };
}

export async function blockMessageUser(blockedUserId: string): Promise<void> {
  const { error } = await supabase.rpc("block_message_user", {
    p_blocked_user_id: blockedUserId,
  });
  if (error) throw error;
}
