"use client";

// /courses/[id]/manage — verified-manager dashboard.
//
// Gated client-side: render-blocks until we confirm the current user
// either (a) has a CourseManager row for this course, or (b) is a
// Tour It admin. The API endpoints these calls hit re-check the same
// rule server-side via lib/courseManagerAuth so the gate isn't
// security-critical, just UX hygiene.
//
// Three editable sections, matching the spec:
//   1. Official info — officialDescription, websiteUrl, teeSheetUrl
//   2. Staff / PGA pros — CRUD of CourseStaff cards
//   3. Official media — CRUD of CourseOfficialMedia
//
// No styling shortcuts to existing UGC patterns — this surface is
// for an operator, not a golfer, so the tone is closer to a CMS
// editor than the brand-rich UGC pages.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cdnImage } from "@/lib/cdnImage";

type CourseOfficial = {
  id: string;
  name: string;
  city: string;
  state: string;
  courseType: "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE" | null;
  isClaimed: boolean;
  description: string | null;
  officialDescription: string | null;
  websiteUrl: string | null;
  teeSheetUrl: string | null;
  membershipInquiryUrl: string | null;
};

type Staff = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  isPublic: boolean;
  sortOrder: number;
};

type Media = {
  id: string;
  holeNumber: number | null;
  mediaType: "image" | "flyover" | "video";
  url: string;
  cloudflareVideoId: string | null;
  caption: string | null;
  sortOrder: number;
};

export default function CourseManagePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params?.id;

  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseOfficial | null>(null);

  // ── Authorization (client-side gate) ──────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: profile }, { data: mgr }] = await Promise.all([
        supabase.from("User").select("isAdmin").eq("id", user.id).maybeSingle(),
        supabase.from("CourseManager").select("id").eq("courseId", courseId).eq("userId", user.id).maybeSingle(),
      ]);

      if (!profile?.isAdmin && !mgr) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      const { data: row } = await supabase
        .from("Course")
        .select("id, name, city, state, courseType, isClaimed, description, officialDescription, websiteUrl, teeSheetUrl, membershipInquiryUrl")
        .eq("id", courseId)
        .single();

      setCourse(row as CourseOfficial);
      setLoading(false);
    })();
  }, [courseId, router]);

  if (loading) return <Shell><Loading /></Shell>;
  if (unauthorized) return <Shell><Forbidden onBack={() => router.push(`/courses/${courseId}`)} /></Shell>;
  if (!course) return <Shell><div style={{ color: "rgba(255,255,255,0.4)" }}>Course not found.</div></Shell>;

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", paddingBottom: 80 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 18px 40px" }}>
        <button onClick={() => router.push(`/courses/${courseId}`)} style={backBtn}>← Back to course</button>
        <h1 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 28, fontWeight: 800, margin: "6px 0 2px", lineHeight: 1.15 }}>
          {course.name}
        </h1>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Manage official info · {course.city}, {course.state}
        </div>

        {/* Section order per latest UX direction: media is the most
            visual + most user-facing piece of operator content, so
            it leads. Staff second. Text-only Official Info last. */}
        <OfficialMediaSection courseId={course.id} />

        <StaffSection courseId={course.id} />

        <OfficialInfoSection
          courseId={course.id}
          courseType={course.courseType}
          initial={{
            officialDescription: course.officialDescription || "",
            websiteUrl: course.websiteUrl || "",
            membershipInquiryUrl: course.membershipInquiryUrl || "",
          }}
          ugcDescription={course.description}
        />
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Official info
// ─────────────────────────────────────────────────────────────────────

