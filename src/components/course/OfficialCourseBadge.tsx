"use client";

// Two small inline components that ride alongside the course header.
//
//   OfficialCourseBadge   → shown when Course.isClaimed=true.
//                           Distinct wording ("Managed by the course")
//                           from any existing isVerified badge so the
//                           two concepts don't blur visually.
//
//   ClaimCourseChip       → shown when Course.isClaimed=false. Small,
//                           subtle, near the header — doesn't compete
//                           with the UGC feed for visual weight.
//
// Both are visually muted on purpose. This layer is trust signaling,
// not a billboard.

import { useState } from "react";
import ClaimCourseSheet from "@/components/course/ClaimCourseSheet";

export function OfficialCourseBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px",
      background: "rgba(77,168,98,0.18)",
      border: "1px solid rgba(126,200,140,0.55)",
      borderRadius: 99,
      fontFamily: "'Inter', sans-serif",
      fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#7ed28b",
      whiteSpace: "nowrap",
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12c0 5-3.5 9-9 9s-9-4-9-9 3.5-9 9-9 9 4 9 9z" />
      </svg>
      Managed by course
    </span>
  );
}

export function ClaimCourseChip({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px",
          background: "rgba(255,255,255,0.045)",
          border: "1px dashed rgba(255,255,255,0.2)",
          borderRadius: 99,
          fontFamily: "'Inter', sans-serif",
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.6)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        aria-label={`Claim ${courseName}`}
      >
        Claim this course
      </button>
      <ClaimCourseSheet
        courseId={courseId}
        courseName={courseName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
