// src/lib/follows.ts
import { supabase } from "@/lib/supabase";

export type ToggleArtistFollowResult = {
  action: "followed" | "unfollowed";
  followers_count: number;
};

export type FollowedArtistRow = {
  artist_user_id: string;
  followed_at: string;
  display_name: string | null;
  artist_slug: string;
  profile_image_url: string | null;
  genres: string[] | null;
};

/** Toggle follow for an artist. Requires authenticated session. */
export async function toggleArtistFollow(
  artistUserId: string
): Promise<ToggleArtistFollowResult> {
  const { data, error } = await supabase.rpc("toggle_artist_follow", {
    p_artist_user_id: artistUserId,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | ToggleArtistFollowResult
    | undefined;

  if (!row) {
    throw new Error("No response from toggle_artist_follow");
  }

  return {
    action: row.action,
    followers_count: Number(row.followers_count) || 0,
  };
}

/** Public follower count (works for guests). */
export async function getArtistFollowerCount(artistUserId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_artist_follower_count", {
    p_artist_user_id: artistUserId,
  });

  if (error) throw error;
  return Number(data) || 0;
}

/** Whether the current user follows this artist. */
export async function isFollowingArtist(artistUserId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from("artist_follows")
    .select("id")
    .eq("follower_user_id", userId)
    .eq("artist_user_id", artistUserId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return !!data;
}

/** List artists the current user follows (profile summary). */
export async function getFollowedArtists(): Promise<FollowedArtistRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return [];

  const { data: follows, error: followErr } = await supabase
    .from("artist_follows")
    .select("artist_user_id, created_at")
    .eq("follower_user_id", userId)
    .order("created_at", { ascending: false });

  if (followErr) throw followErr;
  if (!follows?.length) return [];

  const artistIds = follows.map((f) => f.artist_user_id);

  const { data: profiles, error: profErr } = await supabase
    .from("artist_public_profiles")
    .select("user_id, display_name, artist_slug, profile_image_url, genres")
    .in("user_id", artistIds);

  if (profErr) throw profErr;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p])
  );

  return follows
    .map((f) => {
      const p = profileMap.get(f.artist_user_id);
      if (!p?.artist_slug) return null;
      return {
        artist_user_id: f.artist_user_id,
        followed_at: f.created_at,
        display_name: p.display_name ?? null,
        artist_slug: p.artist_slug,
        profile_image_url: p.profile_image_url ?? null,
        genres: p.genres ?? null,
      } satisfies FollowedArtistRow;
    })
    .filter((row): row is FollowedArtistRow => row !== null);
}
