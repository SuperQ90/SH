import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getNotificationHref,
  getNotificationMessage,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Bell, CheckCheck, Loader2, UserPlus, MessageCircle } from "lucide-react";

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  if (type === "new_follower") {
    return <UserPlus className="w-5 h-5 text-cyan-400" />;
  }
  return <MessageCircle className="w-5 h-5 text-emerald-400" />;
}

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, error, unreadCount, refresh, loadList } =
    useNotifications(!!user);

  React.useEffect(() => {
    if (user) void loadList();
  }, [user, loadList]);

  const onItemClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // continue
      }
    }
    navigate(getNotificationHref(n));
    void refresh();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <h1 className="text-xl font-bold text-white">Notifications</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Please sign in to view notifications.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400"
            >
              <Home className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-400" />
              Notifications
              {unreadCount > 0 && (
                <span className="text-sm font-normal text-cyan-400">
                  ({unreadCount} unread)
                </span>
              )}
            </h1>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-cyan-400/40 text-cyan-300"
              onClick={() => void markAllNotificationsRead().then(() => refresh())}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {loading ? (
          <Card className="p-8 bg-black/40 border-white/10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </Card>
        ) : error ? (
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-red-400">{error}</p>
            <p className="text-sm text-gray-500 mt-2">
              Run migration{" "}
              <code className="text-cyan-400">20260528130000_notifications.sql</code>{" "}
              in Supabase SQL Editor.
            </p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-8 bg-black/40 border-white/10 text-center">
            <Bell className="w-12 h-12 text-cyan-500/40 mx-auto mb-4" />
            <p className="text-gray-300">You have no notifications yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <Card
                key={n.id}
                className={`p-4 bg-black/40 border-white/10 cursor-pointer hover:border-cyan-500/40 transition-colors ${
                  !n.is_read ? "border-cyan-500/30 bg-cyan-950/20" : ""
                }`}
                onClick={() => void onItemClick(n)}
              >
                <div className="flex gap-3">
                  <NotificationIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white leading-relaxed">
                      {getNotificationMessage(n)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default NotificationsPage;
