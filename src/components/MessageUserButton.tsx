import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateMessageThread, canMessageUser } from "@/lib/messages";

type MessageUserButtonProps = {
  otherUserId: string;
  otherName?: string;
  className?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "default";
};

/** Compact message action for lists (e.g. followed artists). */
const MessageUserButton: React.FC<MessageUserButtonProps> = ({
  otherUserId,
  otherName = "this user",
  className,
  size = "sm",
  variant = "outline",
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  if (!user || user.id === otherUserId) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const check = await canMessageUser(otherUserId);
      if (!check.allowed) {
        throw new Error(check.reason || "You cannot message this user");
      }
      const threadId = await getOrCreateMessageThread(otherUserId, "direct");
      navigate(`/messages/${threadId}`);
    } catch (err: unknown) {
      toast({
        title: "Cannot message",
        description:
          err instanceof Error ? err.message : `Could not message ${otherName}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={loading}
      onClick={(e) => void onClick(e)}
      aria-label={`Message ${otherName}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <MessageCircle className="w-4 h-4" />
      )}
    </Button>
  );
};

export default MessageUserButton;
