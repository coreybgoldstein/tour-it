import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { rating, whatsWorking, needsImprovement, bugs, missingFeature, userId, userEmail } = await req.json();

  if (!rating) return NextResponse.json({ error: "Missing rating" }, { status: 400 });

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; color: #111;">
      <h2 style="color: #2d7a42;">New Tour It App Feedback</h2>
      <p><strong>Overall Rating:</strong> ${stars} (${rating}/5)</p>
      ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
      ${userEmail ? `<p><strong>Email:</strong> ${userEmail}</p>` : ""}
      <hr style="border-color: #eee;" />
      <h3>What's working well?</h3>
      <p>${whatsWorking || "<em>Not answered</em>"}</p>
      <h3>What needs improvement?</h3>
      <p>${needsImprovement || "<em>Not answered</em>"}</p>
      <h3>Any bugs or issues?</h3>
      <p>${bugs || "<em>Not answered</em>"}</p>
      <h3>What feature would make this more valuable?</h3>
      <p>${missingFeature || "<em>Not answered</em>"}</p>
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
