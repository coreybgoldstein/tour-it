"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const isHome = pathname === "/";
  const isSearch = pathname === "/search";
  const isProfile = pathname === "/profile";

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      padding: "10px 8px 18px",
      background: "linear-gradient(to top, rgba(7,16,10,0.97) 0%, rgba(7,16,10,0.5) 100%)",
      borderTop: "1px solid rgba(255,255,255,0.04)",
    }}>

      {/* Home */}
      <button
        onClick={() => router.push("/")}
        style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={isHome ? "#4da862" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span style={{ fontSize: "9px", color: isHome ? "#4da862" : "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Home</span>
      </button>

      {/* Search */}
      <button
        onClick={() => router.push("/search")}
        style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={isSearch ? "#4da862" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span style={{ fontSize: "9px", color: isSearch ? "#4da862" : "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Search</span>
      </button>

      {/* Upload FAB */}
      <button
        onClick={() => router.push("/upload")}
        style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", marginTop: "-18px" }}
      >
        <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7-7 7 7"/>
          </svg>
        </div>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
      </button>

      {/* Notifications (placeholder) */}
      <button
        style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", opacity: 0.4 }}
        disabled
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif" }}>Alerts</span>
      </button>

      {/* Profile */}
      <button
        onClick={() => router.push("/profile")}
        style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={isProfile ? "#4da862" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span style={{ fontSize: "9px", color: isProfile ? "#4da862" : "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Profile</span>
      </button>

    </nav>
  );
}
