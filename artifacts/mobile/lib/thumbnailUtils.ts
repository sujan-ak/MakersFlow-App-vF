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
