import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  NOTIFICATIONS_CHANGED_EVENT,
  type AppNotification,
} from "@/lib/notifications";

const POLL_MS = 45_000;

export function useNotifications(enabled = true) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setItems([]);
      return;
    }

    try {
      const [count, list] = await Promise.all([
        fetchUnreadNotificationCount(),
        fetchNotifications(30, 0),
      ]);
      setUnreadCount(count);
      setItems(list);
      setError(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load notifications";
      setError(message);
    }
  }, [user]);

  const loadList = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await fetchNotifications(30, 0);
      setItems(list);
      setError(null);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load notifications";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (!enabled || !user) {
      setUnreadCount(0);
      setItems([]);
      return;
    }

    void refresh();

    const onChanged = () => void refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);

    const interval = window.setInterval(() => void refresh(), POLL_MS);

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      window.clearInterval(interval);
    };
  }, [enabled, user, refresh]);

  return {
    unreadCount,
    items,
    loading,
    error,
    refresh,
    loadList,
  };
}
