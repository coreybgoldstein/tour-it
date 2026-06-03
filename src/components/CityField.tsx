"use client";

// City picker for the trip "Cities" field. Type a city name; a
// debounced lookup against /api/places/city returns matching towns
// (Google Places / Nominatim under the hood). Tapping a suggestion —
// or pressing Enter / the Add button — calls onAdd with the formatted
// "City, ST" label and clears the input so several cities can be
// chained quickly. The parent owns the chip list.

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (text: string) => void;
  onAdd: (city: string) => void;
  placeholder?: string;
  stateHint?: string;
};

type Hit = { display: string; city: string; state: string | null };

export default function CityField({ value, onChange, onAdd, placeholder = "e.g. Harbor Springs, MI", stateHint }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleInput(next: string) {
    onChange(next);
    setError(null);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: next.trim() });
        if (stateHint) params.set("state", stateHint);
        const res = await fetch(`/api/places/city?${params.toString()}`);
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

  function pick(label: string) {
    onAdd(label);
    onChange("");
    setResults([]);
    setOpen(false);
  }

  function addTyped() {
    const v = value.trim();
    if (v) pick(v);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "12px 14px",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14,
            color: "#fff",
            outline: "none",
          }}
        />
        <button
          onClick={addTyped}
          style={{ flexShrink: 0, background: "rgba(45,122,66,0.9)", border: "1px solid rgba(126,200,140,0.5)", borderRadius: 10, padding: "0 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
        >
          Add
        </button>
      </div>
      {open && (loading || results.length > 0 || error) && (
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
              onMouseDown={(e) => { e.preventDefault(); pick(h.display); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ flex: 1, minWidth: 0, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.display}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
