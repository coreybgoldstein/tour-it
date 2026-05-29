"use client";

// Lodging picker — type a name; debounced lookup against
// /api/places/lodging (Nominatim under the hood) returns up to 8
// matching hotels / resorts / lodges. Tap to confirm.
//
// onChange now passes a structured payload — `{ display, city,
// state }` — so the parent can also persist lodgingCity +
// lodgingState columns on GolfTrip. city/state are populated when
// the user picked from the dropdown; null when the user typed
// freehand and saved as-is. The home-screen Your Tour location
// chip prefers structured city/state over the airport's city.
//
// State bias: parent can pass a `stateHint` (e.g. derived from the
// trip's first-course state) to focus results within that state.

import { useEffect, useRef, useState } from "react";

export type LodgingChoice = { display: string; city: string | null; state: string | null };

type Props = {
  value: string;
  onChange: (choice: LodgingChoice) => void;
  placeholder?: string;
  /** ISO-2 state code, e.g. "NC". Biases server-side search. */
  stateHint?: string;
};

type Hit = {
  name: string;
  display: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

export default function LodgingField({ value, onChange, placeholder = "Hotel, resort, or rental", stateHint }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>(value);
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setText(value);
  }, [value, open]);

  // Click-outside dismiss.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText(value);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [value]);

  function handleInput(next: string) {
    setText(next);
    setError(null);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: next.trim() });
        if (stateHint) params.set("state", stateHint);
        const res = await fetch(`/api/places/lodging?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Search failed");
        setResults((data.results ?? []) as Hit[]);
      } catch (e: any) {
        setError(e?.message ?? "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);
  }

  function pick(h: Hit) {
    onChange({ display: h.display, city: h.city, state: h.state });
    setText(h.display);
    setOpen(false);
  }

  function useTyped() {
    // Save whatever the user typed verbatim — escape hatch when the
    // service returns no hits but the user knows what they want.
    // Freehand save — no structured city/state available.
    onChange({ display: text.trim(), city: null, state: null });
    setOpen(false);
  }

  function handleFocus() {
    if (value && text === value) {
      setText("");
      setResults([]);
      setOpen(true);
    } else {
      setOpen(true);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          padding: "11px 14px",
          fontFamily: "'Outfit', sans-serif",
          fontSize: 14,
          color: "#fff",
          outline: "none",
        }}
      />
      {open && (loading || results.length > 0 || error || text.trim().length >= 2) && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
          background: "#0f1f15",
          border: "1px solid rgba(77,168,98,0.3)",
          borderRadius: 10,
          overflow: "hidden",
          zIndex: 250,
          maxHeight: 280,
          overflowY: "auto",
          boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
        }}>
          {loading && (
            <div style={{ padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Searching…</div>
          )}
          {!loading && error && (
            <div style={{ padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,150,150,0.8)" }}>{error}</div>
          )}
          {!loading && !error && results.map((h, i) => (
            <button
              key={`${h.display}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M3 22V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/>
                <path d="M7 10h10M7 14h10M7 18h10"/>
                <path d="M3 22h18"/>
              </svg>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                {(h.city || h.state) && (
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                    {[h.city, h.state].filter(Boolean).join(", ")}
                  </div>
                )}
              </span>
            </button>
          ))}
          {!loading && !error && results.length === 0 && text.trim().length >= 2 && (
            <button
              onMouseDown={(e) => { e.preventDefault(); useTyped(); }}
              style={{
                width: "100%", padding: "10px 14px", textAlign: "left",
                background: "transparent", border: "none",
                fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)",
                cursor: "pointer",
              }}
            >
              No matches — use &ldquo;{text.trim()}&rdquo; as is
            </button>
          )}
        </div>
      )}
    </div>
  );
}
