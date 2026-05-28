// Soft-delete: sets profiles.status = 'Deleted' (row preserved; access blocked in app).

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const PROFILE_STATUS_DELETED = "Deleted";
export const PROFILE_STATUS_ACTIVE = "Active";

/** True when status is Deleted (case-insensitive). */
export function isProfileStatusDeleted(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "deleted";
}

function profileOwnerFilter(userId: string) {
  return `id.eq.${userId},user_id.eq.${userId}`;
}

/**
 * Read profiles.status for the auth user (supports id or user_id rows).
 */
export async function fetchProfileStatus(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .or(profileOwnerFilter(userId))
    .maybeSingle();

  if (error) {
    console.warn("[profileDelete] fetchProfileStatus:", error);
    return null;
  }

  return (data as { status?: string | null } | null)?.status ?? null;
}

export async function isUserProfileDeleted(user: User): Promise<boolean> {
  const status = await fetchProfileStatus(user.id);
  return isProfileStatusDeleted(status);
}

/**
 * Soft-delete the signed-in user's profile (status → Deleted).
 * Prefers RPC soft_delete_own_profile when deployed; falls back to direct update.
 */
export async function deleteOwnProfile(): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("You must be logged in to delete your profile.");

  const { error: rpcError } = await supabase.rpc("soft_delete_own_profile");
  if (!rpcError) return;

  // RPC missing or not yet migrated — update row directly (requires RLS allow own update)
  if (rpcError.code !== "PGRST202" && rpcError.code !== "42883") {
    console.warn("[profileDelete] RPC soft_delete_own_profile:", rpcError.message);
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      status: PROFILE_STATUS_DELETED,
      updated_at: new Date().toISOString(),
    })
    .or(profileOwnerFilter(userId))
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    throw new Error(
      "Could not update profile status. Run supabase/migrations/20260526_profile_soft_delete.sql in the Supabase SQL editor."
    );
  }
}
