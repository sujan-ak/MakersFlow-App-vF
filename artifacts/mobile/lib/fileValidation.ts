import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";

/**
 * Validates that an image file exists, is under 2MB, and matches standard
 * image format magic bytes (JPEG, PNG, GIF, WEBP) to prevent malicious uploads.
 */
export async function validateImageFile(uri: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { valid: false, error: "Selected file does not exist." };
    }
    
    // File size limit: 2MB (2,097,152 bytes)
    if (fileInfo.size > 2 * 1024 * 1024) {
      return { valid: false, error: "File exceeds the 2MB size limit." };
    }

    // Read the first 12 bytes of the file in Base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
      position: 0,
      length: 12,
    });
    
    // Convert Base64 string to a binary string
    const binary = atob(base64);
    let hex = "";
    for (let i = 0; i < binary.length; i++) {
      hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
    }
    hex = hex.toUpperCase();

    // Check Magic Bytes signatures
    const isJpeg = hex.startsWith("FFD8FF");
    const isPng = hex.startsWith("89504E470D0A1A0A");
    const isGif = hex.startsWith("474946383761") || hex.startsWith("474946383961");
    // RIFF (first 4 bytes) + WEBP (bytes 8-11)
    const isWebp = hex.startsWith("52494646") && hex.substring(16, 24) === "57454250";

    if (!isJpeg && !isPng && !isGif && !isWebp) {
      return { valid: false, error: "Invalid format. Only JPEG, PNG, GIF, and WEBP formats are allowed." };
    }

    return { valid: true };
  } catch (err: any) {
    console.error("[validateImageFile] Error:", err);
    return { valid: false, error: "Failed to parse the selected file." };
  }
}

/**
 * Uploads an avatar image file to Supabase Storage's "avatars" bucket
 * scoped to the user's ID (`${userId}_avatar.jpg`).
 */
export async function uploadAvatarFile(
  userId: string,
  uri: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `${userId}_avatar.jpg`;
    
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      console.error('[uploadAvatarFile] Storage upload error:', error.message);
      return { success: false, error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename);
    const timestampedUrl = `${publicUrl}?t=${Date.now()}`;
    return { success: true, publicUrl: timestampedUrl };
  } catch (e: any) {
    console.error('[uploadAvatarFile] Exception during avatar upload:', e);
    return { success: false, error: e?.message || 'Failed to read image file for upload.' };
  }
}
