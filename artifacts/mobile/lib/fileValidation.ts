import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ALLOWED_EXT  = ["jpg", "jpeg", "png", "gif", "webp"];

/**
 * Validates an image picked from the device.
 * Uses picker-supplied metadata (mimeType + fileSize) instead of reading
 * raw bytes — the old atob() / positional-read approach threw on Android
 * content:// URIs in SDK 54, causing the "Failed to parse" error.
 */
export async function validateImageFile(
  uri: string,
  mimeType?: string | null,
  fileSize?: number | null
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!uri) return { valid: false, error: "No image was selected." };

    // ── Size check ──────────────────────────────────────────────────────
    let size = typeof fileSize === "number" && fileSize > 0 ? fileSize : 0;
    if (!size) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return { valid: false, error: "Selected file could not be found." };
        size = (info as any).size ?? 0;
      } catch { size = 0; }
    }
    if (size > MAX_AVATAR_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      return { valid: false, error: `Image is ${mb}MB. Please choose an image under 5MB.` };
    }

    // ── Type check (mime first, then extension) ─────────────────────────
    if (mimeType) {
      const mt = mimeType.toLowerCase();
      if (!ALLOWED_MIME.includes(mt))
        return { valid: false, error: "Only JPEG, PNG, GIF and WEBP images are supported." };
      return { valid: true };
    }

    const ext = uri.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? "";
    if (!ext || ext.length > 5) return { valid: true }; // content:// URI, allow it
    if (!ALLOWED_EXT.includes(ext))
      return { valid: false, error: "Only JPEG, PNG, GIF and WEBP images are supported." };

    return { valid: true };
  } catch (err: any) {
    console.error("[validateImageFile] Unexpected error:", err?.message ?? err);
    // Fail open — picker already guarantees an image
    return { valid: true };
  }
}

/**
 * Uploads an avatar to Supabase Storage using ArrayBuffer (not Blob).
 * RN Blob can silently upload 0 bytes; ArrayBuffer is reliable.
 */
export async function uploadAvatarFile(
  userId: string,
  uri: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0)
      return { success: false, error: "Could not read the selected image." };

    const filename = `${userId}_avatar.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(filename, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) return { success: false, error: error.message };

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filename);
    return { success: true, publicUrl: `${publicUrl}?t=${Date.now()}` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to upload the image. Please try again." };
  }
}
