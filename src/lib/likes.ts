// src/lib/likes.ts
// LIKES_HELPER_V1
import { supabase } from './supabase';

/**
 * Toggle like for a song by id using the Postgres function `toggle_like`.
 * Returns: [{ action: 'liked' | 'unliked', likes_count: number }]
 */
export async function toggleSongLike(songId: string) {
  const { data, error } = await supabase.rpc('toggle_like', { p_song_id: songId });
  if (error) throw error;
  return data;
}

/**
 * Check if the current user has liked a specific song.
 * Uses RLS; user must be logged in.
 * Returns true/false.
 */
export async function isSongLikedByMe(songId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('song_id', songId)
    .eq('user_id', userId);

  if (error) throw error;
  // head:true + count:'exact' returns count in meta; data is null, so use error? no.
  // With head:true, Supabase puts count on the response object:
  // @ts-ignore - supabase types don't expose count on this shape
  const liked = (data as unknown as any)?.length === 0 ? false : true;
  // Better: re-run without head to be safe:
  if ((data as any) === null) {
    const { data: row, error: e2 } = await supabase
      .from('likes')
      .select('id')
      .eq('song_id', songId)
      .eq('user_id', userId)
      .maybeSingle();
    if (e2 && e2.code !== 'PGRST116') throw e2; // ignore "no rows" error
    return !!row;
  }
  return liked;
}

/**
 * Get the latest likes_count for a song (if your UI needs to refresh it).
 * Returns number or null if not found.
 */
export async function fetchSongLikesCount(songId: string) {
  const { data, error } = await supabase
    .from('songs')
    .select('likes_count')
    .eq('id', songId)
    .maybeSingle();

  if (error) throw error;
  return data?.likes_count ?? null;
}