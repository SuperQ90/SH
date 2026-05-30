import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessageInbox } from "@/contexts/MessageInboxContext";

const MessagesLink: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useMessageInbox();

  if (!user) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="relative border-border text-violet-300 hover:text-violet-100 hover:bg-violet-500/10"
      aria-label="Messages"
      onClick={() => navigate("/messages")}
    >
      <MessageCircle className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
};

export default MessagesLink;
