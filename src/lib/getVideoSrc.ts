export function getVideoSrc(mediaUrl: string, cloudflareVideoId?: string | null): string {
  if (cloudflareVideoId) {
    return `https://videodelivery.net/${cloudflareVideoId}/manifest/video.m3u8`;
  }
  return mediaUrl;
}
