// src/lib/storage.ts
import { supabase } from "@/lib/supabase";

export const COVER_BUCKET = "song-covers";

export function coverPublicUrl(path?: string | null) {
  if (!path) return "/placeholder.svg"; // your existing placeholder
  return supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadCover(userId: string, file: File) {
  const key = `${userId}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage.from(COVER_BUCKET).upload(key, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return key; // store this in songs.cover_path
}
