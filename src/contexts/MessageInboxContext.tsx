import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";

type MessageInboxContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const MessageInboxContext = React.createContext<MessageInboxContextValue>({
  unreadCount: 0,
  refresh: async () => {},
});

export function MessageInboxProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { unreadCount, refresh } = useMessages(!!user, true);

  const value = React.useMemo(
    () => ({ unreadCount, refresh }),
    [unreadCount, refresh]
  );

  return (
    <MessageInboxContext.Provider value={value}>
      {children}
    </MessageInboxContext.Provider>
  );
}

export function useMessageInbox() {
  return React.useContext(MessageInboxContext);
}
