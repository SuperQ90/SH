import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  listMessageThreads,
  listThreadMessages,
  markMessageThreadRead,
  sendMessage,
  blockMessageUser,
  getMessageRpcError,
  type MessageThreadSummary,
  type ThreadMessage,
  type MessageReceiptStatus,
  MESSAGES_CHANGED_EVENT,
} from "@/lib/messages";
import { subscribeThreadMessages } from "@/lib/messagesRealtime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Home,
  ArrowLeft,
  Loader2,
  Send,
  Ban,
  Flag,
  Paperclip,
  Handshake,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageReceiptTicks from "@/components/MessageReceiptTicks";
import MessageAttachmentView from "@/components/MessageAttachmentView";
import ReportConversationDialog from "@/components/ReportConversationDialog";
import { uploadMessageAttachment } from "@/lib/messageMedia";
import { Badge } from "@/components/ui/badge";

const DEFAULT_AVATAR = "/placeholder.svg";
/** Fallback poll if Realtime WebSocket is unavailable */
const MESSAGE_POLL_FALLBACK_MS = 90_000;
/** Delay before "read" receipts (lets "delivered" show first) */
const READ_RECEIPT_DELAY_MS = 1_200;

function receiptForOwnMessage(
  m: ThreadMessage,
  pending = false
): MessageReceiptStatus {
  if (pending || m.id.startsWith("pending-")) return "sent";
  return m.receipt_status ?? "sent";
}

