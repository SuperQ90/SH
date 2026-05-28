import { useEffect, useRef } from "react";
import { subscribeSongsChanges } from "@/lib/songsRealtime";

/**
 * Listen for Supabase Realtime changes on `songs` and call `onRefresh`.
 * Uses a single shared channel — safe to call from one page-level component only.
 */
export function useAutoRefresh(onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    return subscribeSongsChanges(() => {
      onRefreshRef.current();
    });
  }, []);

  const forceRefresh = () => {
    onRefreshRef.current();
  };

  return { forceRefresh };
}
