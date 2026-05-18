export function getVideoSrc(mediaUrl: string, cloudflareVideoId?: string | null): string {
  if (cloudflareVideoId) {
    return `https://videodelivery.net/${cloudflareVideoId}/manifest/video.m3u8`;
  }
  return mediaUrl;
}

/** Static thumbnail URL for any clip — used in notification rows and any
 *  surface that wants a non-playing preview. Prefers the DB-stored
 *  thumbnailUrl (generated client-side during compression), falls back
 *  to Cloudflare's auto-thumbnail endpoint for Cloudflare-hosted videos,
 *  and uses the raw mediaUrl for photos / non-Cloudflare videos. */
export function getClipThumbnail(
  mediaType: string,
  mediaUrl: string,
  cloudflareVideoId?: string | null,
  thumbnailUrl?: string | null,
): string {
  if (mediaType === "PHOTO") return mediaUrl;
  if (thumbnailUrl) return thumbnailUrl;
  if (cloudflareVideoId) return `https://videodelivery.net/${cloudflareVideoId}/thumbnails/thumbnail.jpg`;
  return mediaUrl;
}
