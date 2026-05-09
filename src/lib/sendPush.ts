export async function sendPushToUser(
  type: string,
  recipientUserId: string,
  referenceId?: string,
  extras?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, recipientUserId, referenceId, ...extras }),
    });
  } catch {
    // Non-critical
  }
}