function OfficialInfoSection({ courseId, courseType, initial, ugcDescription }: {
  courseId: string;
  courseType: "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE" | null;
  initial: { officialDescription: string; websiteUrl: string; membershipInquiryUrl: string };
  ugcDescription: string | null;
}) {
  const [vals, setVals] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Membership-inquiry input shown on PRIVATE courses only. Public /
  // semi-private will eventually get a booking-link field; that's
  // explicitly deferred (roadmap item) so we don't surface it yet.
  const showMembershipField = courseType === "PRIVATE";

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/courses/${courseId}/official`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        officialDescription: vals.officialDescription || null,
        websiteUrl: vals.websiteUrl || null,
        // membershipInquiryUrl always submitted (and cleared when not
        // shown) so the DB field tracks the form intent precisely.
        membershipInquiryUrl: showMembershipField ? (vals.membershipInquiryUrl || null) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } else {
      const d = await res.json().catch(() => null);
      alert(d?.error || "Couldn't save");
    }
  }

  return (
    <Section title="Official info" subtitle="Shown on the course page once published.">
      <Label>Official description</Label>
      <textarea
        value={vals.officialDescription}
        onChange={(e) => setVals(v => ({ ...v, officialDescription: e.target.value }))}
        placeholder="The course's own description — voice, history, what makes it distinct."
        rows={5}
        style={textareaStyle}
      />
      {ugcDescription && !vals.officialDescription && (
        <div style={hintStyle}>
          UGC description currently shown: <span style={{ color: "rgba(255,255,255,0.55)" }}>&ldquo;{ugcDescription.slice(0, 140)}{ugcDescription.length > 140 ? "…" : ""}&rdquo;</span>
        </div>
      )}

      <Label style={{ marginTop: 14 }}>Course website</Label>
      <input
        value={vals.websiteUrl}
        onChange={(e) => setVals(v => ({ ...v, websiteUrl: e.target.value }))}
        placeholder="https://yourcourse.com"
        style={inputStyle}
      />

      {showMembershipField && (
        <>
          <Label style={{ marginTop: 14 }}>Membership inquiry link <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "rgba(255,255,255,0.3)" }}>(optional)</span></Label>
          <input
            value={vals.membershipInquiryUrl}
            onChange={(e) => setVals(v => ({ ...v, membershipInquiryUrl: e.target.value }))}
            placeholder="https://yourcourse.com/membership"
            style={inputStyle}
          />
          <div style={hintStyle}>
            Shown as an &ldquo;Inquire about membership&rdquo; button to prospective members.
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save info"}
        </button>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Staff / PGA pros
// ─────────────────────────────────────────────────────────────────────

function StaffSection({ courseId }: { courseId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Manager view returns ALL rows including non-public.
    const supabase = createClient();
    const { data } = await supabase
      .from("CourseStaff")
      .select("id, name, role, bio, photoUrl, email, phone, isPublic, sortOrder")
      .eq("courseId", courseId)
      .order("sortOrder", { ascending: true });
    setStaff((data ?? []) as Staff[]);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!window.confirm("Remove this staff card?")) return;
    setBusy(id);
    const res = await fetch(`/api/courses/${courseId}/staff/${id}`, { method: "DELETE" });
    if (res.ok) setStaff((prev) => prev.filter((s) => s.id !== id));
    setBusy(null);
  }

  return (
    <Section title="Staff" subtitle="Cards rendered in the From-the-course block.">
      {loading ? <Loading inline /> : staff.length === 0 ? (
        <EmptyHint text="No staff cards yet." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {staff.map((s) => (
            <StaffRow key={s.id} staff={s} onEdit={() => setEditing(s)} onRemove={() => remove(s.id)} busy={busy === s.id} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={() => setEditing({ id: "", name: "", role: "", bio: null, photoUrl: null, email: null, phone: null, isPublic: true, sortOrder: staff.length * 10 })} style={ghostBtn}>
          + Add staff member
        </button>
      </div>

      {editing && (
        <StaffEditorSheet
          courseId={courseId}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Section>
  );
}

function StaffRow({ staff, onEdit, onRemove, busy }: { staff: Staff; onEdit: () => void; onRemove: () => void; busy: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 10 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {staff.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnImage(staff.photoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 800, color: "rgba(126,200,140,0.95)" }}>
            {(staff.name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("") || "?").toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>
          {staff.name}
          {!staff.isPublic && <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>· hidden</span>}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(126,200,140,0.85)" }}>{staff.role}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onEdit} disabled={busy} style={ghostBtn}>Edit</button>
        <button onClick={onRemove} disabled={busy} style={subtleDangerBtn}>{busy ? "…" : "Remove"}</button>
      </div>
    </div>
  );
}

function StaffEditorSheet({ courseId, initial, onClose, onSaved }: {
  courseId: string;
  initial: Staff;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vals, setVals] = useState<Staff>(initial);
  const [saving, setSaving] = useState(false);
  const isNew = !initial.id;

  async function save() {
    if (!vals.name.trim() || !vals.role.trim()) { alert("Name and role required"); return; }
    setSaving(true);
    const payload = {
      name: vals.name,
      role: vals.role,
      bio: vals.bio || null,
      photoUrl: vals.photoUrl || null,
      email: vals.email || null,
      phone: vals.phone || null,
      isPublic: !!vals.isPublic,
      sortOrder: vals.sortOrder,
    };
    const res = isNew
      ? await fetch(`/api/courses/${courseId}/staff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/courses/${courseId}/staff/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) onSaved();
    else { const d = await res.json().catch(() => null); alert(d?.error || "Couldn't save"); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "60px 12px 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#0d2318", borderRadius: 16, padding: "18px 20px 22px", border: "1px solid rgba(77,168,98,0.18)", boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 19, fontWeight: 700, marginBottom: 12 }}>{isNew ? "Add staff" : "Edit staff"}</div>

        <Label>Name</Label>
        <input value={vals.name} onChange={(e) => setVals(v => ({ ...v, name: e.target.value }))} style={inputStyle} placeholder="Jane Doe" />

        <Label style={{ marginTop: 10 }}>Role / title</Label>
        <input value={vals.role} onChange={(e) => setVals(v => ({ ...v, role: e.target.value }))} style={inputStyle} placeholder="Head PGA Professional" />

        <Label style={{ marginTop: 10 }}>Photo URL</Label>
        <input value={vals.photoUrl ?? ""} onChange={(e) => setVals(v => ({ ...v, photoUrl: e.target.value || null }))} style={inputStyle} placeholder="https://…/headshot.jpg" />

        <Label style={{ marginTop: 10 }}>Bio</Label>
        <textarea rows={3} value={vals.bio ?? ""} onChange={(e) => setVals(v => ({ ...v, bio: e.target.value || null }))} style={textareaStyle} placeholder="Short paragraph — how long at the course, specialties, etc." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <Label>Email</Label>
            <input value={vals.email ?? ""} onChange={(e) => setVals(v => ({ ...v, email: e.target.value || null }))} style={inputStyle} placeholder="jane@course.com" />
          </div>
          <div>
            <Label>Phone</Label>
            <input value={vals.phone ?? ""} onChange={(e) => setVals(v => ({ ...v, phone: e.target.value || null }))} style={inputStyle} placeholder="555-555-5555" />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
          <input type="checkbox" checked={vals.isPublic} onChange={(e) => setVals(v => ({ ...v, isPublic: e.target.checked }))} />
          Show on the public course page
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Official media
// ─────────────────────────────────────────────────────────────────────

