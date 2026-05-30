import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateMessageThread, canMessageUser } from "@/lib/messages";

interface MessageArtistButtonProps {
  otherUserId: string;
  otherName?: string;
  className?: string;
  onSignInRequired?: () => void;
}

const MessageArtistButton: React.FC<MessageArtistButtonProps> = ({
  otherUserId,
  otherName = "this user",
  className,
  onSignInRequired,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const isOwnProfile = user?.id === otherUserId;

  const onClick = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need an account to send messages.",
      });
      onSignInRequired?.();
      return;
    }

    if (isOwnProfile || loading) return;

    setLoading(true);
    try {
      const check = await canMessageUser(otherUserId);
      if (!check.allowed) {
        throw new Error(check.reason || "You cannot message this user");
      }

      const threadId = await getOrCreateMessageThread(otherUserId, "direct");
      navigate(`/messages/${threadId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not open conversation";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (isOwnProfile) return null;

  return (
    <Button
      type="button"
      size="sm"
      onClick={() => void onClick()}
      disabled={loading}
      className={
        className ??
        "w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
      }
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <MessageCircle className="w-4 h-4 mr-2" />
      )}
      Message
    </Button>
  );
};

export default MessageArtistButton;
