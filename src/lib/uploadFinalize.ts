// Client helper that finalizes an upload by calling the server-side
// /api/uploads/create route, which atomically inserts the Upload row,
// links the Round, and bumps Course/User/Hole counters.
//
// Why this isn't done client-side anymore: the previous flow uploaded
// the media first and then tried to insert the Upload row from the
// browser. If the browser tab backgrounded, the network blipped, or
// the row insert hit a NOT NULL constraint (FULL_ROUND was perma-broken
// because holeId required a value), the media file orphaned in storage
// and the user saw nothing. Centralising the DB writes server-side
// makes them atomic AND makes them retryable via this client helper.

export type FinalizeUploadInput = {
  uploadId: string;          // client-generated UUID — primary key for idempotent retries
  courseId: string;
  holeId: string | null;
  mediaType: "PHOTO" | "VIDEO";
  mediaUrl: string;
  cloudflareVideoId: string | null;
  shotType: string | null;
  yardageOverlay: string | null;
  clubUsed: string | null;
  windCondition: string | null;
  strategyNote: string | null;
  datePlayedAt: string | null;
  clipLat: number | null;
  clipLng: number | null;
  tripId: string | null;
  tripPublic: boolean;
};

export type FinalizeUploadResult = {
  uploadId: string;
  roundId: string | null;
  holeId: string;
  courseUploadCount: number;
};

// Retry on network failures and 5xx responses. 4xx responses (validation,
// auth) are surfaced immediately — they will not succeed on retry.
export async function finalizeUpload(input: FinalizeUploadInput): Promise<FinalizeUploadResult> {
  const delays = [0, 1500, 4000]; // up to 3 attempts
  let lastError: Error | null = null;
  for (const delay of delays) {
    if (delay) await new Promise(r => setTimeout(r, delay));
    try {
      const res = await fetch("/api/uploads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        return (await res.json()) as FinalizeUploadResult;
      }
      // Non-retryable client errors: surface immediately.
      if (res.status >= 400 && res.status < 500) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      // 5xx — retry.
      lastError = new Error(`Server error (${res.status})`);
    } catch (e) {
      // Network-level failure (Failed to fetch, abort, etc) — retry.
      if (e instanceof Error && e.message.startsWith("Upload failed (")) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError || new Error("Upload could not be saved. Please try again.");
}
