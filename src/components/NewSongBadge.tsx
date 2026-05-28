import React from "react";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

interface NewSongBadgeProps {
  createdAt?: string | null;
  className?: string;
}

/**
 * Displays a neon-green "New Song" badge if the song was created within the last 72 hours.
 * Automatically hides after 72 hours have passed.
 */
const NewSongBadge: React.FC<NewSongBadgeProps> = ({ createdAt, className = "" }) => {
  if (!createdAt) return null;

  const createdDate = new Date(createdAt);
  const now = new Date();
  const elapsed = now.getTime() - createdDate.getTime();

  if (elapsed > SEVENTY_TWO_HOURS_MS || elapsed < 0) return null;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-sm flex-shrink-0 ${className}`}
      style={{
        color: "#39ff14",
        background: "rgba(57, 255, 20, 0.12)",
        border: "1px solid rgba(57, 255, 20, 0.4)",
        textShadow: "0 0 6px rgba(57, 255, 20, 0.8), 0 0 12px rgba(57, 255, 20, 0.5)",
        boxShadow: "0 0 6px rgba(57, 255, 20, 0.25), inset 0 0 4px rgba(57, 255, 20, 0.1)",
      }}
    >
      New Song
    </span>
  );
};

export default NewSongBadge;
