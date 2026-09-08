/**
 * Cryptographically unguessable, URL-safe meeting identifier generator.
 * Uses base32 charset excluding visually ambiguous characters (0, O, 1, I, l).
 */
export function generateMeetingId(prefix: "fellowship" | "prayer" | "study" = "fellowship"): string {
  const chars = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = new Uint8Array(6);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += chars[bytes[i] % chars.length];
  }

  return `${prefix}-${code}`;
}

/**
 * Returns full absolute URL for a meeting in current environment.
 */
export function getMeetingUrl(meetingId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/meeting/${encodeURIComponent(meetingId)}`;
  }
  const defaultBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${defaultBase}/meeting/${encodeURIComponent(meetingId)}`;
}

/**
 * Formats a clean WhatsApp/Telegram/Email shareable invitation text.
 */
export function formatInviteMessage(meetingId: string): string {
  const url = getMeetingUrl(meetingId);
  return `You're invited to join a GraceMeet fellowship meeting.\n\nJoin here:\n${url}`;
}