function OfficialMediaSection({ courseId }: { courseId: string }) {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  // Add-form state. mediaType drives both the file accept= and the
  // upload path: image → Supabase Storage; video/flyover →
  // Cloudflare Stream direct-upload (same path as user clip uploads).
  const [vals, setVals] = useState<{ mediaType: "image" | "flyover" | "video"; caption: string; holeNumber: string }>({ mediaType: "image", caption: "", holeNumber: "" });
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/courses/${courseId}/official-media`);
    const data = await res.json();
    setMedia((data?.media ?? []) as Media[]);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  // Image upload → Supabase Storage tour-it-photos bucket, same
  // bucket the rest of the app uses. Path:
  //   course-official/{courseId}/{Date.now()}.{ext}
  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `course-official/${courseId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("tour-it-photos").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
    return publicUrl;
  }

  // Video upload → Cloudflare Stream via the same direct-upload
  // endpoint the user-clip flow uses. We POST to /api/cloudflare-
  // stream/direct-upload, then PUT the file body to the resulting
  // signed URL. Returns { uid, playbackUrl }.
  async function uploadVideo(file: File): Promise<{ cloudflareVideoId: string; url: string }> {
    const directRes = await fetch("/api/cloudflare-stream/direct-upload", { method: "POST" });
    if (!directRes.ok) throw new Error((await directRes.json().catch(() => null))?.error || "Couldn't start upload");
    const { uploadUrl, uid } = await directRes.json();
    // Use XHR so we can wire up onprogress for the UI bar.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => xhr.status < 400 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.open("POST", uploadUrl);
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });
    const playback = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
    return { cloudflareVideoId: uid, url: playback };
  }

  async function onFilePicked(file: File) {
    if (uploadState === "uploading") return;
    setUploadErr(null);
    setUploadState("uploading");
    setUploadPct(0);
    try {
      let url: string;
      let cloudflareVideoId: string | null = null;
      if (vals.mediaType === "image") {
        url = await uploadImage(file);
      } else {
        const res = await uploadVideo(file);
        url = res.url;
        cloudflareVideoId = res.cloudflareVideoId;
      }
      const insertRes = await fetch(`/api/courses/${courseId}/official-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: vals.mediaType,
          url,
          cloudflareVideoId,
          caption: vals.caption.trim() || null,
          holeNumber: vals.holeNumber ? parseInt(vals.holeNumber, 10) : null,
          sortOrder: media.length * 10,
        }),
      });
      if (!insertRes.ok) throw new Error((await insertRes.json().catch(() => null))?.error || "Couldn't save");
      setUploadState("idle");
      setAdding(false);
      setVals({ mediaType: "image", caption: "", holeNumber: "" });
      load();
    } catch (e: any) {
      setUploadState("error");
      setUploadErr(e?.message || "Upload failed");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this media?")) return;
    const res = await fetch(`/api/courses/${courseId}/official-media/${id}`, { method: "DELETE" });
    if (res.ok) setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  const acceptForType = vals.mediaType === "image" ? "image/*" : "video/*";

  return (
    <Section title="Official media" subtitle="Photos and hole flyovers. Tagged 'From the course' when they appear in the public feed.">
      {loading ? <Loading inline /> : media.length === 0 ? (
        <EmptyHint text="No media added yet." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {media.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 10 }}>
              <div style={{ width: 64, height: 44, borderRadius: 7, overflow: "hidden", background: "rgba(7,16,10,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(126,200,140,0.7)" }}>
                {m.mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cdnImage(m.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : m.mediaType.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {m.caption || (m.holeNumber ? `Hole ${m.holeNumber}` : "Course-level")}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                  {m.mediaType.charAt(0).toUpperCase() + m.mediaType.slice(1)}{m.holeNumber ? ` · Hole ${m.holeNumber}` : ""}
                </div>
              </div>
              <button onClick={() => remove(m.id)} style={subtleDangerBtn}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {!adding && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={() => { setAdding(true); setUploadErr(null); setUploadState("idle"); }} style={ghostBtn}>+ Add media</button>
        </div>
      )}

      {adding && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.22)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Type + Hole row — fixed alignment. Each cell wraps its
              own label+input in a stretching column so a long label
              ("Hole — blank = course-level") doesn't shove the
              input below the sibling. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Label>Type</Label>
              <select
                value={vals.mediaType}
                onChange={(e) => setVals(v => ({ ...v, mediaType: e.target.value as Media["mediaType"] }))}
                style={inputStyle}
                disabled={uploadState === "uploading"}
              >
                <option value="image">Image</option>
                <option value="flyover">Flyover</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Label>Hole</Label>
              <input
                value={vals.holeNumber}
                onChange={(e) => setVals(v => ({ ...v, holeNumber: e.target.value }))}
                style={inputStyle}
                placeholder="optional — e.g. 7"
                disabled={uploadState === "uploading"}
              />
            </div>
          </div>

          <div>
            <Label>Caption</Label>
            <input
              value={vals.caption}
              onChange={(e) => setVals(v => ({ ...v, caption: e.target.value }))}
              style={inputStyle}
              placeholder="Optional — shown under the media"
              disabled={uploadState === "uploading"}
            />
          </div>

          {/* Upload progress / pick file */}
          {uploadState === "uploading" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "rgba(126,200,140,0.95)" }}>
                {vals.mediaType === "image" ? "Uploading image…" : `Uploading video… ${uploadPct}%`}
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${vals.mediaType === "image" ? 100 : uploadPct}%`, background: "linear-gradient(90deg, #4da862, #7ed28b)", transition: "width 0.2s" }} />
              </div>
            </div>
          ) : (
            <>
              <label
                style={{
                  marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "16px 12px",
                  border: "1.5px dashed rgba(126,200,140,0.4)",
                  borderRadius: 10,
                  background: "rgba(77,168,98,0.06)",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(126,200,140,0.95)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {vals.mediaType === "image" ? "Pick image to upload" : "Pick video to upload"}
                <input
                  type="file"
                  accept={acceptForType}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFilePicked(f);
                    // Reset value so picking the same file twice still fires onChange
                    try { e.target.value = ""; } catch {}
                  }}
                />
              </label>
              {uploadErr && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(220,100,100,0.95)" }}>{uploadErr}</div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setAdding(false)} disabled={uploadState === "uploading"} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Layout primitives
// ─────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>{children}</main>;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22, padding: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{title}</h2>
        {subtitle && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4, ...(style || {}) }}>{children}</div>;
}

