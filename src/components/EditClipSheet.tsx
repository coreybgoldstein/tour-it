"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type TagUser = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

type EditData = {
  holeNumber: number | null;
  shotType: string;
  strategyNote: string;
  clubUsed: string;
  windCondition: string;
  landingZoneNote: string;
  whatCameraDoesntShow: string;
  taggedUsers: TagUser[];
  originalTagIds: Set<string>;
};

type SavedData = {
  holeNumber: number | null;
  holeId: string | null;
  shotType: string;
  clubUsed: string;
  windCondition: string;
  strategyNote: string;
};

export default function EditClipSheet({
  uploadId,
  courseId,
  currentHoleId,
  currentHoleNumber,
  currentUserId,
  onClose,
  onSaved,
}: {
  uploadId: string | null;
  courseId: string;
  currentHoleId: string | null;
  currentHoleNumber: number | null;
  currentUserId: string | null;
  onClose: () => void;
  onSaved: (data: SavedData) => void;
}) {
  const [editData, setEditData] = useState<EditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagResults, setTagResults] = useState<TagUser[]>([]);
  const tagDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uploadId) { setEditData(null); return; }
    setLoading(true);
    setTagInput("");
    setTagResults([]);
    const supabase = createClient();
    Promise.all([
      supabase.from("Upload").select("shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow").eq("id", uploadId).single(),
      supabase.from("UploadTag").select("userId, user:User(id, username, displayName, avatarUrl)").eq("uploadId", uploadId),
    ]).then(([{ data }, { data: tagRows }]) => {
      const existing: TagUser[] = (tagRows || []).map((r: any) => r.user).filter(Boolean);
      setEditData({
        holeNumber: currentHoleNumber,
        shotType: data?.shotType || "",
        strategyNote: data?.strategyNote || "",
        clubUsed: data?.clubUsed || "",
        windCondition: data?.windCondition || "",
        landingZoneNote: data?.landingZoneNote || "",
        whatCameraDoesntShow: data?.whatCameraDoesntShow || "",
        taggedUsers: existing,
        originalTagIds: new Set(existing.map(u => u.id)),
      });
      setLoading(false);
    });
  }, [uploadId, currentHoleNumber]);

  useEffect(() => {
    if (tagDebounce.current) clearTimeout(tagDebounce.current);
    if (!tagInput.trim()) { setTagResults([]); return; }
    tagDebounce.current = setTimeout(async () => {
      const taggedIds = new Set(editData?.taggedUsers.map(u => u.id) || []);
      const { data } = await createClient().from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${tagInput.trim()}%`).limit(6);
      setTagResults((data || []).filter((u: TagUser) => !taggedIds.has(u.id)));
    }, 280);
  }, [tagInput, editData?.taggedUsers]);

  async function save() {
    if (!uploadId || !editData || saving || !currentUserId) return;
    setSaving(true);
    const supabase = createClient();
    let holeId = currentHoleId;
    if (editData.holeNumber && editData.holeNumber !== currentHoleNumber) {
      const { data: existing } = await supabase.from("Hole").select("id").eq("courseId", courseId).eq("holeNumber", editData.holeNumber).maybeSingle();
      if (existing?.id) { holeId = existing.id; } else {
        const newId = crypto.randomUUID(); const now = new Date().toISOString();
        await supabase.from("Hole").insert({ id: newId, courseId, holeNumber: editData.holeNumber, par: 0, uploadCount: 0, createdAt: now, updatedAt: now });
        holeId = newId;
      }
    }
    await supabase.from("Upload").update({
      holeId,
      shotType: editData.shotType || null,
      clubUsed: editData.clubUsed || null,
      windCondition: editData.windCondition || null,
      strategyNote: editData.strategyNote || null,
      landingZoneNote: editData.landingZoneNote || null,
      whatCameraDoesntShow: editData.whatCameraDoesntShow || null,
      updatedAt: new Date().toISOString(),
    }).eq("id", uploadId).eq("userId", currentUserId);
    const currentIds = new Set(editData.taggedUsers.map(u => u.id));
    const removedIds = [...editData.originalTagIds].filter(id => !currentIds.has(id));
    const addedUsers = editData.taggedUsers.filter(u => !editData.originalTagIds.has(u.id));
    if (removedIds.length > 0) await supabase.from("UploadTag").delete().eq("uploadId", uploadId).in("userId", removedIds);
    if (addedUsers.length > 0) {
      const now = new Date().toISOString();
      await supabase.from("UploadTag").insert(addedUsers.map(u => ({ id: crypto.randomUUID(), uploadId, userId: u.id, createdAt: now })));
    }
    setSaving(false);
    onSaved({ holeNumber: editData.holeNumber, holeId, shotType: editData.shotType, clubUsed: editData.clubUsed, windCondition: editData.windCondition, strategyNote: editData.strategyNote });
  }

  if (!uploadId) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }}
      onClick={onClose}
    >
      <style>{`@keyframes editSpinSheet { to { transform: rotate(360deg); } }`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 20px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Edit clip</div>

        {loading || !editData ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "editSpinSheet 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* Hole */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Hole</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setEditData(d => d ? { ...d, holeNumber: n } : d)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${editData.holeNumber === n ? "rgba(26,158,66,0.6)" : "rgba(255,255,255,0.1)"}`, background: editData.holeNumber === n ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editData.holeNumber === n ? "#1a9e42" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Shot type */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Shot type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[{ label: "Tee Shot", value: "TEE_SHOT" }, { label: "Approach", value: "APPROACH" }, { label: "Chip", value: "CHIP" }, { label: "Pitch", value: "PITCH" }, { label: "Putt", value: "PUTT" }, { label: "Bunker", value: "BUNKER" }, { label: "Layup", value: "LAY_UP" }, { label: "Full Hole", value: "FULL_HOLE" }].map(s => (
                  <button key={s.value} onClick={() => setEditData(d => d ? { ...d, shotType: s.value } : d)}
                    style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${editData.shotType === s.value ? "rgba(26,158,66,0.6)" : "rgba(255,255,255,0.1)"}`, background: editData.shotType === s.value ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editData.shotType === s.value ? "#1a9e42" : "rgba(255,255,255,0.45)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Notes</div>
              <textarea value={editData.strategyNote} onChange={e => setEditData(d => d ? { ...d, strategyNote: e.target.value } : d)} rows={4}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", resize: "none", boxSizing: "border-box" }} />
            </div>

            {/* Club */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Club used</div>
              <input value={editData.clubUsed} onChange={e => setEditData(d => d ? { ...d, clubUsed: e.target.value } : d)} placeholder="e.g. 7-iron, Driver…"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Wind */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Wind</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[{ label: "Calm", value: "CALM" }, { label: "Into", value: "INTO" }, { label: "Downwind", value: "DOWNWIND" }, { label: "Left→Right", value: "LEFT_TO_RIGHT" }, { label: "Right→Left", value: "RIGHT_TO_LEFT" }].map(w => (
                  <button key={w.value} onClick={() => setEditData(d => d ? { ...d, windCondition: d.windCondition === w.value ? "" : w.value } : d)}
                    style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${editData.windCondition === w.value ? "rgba(26,158,66,0.6)" : "rgba(255,255,255,0.1)"}`, background: editData.windCondition === w.value ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: editData.windCondition === w.value ? "#1a9e42" : "rgba(255,255,255,0.45)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag players */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Tag players</div>
              {editData.taggedUsers.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {editData.taggedUsers.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(26,158,66,0.12)", border: "1px solid rgba(26,158,66,0.3)", borderRadius: 99, padding: "3px 8px 3px 5px" }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#1a9e42" }}>@{u.username}</span>
                      <button onClick={() => setEditData(d => d ? { ...d, taggedUsers: d.taggedUsers.filter(t => t.id !== u.id) } : d)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Search by username…"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }} />
              {tagResults.length > 0 && (
                <div style={{ marginTop: 6, background: "rgba(0,0,0,0.3)", borderRadius: 10, overflow: "hidden" }}>
                  {tagResults.map(u => (
                    <button key={u.id} onClick={() => { setEditData(d => d ? { ...d, taggedUsers: [...d.taggedUsers, u] } : d); setTagInput(""); setTagResults([]); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "rgba(26,158,66,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {u.avatarUrl ? <img src={u.avatarUrl} alt={u.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#1a9e42", fontWeight: 700 }}>{u.username[0]?.toUpperCase()}</span>}
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                        {u.displayName && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{u.displayName}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <button onClick={save} disabled={saving}
              style={{ width: "100%", background: saving ? "rgba(26,158,66,0.4)" : "#1a9e42", border: "none", borderRadius: 14, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: saving ? "default" : "pointer", marginBottom: 10 }}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button onClick={onClose}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
