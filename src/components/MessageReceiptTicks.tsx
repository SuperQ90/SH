import { Check, CheckCheck } from "lucide-react";

export type MessageReceiptStatus = "sent" | "delivered" | "read";

interface MessageReceiptTicksProps {
  status: MessageReceiptStatus;
}

/** WhatsApp-style ticks on the sender's message bubble */
export default function MessageReceiptTicks({ status }: MessageReceiptTicksProps) {
  if (status === "read") {
    return (
      <CheckCheck
        className="w-3.5 h-3.5 text-green-800 shrink-0"
        strokeWidth={2.5}
        aria-label="Read"
      />
    );
  }

  if (status === "delivered") {
    return (
      <CheckCheck
        className="w-3.5 h-3.5 text-white/90 shrink-0"
        strokeWidth={2.5}
        aria-label="Delivered"
      />
    );
  }

  return (
    <Check
      className="w-3.5 h-3.5 text-white/90 shrink-0"
      strokeWidth={2.5}
      aria-label="Sent"
    />
  );
}
