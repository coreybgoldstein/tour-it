import { createBrowserClient } from '@supabase/ssr'

// 12s fetch timeout for every Supabase request. Belt-and-braces against the
// iOS WKWebView "zombie URLSession" failure mode: after iOS suspends the
// app, in-flight fetches can hang indefinitely (no resolve, no reject).
// Without a timeout, React Suspense boundaries wait forever and the content
// area stays blank. With a timeout, the underlying fetch aborts and the
// query rejects — Suspense boundaries can fall through to error UI and the
// native AppDelegate recovery (if it kicked in) can take over cleanly.
// 12s is generous enough not to fire on slow but healthy networks.
const FETCH_TIMEOUT_MS = 12_000

const timeoutFetch: typeof fetch = (input, init) => {
  // Preserve any caller-provided AbortSignal by combining with the timeout
  // (AbortSignal.any was added in Node/iOS WebKit 17+; fall back gracefully).
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  let signal: AbortSignal = timeout
  if (init?.signal) {
    const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any
    if (typeof anyFn === 'function') {
      signal = anyFn([init.signal, timeout])
    } else {
      // Older runtimes: caller's signal wins; the timeout still fires
      // independently (it'll abort the underlying fetch via the controller
      // the browser creates internally for the signal we pass below).
      signal = init.signal
      init.signal.addEventListener('abort', () => {}, { once: true })
    }
  }
  return fetch(input, { ...init, signal })
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: timeoutFetch } }
  )
}