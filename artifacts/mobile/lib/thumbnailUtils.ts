/**
 * thumbnailUtils.ts
 *
 * Shared helpers for parsing the thumbnail_url column, which the admin panel
 * stores as either a JSON array ("[\"url1\",\"url2\"]") or a comma-separated
 * string ("url1,url2").
 */

/** Returns all image URLs from a raw thumbnail_url value. */
export function parseThumbnailUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Returns only the first URL from a raw thumbnail_url value. */
export function firstThumbnailUrl(raw: string | null | undefined): string | null {
  const urls = parseThumbnailUrls(raw);
  return urls[0] ?? null;
}

/**
 * Transforms a remote image URL to request a resized, optimized thumbnail version
 * from supported CDNs (Supabase Storage render API, Unsplash, Cloudinary).
 */
export function getOptimizedImageUrl(
  source: any,
  options: { width?: number; height?: number; quality?: number } = {}
): any {
  if (!source) return source;

  // Handle { uri: "https://..." } objects
  if (typeof source === "object" && source.uri && typeof source.uri === "string") {
    return {
      ...source,
      uri: getOptimizedImageUrl(source.uri, options),
    };
  }

  if (typeof source !== "string" || !source.startsWith("http")) {
    return source;
  }

  const { width = 400, height, quality = 80 } = options;

  try {
    // 1. Supabase Storage URLs
    if (source.includes("/storage/v1/object/public/")) {
      const renderUrl = source.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      const urlObj = new URL(renderUrl);
      if (width) urlObj.searchParams.set("width", String(width));
      if (height) urlObj.searchParams.set("height", String(height));
      urlObj.searchParams.set("quality", String(quality));
      urlObj.searchParams.set("resize", "cover");
      return urlObj.toString();
    }

    // 2. Unsplash URLs
    if (source.includes("images.unsplash.com")) {
      const urlObj = new URL(source);
      if (width) urlObj.searchParams.set("w", String(width));
      if (height) urlObj.searchParams.set("h", String(height));
      urlObj.searchParams.set("q", String(quality));
      urlObj.searchParams.set("auto", "format");
      urlObj.searchParams.set("fit", "crop");
      return urlObj.toString();
    }
  } catch {
    // Return original string if URL parsing fails
  }

  return source;
}
