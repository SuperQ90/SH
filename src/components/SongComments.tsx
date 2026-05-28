import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { MessageCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type CommentRow = {
  id: string;
  song_id: string;
  user_id: string;
  body: string;
  created_at: string;
  // from optional view join (if you create v_song_comments)
  display_name?: string | null;
  username?: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
};

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function bestAuthorName(c: CommentRow) {
  return (
    c.display_name?.trim() ||
    c.username?.trim() ||
    // last resort: short user id
    (c.user_id ? `User ${c.user_id.slice(0, 6)}` : "User")
  );
}

export default function SongComments({ songId }: { songId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [comments, setComments] = React.useState<CommentRow[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [posting, setPosting] = React.useState<boolean>(false);
  const [showAll, setShowAll] = React.useState<boolean>(false);
  const [text, setText] = React.useState<string>("");

  const fetchCount = React.useCallback(async () => {
    const { count, error } = await supabase
      .from("song_comments")
      .select("id", { count: "exact", head: true })
      .eq("song_id", songId);
    if (!error) setTotalCount(count ?? 0);
  }, [songId]);

  const fetchComments = React.useCallback(
    async (opts?: { all?: boolean }) => {
      const all = !!opts?.all;
      setLoading(true);
      try {
        // Prefer a richer view if you create it; otherwise fall back to base table.
        const source = "v_song_comments";

        // Try view first.
        const viewQuery = supabase
          .from(source)
          .select(
            "id, song_id, user_id, body, created_at, display_name, username, profile_image_url, avatar_url"
          )
          .eq("song_id", songId)
          .order("created_at", { ascending: false });

        const { data: viewData, error: viewError } = all
          ? await viewQuery.range(0, 99)
          : await viewQuery.limit(2);

        if (!viewError && viewData) {
          setComments((viewData as any[]) as CommentRow[]);
          return;
        }

        // Fallback: base table only (no author display info)
        const baseQuery = supabase
          .from("song_comments")
          .select("id, song_id, user_id, body, created_at")
          .eq("song_id", songId)
          .order("created_at", { ascending: false });

        const { data: baseData, error: baseError } = all
          ? await baseQuery.range(0, 99)
          : await baseQuery.limit(2);

        if (baseError) throw baseError;
        setComments(((baseData ?? []) as any[]) as CommentRow[]);
      } catch (e: any) {
        console.error("Failed to load comments:", e);
      } finally {
        setLoading(false);
      }
    },
    [songId]
  );

  React.useEffect(() => {
    setShowAll(false);
    setText("");
    void fetchCount();
    void fetchComments({ all: false });
  }, [songId, fetchComments, fetchCount]);

  const onPost = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to leave a comment.",
      });
      return;
    }

    const body = text.trim();
    if (!body) return;
    if (body.length > 1000) {
      toast({
        title: "Comment too long",
        description: "Please keep comments under 1000 characters.",
        variant: "destructive",
      });
      return;
    }

    if (posting) return;
    setPosting(true);
    try {
      // user_id defaults to auth.uid() on the column; don't send it.
      const { error } = await supabase
        .from("song_comments")
        .insert({ song_id: songId, body });
      if (error) throw error;

      setText("");
      await fetchCount();
      await fetchComments({ all: showAll });
    } catch (e: any) {
      const message = e?.message || "Unable to post comment";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const canShowMore = totalCount > 2;
  const hiddenCount = Math.max(totalCount - 2, 0);

  return (
    <Card className="mt-3 bg-black/30 border-white/10 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-white font-medium text-sm">Comments</span>
            {totalCount > 0 && (
              <span className="ml-2 text-gray-400 text-xs">({totalCount})</span>
            )}
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div className="mt-3">
        <Textarea
          placeholder={user ? "Write a comment..." : "Sign in to comment"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!user || posting}
          className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 resize-none min-h-[80px]"
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{text.length}/1000</span>
          <Button
            size="sm"
            onClick={onPost}
            disabled={!user || !text.trim() || posting}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {posting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Posting...
              </>
            ) : (
              "Post Comment"
            )}
          </Button>
        </div>
      </div>

      {/* Comments list */}
      {loading && comments.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="bg-black/20 rounded-lg p-3 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                {(c.profile_image_url || c.avatar_url) && (
                  <img
                    src={c.profile_image_url || c.avatar_url || ""}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <span className="text-cyan-400 text-sm font-medium">
                  {bestAuthorName(c)}
                </span>
                <span className="text-gray-500 text-xs">
                  {formatTimestamp(c.created_at)}
                </span>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap break-words">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Show more / Show less */}
      {canShowMore && (
        <div className="mt-3 text-center">
          {showAll ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAll(false);
                void fetchComments({ all: false });
              }}
              className="text-cyan-400 hover:text-cyan-300"
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              Show less
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAll(true);
                void fetchComments({ all: true });
              }}
              className="text-cyan-400 hover:text-cyan-300"
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              Show {hiddenCount} more comment{hiddenCount !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
