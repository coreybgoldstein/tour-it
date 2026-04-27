export async function sendPushToUser(userId: string, title: string, body: string, url?: string): Promise<void> {
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, body, url }),
    });
  } catch {
    // Non-critical
  }
}
