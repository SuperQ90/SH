// src/lib/artistMedia.ts
import { supabase } from "@/lib/supabase";

export type ArtistImageType = "profile" | "hero";

export async function uploadArtistImage(file: File, type: ArtistImageType) {
  const { data: s } = await supabase.auth.getSession();
  const token = s?.session?.access_token;
  if (!token) throw new Error("Not logged in");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("type", type);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/artist-media-upload`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const out = await res.json();
  if (!res.ok) throw new Error(out?.error || "Upload failed");

  // { url, path }
  return out as { url: string; path: string };
}

/** Basic aspect-ratio validation to avoid nonsense uploads on the client */
export async function validateImageAspect(
  file: File,
  targetRatio: number, // e.g. 1 for square, 21/9 for banner
  tolerance = 0.12
) {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = objUrl;
    });
    const ratio = img.width / img.height;
    const ok = Math.abs(ratio - targetRatio) <= targetRatio * tolerance;
    return { ok, width: img.width, height: img.height, ratio };
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}
