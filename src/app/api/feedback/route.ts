import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`feedback:${user.id}`, 5, 60 * 1000)) {
    return NextResponse.json({ error: "Too many feedback submissions — try again in a minute" }, { status: 429 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { rating, whatsWorking, needsImprovement, bugs, missingFeature } = await req.json();

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Missing or invalid rating" }, { status: 400 });
  }

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const safeStars = escapeHtml(stars);
  const safeUserId = escapeHtml(user.id);
  const safeUserEmail = escapeHtml(user.email ?? "");
  const safeWhatsWorking = whatsWorking ? escapeHtml(whatsWorking) : "<em>Not answered</em>";
  const safeNeedsImprovement = needsImprovement ? escapeHtml(needsImprovement) : "<em>Not answered</em>";
  const safeBugs = bugs ? escapeHtml(bugs) : "<em>Not answered</em>";
  const safeMissingFeature = missingFeature ? escapeHtml(missingFeature) : "<em>Not answered</em>";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; color: #111;">
      <h2 style="color: #2d7a42;">New Tour It App Feedback</h2>
      <p><strong>Overall Rating:</strong> ${safeStars} (${rating}/5)</p>
      <p><strong>User ID:</strong> ${safeUserId}</p>
      ${safeUserEmail ? `<p><strong>Email:</strong> ${safeUserEmail}</p>` : ""}
      <hr style="border-color: #eee;" />
      <h3>What's working well?</h3>
      <p>${safeWhatsWorking}</p>
      <h3>What needs improvement?</h3>
      <p>${safeNeedsImprovement}</p>
      <h3>Any bugs or issues?</h3>
      <p>${safeBugs}</p>
      <h3>What feature would make this more valuable?</h3>
      <p>${safeMissingFeature}</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: "Tour It Feedback <feedback@touritgolf.com>",
    to: "corey@touritgolf.com",
    subject: `App Feedback — ${stars} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
