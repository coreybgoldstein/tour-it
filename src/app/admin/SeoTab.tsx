"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Admin SEO tab.
 *
 * Lets the operator (Corey) sanity-check that structured data is being
 * served correctly across the site, without copy-pasting URLs into
 * Google's Rich Results Test by hand. Three actions per URL:
 *
 *  1. Self-test  — POSTs the URL to /api/admin/seo-preview. The server
 *     fetches our own HTML and extracts every <script type="application/
 *     ld+json"> block, reporting the @type values it found. Catches
 *     regressions (missing JSON-LD, parse errors) before Google sees
 *     them on the next crawl.
 *
 *  2. Rich Results — opens Google's Rich Results Test in a new tab,
 *     pre-filled with the URL. This is the authoritative validator:
 *     it tells you whether the markup is good enough for Google to
 *     render an enhanced search result (map cards, sitelinks, etc.).
 *
 *  3. Schema.org Validator — opens validator.schema.org with the URL.
 *     Stricter type-system check; useful when Google's tool reports
 *     a pass but you want to know about lint-level issues.
 *
 * The URL list is a fixed set (home, search, leaderboards, robots,
 * sitemap) plus the 10 most-recently-updated public courses pulled
 * from the DB.
 */

interface CourseRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

interface PreviewResult {
  ok: boolean;
  status?: number;
  elapsedMs?: number;
  schemas?: Array<{ type: string; topLevelKeys: string[]; valid: boolean; error?: string }>;
  error?: string;
}

type FixedRow = { label: string; path: string; expectMarkup: boolean };

const FIXED_ROWS: FixedRow[] = [
  { label: "Home (feed)", path: "/", expectMarkup: true },
  { label: "Search", path: "/search", expectMarkup: false },
  { label: "Leaderboards", path: "/leaderboards", expectMarkup: false },
  { label: "About", path: "/about", expectMarkup: false },
  { label: "robots.txt", path: "/robots.txt", expectMarkup: false },
  { label: "sitemap.xml", path: "/sitemap.xml", expectMarkup: false },
];

const GOOGLE_RICH_RESULTS = (url: string) => `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`;
const SCHEMA_ORG_VALIDATOR = (url: string) => `https://validator.schema.org/?url=${encodeURIComponent(url)}`;
const CANONICAL = "https://www.touritgolf.com";

export default function SeoTab() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, PreviewResult | "loading">>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state")
        .eq("isPublic", true)
        .order("updatedAt", { ascending: false })
        .limit(10);
      if (cancelled) return;
      setCourses((data as CourseRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const runTest = useCallback(async (path: string) => {
    setResults(prev => ({ ...prev, [path]: "loading" }));
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setResults(prev => ({ ...prev, [path]: { ok: false, error: "Not signed in" } }));
        return;
      }
      const res = await fetch("/api/admin/seo-preview", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: path }),
      });
      const json = await res.json();
      setResults(prev => ({ ...prev, [path]: json }));
    } catch (e) {
      setResults(prev => ({ ...prev, [path]: { ok: false, error: e instanceof Error ? e.message : "Failed" } }));
    }
  }, []);

  const allRows: Array<{ key: string; label: string; path: string; expectMarkup: boolean }> = [
    ...FIXED_ROWS.map(r => ({ key: r.path, label: r.label, path: r.path, expectMarkup: r.expectMarkup })),
    ...courses.map(c => ({
      key: `/courses/${c.id}`,
      label: `${c.name}${c.city ? ` — ${c.city}, ${c.state}` : ""}`,
      path: `/courses/${c.id}`,
      expectMarkup: true,
    })),
  ];

  const runAll = useCallback(async () => {
    // Parallel — keep concurrency reasonable (5 at a time).
    const queue = [...allRows];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const row = queue.shift();
          if (!row) return;
          await runTest(row.path);
        }
      })());
    }
    await Promise.all(workers);
  }, [allRows, runTest]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.24)", borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>SEO health</div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
          Self-test parses each page's HTML and lists every <code style={{ background: "rgba(255,255,255,0.06)", padding: "0 4px", borderRadius: 4 }}>application/ld+json</code> block we ship. The Google + Schema.org links open each URL in the authoritative validators.
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={runAll}
            disabled={loading}
            style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "6px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}
          >
            Self-test all
          </button>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "6px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}
          >
            ↗ Google Search Console
          </a>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {allRows.map(row => {
          const r = results[row.path];
          const isLoading = r === "loading";
          const result = typeof r === "object" ? r : undefined;
          const types = result?.schemas?.map(s => s.type).filter(t => t !== "(no @type)") ?? [];
          const hasError = result && (!result.ok || result.schemas?.some(s => !s.valid));
          const allGood = result && result.ok && (types.length > 0 || !row.expectMarkup);
          const url = `${CANONICAL}${row.path}`;

          return (
            <div
              key={row.key}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${hasError ? "rgba(220,80,80,0.30)" : allGood ? "rgba(77,168,98,0.25)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.label}
                  </div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.path}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => runTest(row.path)}
                    disabled={isLoading}
                    style={{ background: isLoading ? "rgba(255,255,255,0.04)" : "rgba(77,168,98,0.14)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 8, padding: "5px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862", cursor: isLoading ? "default" : "pointer", whiteSpace: "nowrap" }}
                  >
                    {isLoading ? "Testing…" : "Self-test"}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open page in new tab"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 9px", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
                  >
                    ↗
                  </a>
                  <a
                    href={GOOGLE_RICH_RESULTS(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Google Rich Results Test"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.7)", textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    Google
                  </a>
                  <a
                    href={SCHEMA_ORG_VALIDATOR(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Schema.org Validator"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.7)", textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    schema.org
                  </a>
                </div>
              </div>

              {/* Self-test result */}
              {result && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {result.error && (
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(220,120,120,0.9)" }}>
                      Error: {result.error}
                    </div>
                  )}
                  {result.ok && (
                    <>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                        HTTP {result.status} · {result.elapsedMs}ms · {types.length} JSON-LD block{types.length === 1 ? "" : "s"}
                      </div>
                      {types.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {types.map((t, i) => (
                            <span
                              key={`${t}-${i}`}
                              style={{
                                background: "rgba(77,168,98,0.14)",
                                border: "1px solid rgba(77,168,98,0.3)",
                                borderRadius: 99,
                                padding: "2px 8px",
                                fontFamily: "ui-monospace, Menlo, monospace",
                                fontSize: 10,
                                color: "#4da862",
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {types.length === 0 && row.expectMarkup && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(230,160,0,0.9)", marginTop: 4 }}>
                          ⚠️ Expected JSON-LD, found none. Likely a regression — check the layout&apos;s structured-data injection.
                        </div>
                      )}
                      {result.schemas?.some(s => !s.valid) && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(220,120,120,0.9)", marginTop: 4 }}>
                          ⚠️ One or more JSON-LD blocks failed to parse: {result.schemas.filter(s => !s.valid).map(s => s.error).join("; ")}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "20px 0" }}>
            Loading top courses…
          </div>
        )}
      </div>
    </div>
  );
}
