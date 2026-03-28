"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UserAvatarButton({ style }: { style?: React.CSSProperties }) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("User").select("avatarUrl").eq("id", user.id).single();
      if (data?.avatarUrl) setAvatarUrl(data.avatarUrl);
    });
  }, []);

  return (
    <button
      onClick={() => router.push("/profile")}
      style={{
        width: 34, height: 34, borderRadius: "50%",
        background: avatarUrl ? "transparent" : "rgba(77,168,98,0.18)",
        border: "1.5px solid rgba(77,168,98,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", overflow: "hidden", padding: 0, flexShrink: 0,
        ...style,
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      }
    </button>
  );
}