const MessageThreadPage: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [summary, setSummary] = React.useState<MessageThreadSummary | null>(
    null
  );
  const [messages, setMessages] = React.useState<ThreadMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [blocking, setBlocking] = React.useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = React.useState(false);
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [reportMessageId, setReportMessageId] = React.useState<string | null>(
    null
  );
  const [draft, setDraft] = React.useState("");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const listRef = React.useRef<HTMLDivElement>(null);
  const scrollSnapshotRef = React.useRef<{
    scrollTop: number;
    scrollHeight: number;
  } | null>(null);
  const isInitialLoadRef = React.useRef(true);
  const markReadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const incomingCountRef = React.useRef(0);

  const captureScroll = () => {
    const el = listRef.current;
    if (!el) return;
    scrollSnapshotRef.current = {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
    };
  };

  const restoreScroll = () => {
    const el = listRef.current;
    const snap = scrollSnapshotRef.current;
    if (!el || !snap) return;
    const heightDelta = el.scrollHeight - snap.scrollHeight;
    el.scrollTop = snap.scrollTop + heightDelta;
    scrollSnapshotRef.current = null;
  };

  const clearMarkReadTimer = () => {
    if (markReadTimerRef.current) {
      clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = null;
    }
  };

  /** Read receipts: only when user is actively viewing the thread */
  const scheduleMarkRead = React.useCallback(() => {
    if (!threadId || document.visibilityState !== "visible") return;

    clearMarkReadTimer();
    markReadTimerRef.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void markMessageThreadRead(threadId);
    }, READ_RECEIPT_DELAY_MS);
  }, [threadId]);

  const fetchMessages = React.useCallback(
    async (options: { markDelivered: boolean; preserveScroll: boolean }) => {
      if (!user || !threadId) return;

      if (options.preserveScroll) captureScroll();

      const msgs = await listThreadMessages(threadId, {
        limit: 80,
        markDelivered: options.markDelivered,
      });

      const incoming = msgs.filter((m) => m.sender_user_id !== user.id).length;
      const hadNewIncoming =
        incoming > incomingCountRef.current && !isInitialLoadRef.current;
      incomingCountRef.current = incoming;

      setMessages(msgs);

      if (options.markDelivered) {
        if (isInitialLoadRef.current || hadNewIncoming) {
          scheduleMarkRead();
        }
      }

      return msgs;
    },
    [user, threadId, scheduleMarkRead]
  );

  const loadThread = React.useCallback(async () => {
    if (!user || !threadId) return;

    try {
      await fetchMessages({ markDelivered: true, preserveScroll: false });

      try {
        const threads = await listMessageThreads(100, 0);
        setSummary(threads.find((t) => t.thread_id === threadId) ?? null);
      } catch {
        // optional header meta
      }
    } catch (e: unknown) {
      toast({
        title: "Could not load conversation",
        description: getMessageRpcError(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, [user, threadId, toast, fetchMessages]);

  /** Poll for new messages + receipt tick updates */
  const refreshMessages = React.useCallback(async () => {
    if (!user || !threadId || loading) return;
    if (document.visibilityState !== "visible") return;
    try {
      await fetchMessages({ markDelivered: true, preserveScroll: true });
    } catch {
      // silent poll failure
    }
  }, [user, threadId, loading, fetchMessages]);

  React.useLayoutEffect(() => {
    restoreScroll();
  }, [messages]);

  React.useEffect(() => {
    if (user && threadId) {
      isInitialLoadRef.current = true;
      incomingCountRef.current = 0;
      void loadThread();
    } else {
      setLoading(false);
    }

    return () => clearMarkReadTimer();
  }, [user, threadId, loadThread]);

  React.useEffect(() => {
    if (!user || !threadId) return;

    const unsubscribeRealtime = subscribeThreadMessages(threadId, () => {
      if (document.visibilityState === "visible") void refreshMessages();
    });

    const interval = window.setInterval(
      () => void refreshMessages(),
      MESSAGE_POLL_FALLBACK_MS
    );
    const onChanged = () => void refreshMessages();
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshMessages();
        scheduleMarkRead();
      } else {
        clearMarkReadTimer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsubscribeRealtime();
      window.clearInterval(interval);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, threadId, refreshMessages, scheduleMarkRead]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !user || sending) return;

    const body = draft.trim();
    if (!body && !pendingFile) return;

    const pendingId = `pending-${Date.now()}`;
    const optimistic: ThreadMessage = {
      id: pendingId,
      thread_id: threadId,
      sender_user_id: user.id,
      body: body || (pendingFile ? "📎 Attachment" : ""),
      created_at: new Date().toISOString(),
      sender_display_name: "You",
      sender_artist_slug: null,
      receipt_status: "sent",
      attachment_url: pendingFile ? URL.createObjectURL(pendingFile) : null,
      attachment_type: pendingFile
        ? pendingFile.type.startsWith("image/")
          ? "image"
          : pendingFile.type.startsWith("audio/")
            ? "audio"
            : "file"
        : null,
    };

    captureScroll();
    const fileToUpload = pendingFile;
    setDraft("");
    setPendingFile(null);
    setMessages((prev) => [optimistic, ...prev]);
    setSending(true);

    try {
      let attachmentUrl: string | undefined;
      let attachmentType: ThreadMessage["attachment_type"];

      if (fileToUpload) {
        const uploaded = await uploadMessageAttachment(fileToUpload, threadId);
        attachmentUrl = uploaded.url;
        attachmentType = uploaded.type;
      }

      await sendMessage(threadId, body, {
        attachmentUrl: attachmentUrl ?? null,
        attachmentType: attachmentType ?? null,
      });
      await markMessageThreadRead(threadId);
      await fetchMessages({ markDelivered: true, preserveScroll: true });
    } catch (err: unknown) {
      scrollSnapshotRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setDraft(body);
      if (fileToUpload) setPendingFile(fileToUpload);
      toast({
        title: "Could not send",
        description:
          err instanceof Error ? err.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum attachment size is 10 MB.",
        variant: "destructive",
      });
      return;
    }
    setPendingFile(file);
  };

  const openReport = (messageId?: string) => {
    setReportMessageId(messageId ?? null);
    setReportDialogOpen(true);
  };

  const confirmBlock = async () => {
    if (!summary || blocking) return;

    setBlocking(true);
    try {
      await blockMessageUser(summary.other_user_id);
      setBlockDialogOpen(false);
      toast({
        title: "User blocked",
        description: `${summary.other_display_name} can no longer message you.`,
      });
      navigate("/messages");
    } catch (err: unknown) {
      toast({
        title: "Could not block user",
        description:
          err instanceof Error ? err.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setBlocking(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-8">
        <Card className="p-8 bg-black/40 border-white/10 max-w-md mx-auto">
          <p className="text-muted-foreground">Please sign in to view messages.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </Card>
      </div>
    );
  }

  if (!threadId) {
    navigate("/messages", { replace: true });
    return null;
  }

  const title = summary?.other_display_name ?? "Conversation";
  const avatar = summary?.other_profile_image_url || DEFAULT_AVATAR;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="shrink-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-2xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/messages")}
            className="shrink-0 text-cyan-400"
            aria-label="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img
            src={avatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-white/10"
          />
          <div className="min-w-0 flex-1">
            {summary?.other_artist_slug ? (
              <Link
                to={`/artist/${summary.other_artist_slug}`}
                className="font-semibold text-white hover:text-cyan-300 truncate block"
              >
                {title}
              </Link>
            ) : (
              <p className="font-semibold text-white truncate">{title}</p>
            )}
            {summary?.thread_kind === "collaboration" && (
              <Badge className="mt-0.5 bg-emerald-600/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                <Handshake className="w-3 h-3 mr-1 inline" />
                Collaboration
              </Badge>
            )}
          </div>
          {summary && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-amber-400 shrink-0"
                title="Report conversation"
                aria-label="Report conversation"
                onClick={() => openReport()}
              >
                <Flag className="w-4 h-4" />
              </Button>
              <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={blocking}
                  className="text-muted-foreground hover:text-red-400 shrink-0"
                  title="Block user"
                  aria-label="Block user"
                >
                  {blocking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-900 border-white/10 text-slate-100">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">
                    Block {summary.other_display_name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-300">
                    They will not be able to send you messages. You can still
                    view your existing conversation history until you leave
                    this chat.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={blocking}
                    className="border-white/15 bg-transparent hover:bg-white/5"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={blocking}
                    onClick={(e) => {
                      e.preventDefault();
                      void confirmBlock();
                    }}
                  >
                    {blocking ? "Blocking…" : "Block user"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ReportConversationDialog
              open={reportDialogOpen}
              onOpenChange={setReportDialogOpen}
              threadId={threadId}
              reportedName={summary.other_display_name}
              messageId={reportMessageId}
            />
            </>
          )}
        </div>
      </header>

      <div
        ref={listRef}
        className="scrollbar-hide flex-1 min-h-0 overflow-y-auto flex flex-col-reverse gap-3 px-4 py-3 container mx-auto max-w-2xl w-full"
      >
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            No messages yet. Send the first message below.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_user_id === user.id;
            const pending = m.id.startsWith("pending-");
            return (
              <div
                key={m.id}
                className={`flex shrink-0 ${mine ? "justify-end" : "justify-start"} group`}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words relative",
                    mine
                      ? "bg-violet-600 text-white rounded-br-md"
                      : "bg-black/50 border border-white/10 text-slate-100 rounded-bl-md",
                    pending ? "opacity-80" : "",
                  ].join(" ")}
                >
                  {!mine && (
                    <p className="text-xs text-violet-300 mb-1 font-medium">
                      {m.sender_display_name}
                    </p>
                  )}
                  {m.body && <p>{m.body}</p>}
                  {m.attachment_url && m.attachment_type && (
                    <MessageAttachmentView
                      url={m.attachment_url}
                      type={m.attachment_type}
                      mine={mine}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1 mt-1 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span
                      className={`text-[10px] ${
                        mine ? "text-violet-200/70" : "text-muted-foreground"
                      }`}
                    >
                      {pending
                        ? "Sending…"
                        : new Date(m.created_at).toLocaleString()}
                    </span>
                    {mine && (
                      <MessageReceiptTicks
                        status={receiptForOwnMessage(m, pending)}
                      />
                    )}
                  </div>
                  {!mine && !pending && !m.id.startsWith("pending-") && (
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-white/10 rounded-full p-1 text-amber-400 hover:text-amber-300"
                      title="Report message"
                      aria-label="Report message"
                      onClick={() => openReport(m.id)}
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => void onSend(e)}
        className="shrink-0 border-t border-white/10 bg-slate-900/95 backdrop-blur px-4 py-3 container mx-auto max-w-2xl w-full"
      >
        {pendingFile && (
          <div className="mb-2 flex items-center gap-2 text-xs text-violet-200 bg-violet-950/40 border border-violet-500/20 rounded-md px-3 py-2">
            <Paperclip className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1">{pendingFile.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setPendingFile(null)}
            >
              Remove
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,application/pdf"
            className="hidden"
            onChange={onPickFile}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 border-white/15"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            maxLength={4000}
            className="resize-none bg-black/40 border-white/15 min-h-[52px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={sending || (!draft.trim() && !pendingFile)}
            className="shrink-0 bg-violet-600 hover:bg-violet-500"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Enter to send · Shift+Enter for new line · Images, audio, PDF up to 10 MB
        </p>
      </form>
    </div>
  );
};

export default MessageThreadPage;
