import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  listMessageThreads,
  syncMessageInbox,
  MESSAGES_CHANGED_EVENT,
  type MessageThreadSummary,
} from "@/lib/messages";
import { subscribeMessageInbox } from "@/lib/messagesRealtime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, MessageCircle, RefreshCw, Loader2, Handshake } from "lucide-react";

const DEFAULT_AVATAR = "/placeholder.svg";

function ThreadRow({ thread }: { thread: MessageThreadSummary }) {
  const preview =
    thread.last_message_preview ||
    (thread.last_message_at ? "" : "No messages yet — say hello");

  return (
    <Link to={`/messages/${thread.thread_id}`} className="block">
      <Card className="p-4 bg-black/40 border-white/10 hover:border-violet-500/40 transition-colors">
        <div className="flex gap-3">
          <img
            src={thread.other_profile_image_url || DEFAULT_AVATAR}
            alt=""
            className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/10"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-white truncate">
                {thread.other_display_name}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                {thread.thread_kind === "collaboration" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-500/40 text-emerald-300"
                  >
                    <Handshake className="w-3 h-3 mr-0.5" />
                    Collab
                  </Badge>
                )}
                {thread.unread_count > 0 && (
                  <Badge className="bg-violet-600">
                    {thread.unread_count > 99 ? "99+" : thread.unread_count}
                  </Badge>
                )}
              </div>
            </div>
            {thread.other_artist_slug && (
              <p className="text-xs text-cyan-400/80 truncate">
                @{thread.other_artist_slug}
              </p>
            )}
            {preview && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {preview}
              </p>
            )}
            {thread.last_message_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(thread.last_message_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [threads, setThreads] = React.useState<MessageThreadSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      await syncMessageInbox();
      const rows = await listMessageThreads();
      setThreads(rows);
    } catch (e: unknown) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    void load();

    const unsubscribeRealtime = subscribeMessageInbox(() => {
      if (document.visibilityState === "visible") void load(true);
    });

    const onChanged = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);

    return () => {
      unsubscribeRealtime();
      window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
    };
  }, [user, load]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Radio
            </Button>
            <h1 className="text-xl font-bold text-white">Messages</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Please sign in to view your messages.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 shrink-0"
            >
              <Home className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-violet-400" />
              Messages
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-white/20 shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-3">
        {error && (
          <Card className="p-4 border-red-500/30 bg-red-950/20 text-red-200">
            {error}
          </Card>
        )}

        {loading && threads.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : threads.length === 0 ? (
          <Card className="p-8 bg-black/40 border-white/10 text-center">
            <MessageCircle className="w-10 h-10 mx-auto text-violet-400/60 mb-3" />
            <p className="text-muted-foreground">
              No conversations yet. Visit an artist page and tap{" "}
              <strong className="text-white">Message</strong> to start chatting.
            </p>
          </Card>
        ) : (
          threads.map((t) => <ThreadRow key={t.thread_id} thread={t} />)
        )}
      </main>
    </div>
  );
};

export default MessagesPage;
