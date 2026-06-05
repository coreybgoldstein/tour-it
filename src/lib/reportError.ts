// Env-gated error reporting. No SDK, no dependencies.
//
// When NEXT_PUBLIC_SENTRY_DSN is set, errors are shipped to Sentry via its
// public envelope HTTP endpoint (works in both the browser and Node). When
// the DSN is absent it's a no-op in production and a console.error in dev —
// so this is safe to call everywhere and ships dark until the DSN is added
// in the Vercel environment.
//
// DSN format: https://<publicKey>@<host>/<projectId>

type Dsn = { publicKey: string; host: string; projectId: string; protocol: string };

function parseDsn(dsn: string): Dsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !u.host || !projectId) return null;
    return { publicKey: u.username, host: u.host, projectId, protocol: u.protocol.replace(":", "") };
  } catch {
    return null;
  }
}

function hex(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[reportError]", error, context ?? "");
    }
    return;
  }

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const eventId = hex(32);
  const nowSec = Date.now() / 1000;

  const event = {
    event_id: eventId,
    timestamp: nowSec,
    platform: "javascript",
    level: "error",
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE ?? undefined,
    exception: {
      values: [{ type: err.name || "Error", value: err.message, stacktrace: stacktrace(err) }],
    },
    extra: context,
    request:
      typeof window !== "undefined"
        ? { url: window.location.href, headers: { "User-Agent": navigator.userAgent } }
        : undefined,
  };

  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify(event);

  const url = `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  // Fire-and-forget — reporting must never throw into the caller's path.
  try {
    void fetch(url, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}

// Minimal stack parse into Sentry frames. Best-effort: if parsing fails we
// still send the message + type, which is the important part.
function stacktrace(err: Error): { frames: Array<{ filename: string; function: string; lineno?: number; colno?: number }> } | undefined {
  if (!err.stack) return undefined;
  const frames = err.stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const m = line.match(/at (.+?) \(?(.+?):(\d+):(\d+)\)?$/);
      if (!m) return null;
      return { function: m[1], filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) };
    })
    .filter((f): f is { filename: string; function: string; lineno: number; colno: number } => f !== null)
    .reverse(); // Sentry expects oldest frame first
  return frames.length ? { frames } : undefined;
}
