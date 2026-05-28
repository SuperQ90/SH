// src/lib/rpc.ts
import { supabase } from "@/lib/supabase";

export type MoveSongRow = {
  playlist_id: string;
  song_id: string;
  position: number;
};

/**
 * Move a song up or down within a playlist (server-side swap).
 */
export async function moveSong(
  playlistId: string,
  songId: string,
  direction: "up" | "down"
): Promise<MoveSongRow[] | null> {
  const { data, error } = await supabase.rpc("move_song", {
    p_playlist_id: playlistId,
    p_song_id: songId,
    p_direction: direction,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data as MoveSongRow[]) ?? null;
}

/**
 * Remove a song from a playlist and resequence positions.
 */
export async function removeSong(
  playlistId: string,
  songId: string
): Promise<MoveSongRow[] | null> {
  const { data, error } = await supabase.rpc("remove_song", {
    p_playlist_id: playlistId,
    p_song_id: songId,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data as MoveSongRow[]) ?? null;
}
