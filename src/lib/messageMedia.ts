import { supabase, SUPABASE_URL } from "@/lib/supabase";
import { getAuthedClient } from "@/lib/supabase";

export type MessageAttachmentType = "image" | "audio" | "file" | "link";

const MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
]);
const FILE_TYPES = new Set(["application/pdf"]);

function attachmentTypeForMime(mime: string): MessageAttachmentType {
  if (IMAGE_TYPES.has(mime)) return "image";
  if (AUDIO_TYPES.has(mime)) return "audio";
  if (FILE_TYPES.has(mime)) return "file";
  throw new Error("Unsupported file type. Use image, audio, or PDF.");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export async function uploadMessageAttachment(
  file: File,
  threadId: string
): Promise<{ url: string; type: MessageAttachmentType }> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large (max 10 MB)");
  }

  const type = attachmentTypeForMime(file.type);
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Not logged in");

  const userId = session.session?.user.id;
  if (!userId) throw new Error("Not logged in");

  const path = `${userId}/${threadId}/${Date.now()}_${sanitizeFilename(file.name)}`;
  const client = getAuthedClient(token);

  const { error } = await client.storage
    .from("message-attachments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = client.storage.from("message-attachments").getPublicUrl(path);
  const url = data.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/message-attachments/${path}`;

  return { url, type };
}
