import * as React from "react";
import type { MessageAttachmentType } from "@/lib/messages";
import { FileText, ExternalLink } from "lucide-react";

type MessageAttachmentViewProps = {
  url: string;
  type: MessageAttachmentType;
  mine: boolean;
};

export default function MessageAttachmentView({
  url,
  type,
  mine,
}: MessageAttachmentViewProps) {
  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img
          src={url}
          alt="Shared image"
          className="max-w-full max-h-48 rounded-lg border border-white/10 object-cover"
        />
      </a>
    );
  }

  if (type === "audio") {
    return (
      <audio controls src={url} className="mt-2 w-full max-w-xs" preload="metadata">
        <a href={url} target="_blank" rel="noopener noreferrer">
          Play audio
        </a>
      </audio>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 mt-2 text-xs underline ${
        mine ? "text-violet-100" : "text-cyan-300"
      }`}
    >
      {type === "file" ? (
        <FileText className="w-3.5 h-3.5" />
      ) : (
        <ExternalLink className="w-3.5 h-3.5" />
      )}
      {type === "file" ? "Open file" : "Open link"}
    </a>
  );
}
