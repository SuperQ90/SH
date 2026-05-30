// src/lib/notifications.ts
import { supabase } from "@/lib/supabase";

export const NOTIFICATIONS_CHANGED_EVENT = "airadio:notifications-changed";

export type NotificationType =
  | "new_follower"
  | "song_comment"
  | "hire_request";

export type AppNotification = {
  id: string;
  type: NotificationType;
  entity_type: "artist" | "song" | "hire_request";
  entity_id: string;
  actor_user_id: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  actor_display_name: string | null;
  actor_artist_slug: string | null;
};

export function emitNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notification_count");
  if (error) throw error;
  return Number(data) || 0;
}

export async function fetchNotifications(
  limit = 30,
  offset = 0
): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc("list_notifications", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    entity_type: row.entity_type as AppNotification["entity_type"],
    entity_id: row.entity_id,
    actor_user_id: row.actor_user_id ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    is_read: !!row.is_read,
    created_at: row.created_at,
    actor_display_name: row.actor_display_name ?? null,
    actor_artist_slug: row.actor_artist_slug ?? null,
  }));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
  emitNotificationsChanged();
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
  emitNotificationsChanged();
}

export async function markNotificationsReadForSong(songId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_notifications_read_for_song", {
    p_song_id: songId,
  });
  if (error) throw error;
  emitNotificationsChanged();
}

/** Human-readable line for notification list UI */
export function getNotificationMessage(n: AppNotification): string {
  const name = n.actor_display_name || "Someone";
  if (n.type === "new_follower") {
    return `${name} started following you`;
  }
  if (n.type === "hire_request") {
    const requester =
      (typeof n.payload.requester_name === "string" && n.payload.requester_name) ||
      name;
    const preview =
      typeof n.payload.brief_preview === "string" ? n.payload.brief_preview : "";
    if (preview) {
      return `${requester} wants you to make a song: ${preview}`;
    }
    return `${requester} sent a hire request — wants a custom song`;
  }
  const title =
    (typeof n.payload.song_title === "string" && n.payload.song_title) ||
    "your song";
  const preview =
    typeof n.payload.comment_preview === "string"
      ? n.payload.comment_preview
      : "";
  if (preview) {
    return `${name} commented on "${title}": ${preview}`;
  }
  return `${name} commented on "${title}"`;
}

/** Route path when user clicks a notification */
export function getNotificationHref(n: AppNotification): string {
  if (n.type === "hire_request") {
    return "/hire-requests";
  }
  if (n.type === "song_comment" && n.entity_type === "song") {
    return `/song/${n.entity_id}`;
  }
  if (n.type === "new_follower" && n.actor_artist_slug) {
    return `/artist/${n.actor_artist_slug}`;
  }
  if (n.type === "new_follower") {
    return "/following-artists";
  }
  return "/";
}