function Loading({ inline }: { inline?: boolean }) {
  return <div style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.35)", fontSize: 13, padding: inline ? "10px 0" : "30px 0", textAlign: "center" }}>Loading…</div>;
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.35)", fontSize: 12.5, padding: "12px 0" }}>{text}</div>;
}

function Forbidden({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
      You aren&apos;t a verified manager for this course.
      <div style={{ marginTop: 14 }}>
        <button onClick={onBack} style={ghostBtn}>Back to course</button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 9,
  padding: "10px 12px",
  fontFamily: "'Inter', sans-serif", fontSize: 13.5,
  color: "#fff", outline: "none",
};
const textareaStyle: React.CSSProperties = { ...inputStyle, fontFamily: "'Inter', sans-serif", lineHeight: 1.4, resize: "vertical" as const };

const hintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: 11.5,
  color: "rgba(255,255,255,0.4)", marginTop: 6,
};

const backBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 12 };
const primaryBtn: React.CSSProperties = { background: "#2d7a42", border: "1px solid #4da862", borderRadius: 8, padding: "9px 18px", fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#fff", cursor: "pointer", letterSpacing: "0.02em" };
const ghostBtn: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 14px", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", cursor: "pointer" };
const subtleDangerBtn: React.CSSProperties = { background: "transparent", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 8, padding: "8px 14px", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(220,100,100,0.85)", cursor: "pointer" };
