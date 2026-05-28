// src/lib/plays.ts
import { supabase } from "@/lib/supabase";

const PG_DUPLICATE_KEY = "23505";

/**
 * Read authoritative play_count from song_play_stats (retries for trigger/view lag).
 */
export async function fetchSongPlayCount(songId: string): Promise<number | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from("song_play_stats")
      .select("play_count")
      .eq("song_id", songId)
      .maybeSingle();

    if (!error && data != null) {
      return Number(data.play_count) || 0;
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
  return null;
}

/**
 * Fallback: increment play_count directly on song_play_stats when song_plays insert is blocked.
 */
async function incrementSongPlayStats(songId: string): Promise<number | null> {
  const { data: existing, error: readError } = await supabase
    .from("song_play_stats")
    .select("play_count")
    .eq("song_id", songId)
    .maybeSingle();

  if (readError) return null;

  const nextCount = (Number(existing?.play_count) || 0) + 1;

  const { error: upsertError } = await supabase.from("song_play_stats").upsert(
    { song_id: songId, play_count: nextCount },
    { onConflict: "song_id" }
  );

  if (upsertError) {
    console.warn("song_play_stats upsert failed", upsertError);
    return null;
  }

  return nextCount;
}

/**
 * Record one play in the database and return the updated play_count from song_play_stats.
 * Works for guests and logged-in users (subject to Supabase RLS).
 */
export async function recordSongPlay(songId: string): Promise<number | null> {
  if (!songId) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const row: { song_id: string; user_id?: string } = { song_id: songId };
    if (user?.id) row.user_id = user.id;

    const { error: insertError } = await supabase.from("song_plays").insert(row);

    if (insertError) {
      console.warn("song_plays insert failed, incrementing song_play_stats", insertError);
      const fromStats = await incrementSongPlayStats(songId);
      if (fromStats !== null) return fromStats;
      return await fetchSongPlayCount(songId);
    }

    const playCount = await fetchSongPlayCount(songId);
    if (playCount !== null) return playCount;

    // Stats row may not exist yet; create/increment directly
    return await incrementSongPlayStats(songId);
  } catch (err) {
    console.warn("recordSongPlay failed", err);
    return null;
  }
}

/** @deprecated Use recordSongPlay instead */
export async function recordPlay(
  songId: string,
  listenDuration = 0,
  listenPercentage = 0
): Promise<string | undefined> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const row: {
      song_id: string;
      user_id?: string;
      listen_duration: number;
      listen_percentage: number;
    } = {
      song_id: songId,
      listen_duration: listenDuration,
      listen_percentage: listenPercentage,
    };
    if (user?.id) row.user_id = user.id;

    const { data, error } = await supabase
      .from("song_plays")
      .insert([row])
      .select("id")
      .single();

    if (error) throw error;
    return data?.id as string | undefined;
  } catch (err) {
    console.warn("recordPlay failed", err);
    return undefined;
  }
}
