"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressVideo } from "@/lib/compressVideo";

type Course = { id: string; name: string; city: string; state: string; holeCount: number };

const SHOT_TYPES = [
  { label: "Tee", value: "TEE_SHOT" },
  { label: "Approach", value: "APPROACH" },
  { label: "Chip", value: "CHIP" },
  { label: "Pitch", value: "PITCH" },
  { label: "Putt", value: "PUTT" },
  { label: "Bunker", value: "BUNKER" },
  { label: "Layup", value: "LAY_UP" },
  { label: "Full Hole", value: "FULL_HOLE" },
];

type ClipStatus = "pending" | "compressing" | "queued" | "uploading" | "done" | "error";

type BatchClip = {
  id: string;
  file: File;
  preview: string;
  holeNumber: number | null;
  shotType: string;
  compressPct: number;
  compressStage: string;
  compressedFile: File | null;
  status: ClipStatus;
  errorMsg: string | null;
};

const SKIP_MB = 30;

export default function BatchUpload({ initialFiles, onBack }: { initialFiles: File[]; onBack: () => void }) {
  const router = useRouter();
  const [clips, setClips] = useState<BatchClip[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const courseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize clips and kick off compression in background
  useEffect(() => {
    const initial: BatchClip[] = initialFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      holeNumber: null,
      shotType: "TEE_SHOT",
      compressPct: 0,
      compressStage: "",
      compressedFile: null,
      status: file.type.startsWith("video/") && file.size >= SKIP_MB * 1024 * 1024 ? "compressing" : "pending",
      errorMsg: null,
    }));
    setClips(initial);

    // Start compression for large video files immediately
    initial.forEach(clip => {
      if (clip.file.type.startsWith("video/") && clip.file.size >= SKIP_MB * 1024 * 1024) {
        compressVideo(clip.file, (stage, pct) => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, compressStage: stage, compressPct: pct } : c));
        }).then(compressed => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, compressedFile: compressed, status: "pending" } : c));
        }).catch(() => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "pending" } : c));
        });
      }
    });
  }, []);

  // Course search
  const searchCourses = useCallback((q: string) => {
    if (courseDebounce.current) clearTimeout(courseDebounce.current);
    if (!q.trim() || q.trim().length < 2) { setCourseResults([]); setCourseLoading(false); return; }
    setCourseLoading(true);
    courseDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, holeCount")
        .or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
        .order("uploadCount", { ascending: false })
        .limit(20);
      setCourseResults(data || []);
      setCourseLoading(false);
    }, 280);
  }, []);

  useEffect(() => { searchCourses(courseSearch); }, [courseSearch, searchCourses]);

  function updateClip(id: string, patch: Partial<BatchClip>) {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  async function uploadAll() {
    if (!selectedCourse) return;
    const assignedClips = clips.filter(c => c.holeNumber !== null);
    if (assignedClips.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    let done = 0;

    for (const clip of assignedClips) {
      setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "uploading" } : c));

      try {
        // Use compressed file if available, otherwise original
        const fileToUpload = clip.compressedFile || clip.file;
        const isVideo = clip.file.type.startsWith("video/");
        const ext = fileToUpload.name.split(".").pop();
        const bucket = isVideo ? "tour-it-videos" : "tour-it-photos";
        const filePath = `${user.id}/${selectedCourse.id}/${clip.holeNumber}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, fileToUpload, { cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(uploadError.message);

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);

        // Find or create Hole row
        let holeId: string | null = null;
        const { data: holeData } = await supabase
          .from("Hole").select("id")
          .eq("courseId", selectedCourse.id)
          .eq("holeNumber", clip.holeNumber!)
          .maybeSingle();

        if (holeData?.id) {
          holeId = holeData.id;
        } else {
          const newHoleId = crypto.randomUUID();
          const now = new Date().toISOString();
          await supabase.from("Hole").insert({
            id: newHoleId,
            courseId: selectedCourse.id,
            holeNumber: clip.holeNumber,
            par: 0,
            uploadCount: 0,
            createdAt: now,
            updatedAt: now,
          });
          holeId = newHoleId;
        }

        const uploadId = crypto.randomUUID();
        const now = new Date().toISOString();
        const dateFromFile = new Date(clip.file.lastModified).toISOString();

        await supabase.from("Upload").insert({
          id: uploadId,
          userId: user.id,
          courseId: selectedCourse.id,
          holeId,
          mediaType: isVideo ? "VIDEO" : "PHOTO",
          mediaUrl: publicUrl,
          teeBoxId: null,
          shotType: clip.shotType,
          yardageOverlay: null,
          clubUsed: null,
          windCondition: null,
          strategyNote: null,
          landingZoneNote: null,
          whatCameraDoesntShow: null,
          handicapRange: null,
          datePlayedAt: dateFromFile,
          rankScore: 0,
          tripId: null,
          tripPublic: true,
          moderationStatus: "PENDING",
          likeCount: 0,
          commentCount: 0,
          viewCount: 0,
          saveCount: 0,
          createdAt: now,
          updatedAt: now,
        });

        // Increment counters
        const { data: cRow } = await supabase.from("Course").select("uploadCount").eq("id", selectedCourse.id).single();
        await supabase.from("Course").update({ uploadCount: (cRow?.uploadCount || 0) + 1 }).eq("id", selectedCourse.id);
        if (holeId) {
          const { data: hRow } = await supabase.from("Hole").select("uploadCount").eq("id", holeId).single();
          await supabase.from("Hole").update({ uploadCount: (hRow?.uploadCount || 0) + 1 }).eq("id", holeId);
        }

        done++;
        setDoneCount(done);
        setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "done" } : c));
      } catch (err: any) {
        setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "error", errorMsg: err?.message || "Upload failed" } : c));
      }
    }

    setUploading(false);
    setAllDone(true);
  }

  const assignedCount = clips.filter(c => c.holeNumber !== null).length;
  const compressingCount = clips.filter(c => c.status === "compressing").length;

  if (allDone) {
    return (
      <div style={{ minHeight: "100svh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
          {doneCount} clip{doneCount !== 1 ? "s" : ""} uploaded
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
          All done. They'll appear on the course page shortly.
        </div>
        <button
          onClick={() => router.push(`/courses/${selectedCourse?.id}`)}
          style={{ background: "#2d7a42", border: "none", borderRadius: 14, padding: "14px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", marginBottom: 12 }}
        >
          View course
        </button>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
        >
          Upload more
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", paddingBottom: 120 }}>
      <style>{`
        .batch-hole-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); cursor: pointer; flex-shrink: 0; }
        .batch-hole-btn.active { background: rgba(77,168,98,0.2); border-color: rgba(77,168,98,0.6); color: #4da862; }
        .batch-shot-btn { padding: 6px 12px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .batch-shot-btn.active { background: rgba(77,168,98,0.2); border-color: rgba(77,168,98,0.6); color: #4da862; }
        .holes-row { display: flex; flex-wrap: wrap; gap: 5px; }
        .shot-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .shot-row::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "52px 20px 16px", borderBottom: "1px solid rgba(77,168,98,0.1)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
            {clips.length} clips selected
          </h1>
          {compressingCount > 0 && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.7)", marginTop: 2 }}>
              Compressing {compressingCount} in background…
            </div>
          )}
        </div>
      </div>

      {/* Course selector */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {selectedCourse ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Course</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>{selectedCourse.name}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[selectedCourse.city, selectedCourse.state].filter(Boolean).join(", ")}</div>
            </div>
            <button onClick={() => { setSelectedCourse(null); setCourseSearch(""); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
              Change
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Which course?</div>
            <input
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              placeholder="Search by name, city, or state…"
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(77,168,98,0.3)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
            />
            {courseLoading && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>Searching…</div>
            )}
            {courseResults.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedCourse(c); setCourseSearch(""); setCourseResults([]); }}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", marginTop: 6, cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clip cards */}
      <div style={{ padding: "12px 20px" }}>
        {clips.map((clip, idx) => (
          <div
            key={clip.id}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}
          >
            <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
              {/* Thumbnail */}
              <div style={{ width: 56, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#0a1e10", position: "relative" }}>
                {clip.file.type.startsWith("video/") ? (
                  <video src={clip.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} preload="metadata" muted playsInline />
                ) : (
                  <img src={clip.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="preview" />
                )}
                {clip.status === "done" && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(45,122,66,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
                {clip.status === "uploading" && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}
              </div>

              {/* Clip info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                    Clip {idx + 1} · {(clip.file.size / 1048576).toFixed(0)} MB
                  </span>
                  {clip.status === "compressing" && (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(77,168,98,0.7)", flexShrink: 0 }}>
                      {clip.compressPct > 0 ? `${clip.compressPct}%` : "Compressing…"}
                    </span>
                  )}
                  {clip.status === "error" && (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#e05c5c", flexShrink: 0 }}>Failed</span>
                  )}
                </div>

                {/* Hole picker */}
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>Hole</div>
                <div className="holes-row" style={{ marginBottom: 10 }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      className={`batch-hole-btn${clip.holeNumber === n ? " active" : ""}`}
                      onClick={() => updateClip(clip.id, { holeNumber: n })}
                      disabled={clip.status === "uploading" || clip.status === "done"}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* Shot type picker */}
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>Shot type</div>
                <div className="shot-row">
                  {SHOT_TYPES.map(s => (
                    <button
                      key={s.value}
                      className={`batch-shot-btn${clip.shotType === s.value ? " active" : ""}`}
                      onClick={() => updateClip(clip.id, { shotType: s.value })}
                      disabled={clip.status === "uploading" || clip.status === "done"}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compression progress bar */}
            {clip.status === "compressing" && (
              <div style={{ padding: "0 14px 12px" }}>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${clip.compressPct || 8}%`, background: "#4da862", borderRadius: 99, transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky footer */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 20px 36px", background: "linear-gradient(to top, rgba(7,16,10,0.98) 0%, rgba(7,16,10,0.7) 100%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {!selectedCourse && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginBottom: 10 }}>
            Select a course to continue
          </div>
        )}
        {selectedCourse && assignedCount < clips.length && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginBottom: 10 }}>
            {clips.length - assignedCount} clip{clips.length - assignedCount !== 1 ? "s" : ""} still need a hole number
          </div>
        )}
        <button
          onClick={uploadAll}
          disabled={!selectedCourse || assignedCount === 0 || uploading}
          style={{
            width: "100%",
            background: !selectedCourse || assignedCount === 0 ? "rgba(77,168,98,0.2)" : "#2d7a42",
            border: "none",
            borderRadius: 14,
            padding: "16px",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            color: !selectedCourse || assignedCount === 0 ? "rgba(255,255,255,0.3)" : "#fff",
            cursor: !selectedCourse || assignedCount === 0 || uploading ? "not-allowed" : "pointer",
            boxShadow: selectedCourse && assignedCount > 0 ? "0 2px 16px rgba(45,122,66,0.4)" : "none",
          }}
        >
          {uploading
            ? `Uploading ${doneCount + 1} of ${assignedCount}…`
            : assignedCount === 0
            ? "Assign holes to upload"
            : `Upload ${assignedCount} clip${assignedCount !== 1 ? "s" : ""}`}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
