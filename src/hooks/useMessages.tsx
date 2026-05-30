import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  syncMessageInboxWithThreads,
  MESSAGES_CHANGED_EVENT,
  type MessageThreadSummary,
} from "@/lib/messages";
import { subscribeMessageInbox } from "@/lib/messagesRealtime";

/** Fallback poll if WebSocket disconnects */
const POLL_FALLBACK_MS = 90_000;

function pickNewestUnreadThread(
  threads: MessageThreadSummary[]
): MessageThreadSummary | null {
  const unread = threads.filter((t) => t.unread_count > 0);
  if (!unread.length) return null;

  return [...unread].sort((a, b) => {
    const at = a.last_message_at || a.updated_at;
    const bt = b.last_message_at || b.updated_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  })[0];
}

function isViewingThread(pathname: string, threadId: string): boolean {
  return pathname === `/messages/${threadId}`;
}

export function useMessages(enabled = true, showNewMessageToast = true) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = React.useState(0);

  const prevUnreadRef = React.useRef(0);
  const hasSyncedOnceRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      prevUnreadRef.current = 0;
      hasSyncedOnceRef.current = false;
      return;
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    try {
      const { unreadCount: count, threads } = await syncMessageInboxWithThreads();
      const prev = prevUnreadRef.current;

      if (
        showNewMessageToast &&
        hasSyncedOnceRef.current &&
        count > prev
      ) {
        const thread = pickNewestUnreadThread(threads);
        if (
          thread &&
          !isViewingThread(location.pathname, thread.thread_id)
        ) {
          const name = thread.other_display_name;
          const preview =
            thread.last_message_preview?.trim() || "Sent you a message";
          const threadId = thread.thread_id;

          const { dismiss } = toast({
            title: `New message from ${name}`,
            description: preview,
            className: "cursor-pointer",
            onClick: () => {
              navigate(`/messages/${threadId}`);
              dismiss();
            },
          });
        }
      }

      prevUnreadRef.current = count;
      hasSyncedOnceRef.current = true;
      setUnreadCount(count);
    } catch {
      // keep last count
    }
  }, [user, showNewMessageToast, toast, navigate, location.pathname]);

  React.useEffect(() => {
    if (!enabled || !user) {
      setUnreadCount(0);
      prevUnreadRef.current = 0;
      hasSyncedOnceRef.current = false;
      return;
    }

    void refresh();

    const unsubscribeRealtime = subscribeMessageInbox(() => {
      if (document.visibilityState === "visible") void refresh();
    });

    const interval = window.setInterval(() => void refresh(), POLL_FALLBACK_MS);

    const onChanged = () => void refresh();
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsubscribeRealtime();
      window.clearInterval(interval);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, user, refresh]);

  return { unreadCount, refresh };
}
