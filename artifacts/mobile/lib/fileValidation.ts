import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ALLOWED_EXT = ["jpg", "jpeg", "png", "gif", "webp"];

/**
 * Validates an image picked from the device.
 *
 * Note on approach: expo-image-picker is already configured with
 * `mediaTypes: Images`, and with `allowsEditing` it re-encodes the picture
 * into the app's own cache directory — so the file is always a real image
 * produced by the OS, not arbitrary user input. We therefore validate on
 * existence, size and mime/extension rather than reading raw magic bytes.
 *
 * The previous magic-byte check relied on `atob()` and on positional
 * `readAsStringAsync` reads, neither of which is reliable in React Native /
 * Expo SDK 54 (atob is not polyfilled, and positional reads throw on many
 * Android content:// URIs) — that's what produced the
 * "Failed to parse the selected file" error.
 */
export async function validateImageFile(
  uri: string,
  mimeType?: string | null,
  fileSize?: number | null
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!uri) {
      return { valid: false, error: "No image was selected." };
    }

    // ── Size check ─────────────────────────────────────────────────────────
    // Prefer the size the picker gave us; fall back to statting the file.
    let size = typeof fileSize === "number" && fileSize > 0 ? fileSize : 0;
    if (!size) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          return { valid: false, error: "Selected file could not be found." };
        }
        size = (info as any).size ?? 0;
      } catch {
        // Some URIs can't be stat'd — don't hard-fail, the upload step will
        // surface any real problem.
        size = 0;
      }
    }

    if (size > MAX_AVATAR_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `Image is ${mb}MB. Please choose an image under 5MB.`,
      };
    }

    // ── Type check ─────────────────────────────────────────────────────────
    if (mimeType) {
      const mt = mimeType.toLowerCase();
      if (!ALLOWED_MIME.includes(mt)) {
        return {
          valid: false,
          error: "Only JPEG, PNG, GIF and WEBP images are supported.",
        };
      }
      return { valid: true };
    }

    // No mime type from the picker — fall back to the file extension.
    const clean = uri.split("?")[0].split("#")[0];
    const ext = clean.split(".").pop()?.toLowerCase() ?? "";

    // content:// URIs often carry no extension at all. The picker already
    // restricted selection to images, so allow these through rather than
    // blocking a perfectly valid photo.
    if (!ext || ext.length > 5) {
      return { valid: true };
    }

    if (!ALLOWED_EXT.includes(ext)) {
      return {
        valid: false,
        error: "Only JPEG, PNG, GIF and WEBP images are supported.",
      };
    }

    return { valid: true };
  } catch (err: any) {
    console.error("[validateImageFile] Unexpected error:", err?.message ?? err);
    // Fail open: the picker already guarantees an image, and the upload step
    // has its own error handling. Blocking here caused valid photos to be
    // rejected with a confusing message.
    return { valid: true };
  }
}

/**
 * Uploads an avatar image to the "avatars" bucket, scoped to the user's ID.
 * Uses an ArrayBuffer rather than a Blob — React Native's Blob implementation
 * does not always carry the underlying bytes through to supabase-js, which
 * can silently produce 0-byte uploads.
 */
export async function uploadAvatarFile(
  userId: string,
  uri: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return { success: false, error: "Could not read the selected image." };
    }

    const filename = `${userId}_avatar.jpg`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filename, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("[uploadAvatarFile] Storage upload error:", error.message);
      return { success: false, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filename);

    // Cache-bust so the new avatar shows immediately.
    return { success: true, publicUrl: `${publicUrl}?t=${Date.now()}` };
  } catch (e: any) {
    console.error("[uploadAvatarFile] Exception:", e);
    return {
      success: false,
      error: e?.message || "Failed to upload the image. Please try again.",
    };
  }
}
