import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2, UserPlus, MessageCircle, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getNotificationHref,
  getNotificationMessage,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

function formatRelativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  if (type === "new_follower") {
    return <UserPlus className="w-4 h-4 text-cyan-400 shrink-0" />;
  }
  if (type === "hire_request") {
    return <Music2 className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  return <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
}

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const { unreadCount, items, loading, error, refresh, loadList } =
    useNotifications(!!user);

  React.useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  if (!user) return null;

  const onItemClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // still navigate
      }
    }
    setOpen(false);
    navigate(getNotificationHref(n));
    void refresh();
  };

  const onMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      void refresh();
    } catch {
      // ignore
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative border-border hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,380px)] p-0 bg-slate-900 border-slate-700"
        align="end"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-cyan-300 text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-cyan-300"
              onClick={() => void onMarkAllRead()}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[min(60vh,400px)]">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-red-400">{error}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-3 hover:bg-slate-800/80 transition-colors flex gap-3 ${
                      !n.is_read ? "bg-cyan-950/30" : ""
                    }`}
                    onClick={() => void onItemClick(n)}
                  >
                    <NotificationIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100 leading-snug">
                        {getNotificationMessage(n)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t border-slate-700 px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-cyan-400 hover:text-cyan-300"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
