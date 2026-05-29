"use client";

// Airport picker — type a code, city, or name; tap a suggestion to
// confirm. Stores the IATA code (e.g. "TVC") in the parent's state.
// Search is fully local (bundled US airport list in src/data/airports).
//
// Why not free-form text: users wrote "TVC", "Traverse City", and
// "Cherry Capital" for the same airport, which broke the planner's
// origin-distance signal and made downstream lookups ambiguous.
//
// Display rule: the input shows the chosen airport's pretty label
// while the value committed to state is the bare IATA code. On focus
// we reveal the suggestion dropdown; clicking outside or picking
// dismisses it.

import { useEffect, useRef, useState } from "react";
import { searchAirports, airportByCode, type Airport } from "@/data/airports";

type Props = {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
};

export default function AirportField({ value, onChange, placeholder = "e.g. RDU" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Local typed text — divorced from `value` so the user can edit
  // freely while the dropdown is open. Synced back to display label
  // on blur / pick.
  const [text, setText] = useState<string>(() => labelFor(value));
  const [results, setResults] = useState<Airport[]>([]);

  // When the parent value changes outside (e.g. trip loaded), reset
  // the display text. Only do this when the field isn't focused so
  // we don't stomp the user's in-progress typing.
  useEffect(() => {
    if (!open) setText(labelFor(value));
  }, [value, open]);

  // Dismiss the dropdown when the user clicks anywhere outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText(labelFor(value));
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [value]);

  function handleInput(next: string) {
    setText(next);
    setResults(searchAirports(next));
    setOpen(true);
  }

  function pick(a: Airport) {
    onChange(a.code);
    setText(`${a.code} — ${a.city}`);
    setOpen(false);
  }

  function handleFocus() {
    // If the field is showing a confirmed pick, clear the display so
    // the user can search without manually deleting first.
    if (value && text === labelFor(value)) {
      setText("");
      setResults([]);
      setOpen(true);
    } else if (text) {
      setResults(searchAirports(text));
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
        autoCapitalize="characters"
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
      {open && results.length > 0 && (
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
          {results.map((a) => (
            <button
              key={a.code}
              onMouseDown={(e) => { e.preventDefault(); pick(a); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#4da862", letterSpacing: "0.04em", minWidth: 40 }}>{a.code}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{a.city}, {a.state}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function labelFor(code: string): string {
  if (!code) return "";
  const a = airportByCode(code);
  return a ? `${a.code} — ${a.city}` : code;
}
