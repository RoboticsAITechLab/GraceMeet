import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meetingId = body.meetingId || body.roomName;
    const participantName = body.participantName;
    const clientIdentity = body.participantIdentity || body.identity;

    const validationError = validateInputs(meetingId, participantName, clientIdentity);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    return await generateTokenResponse(
      meetingId.trim(),
      participantName.trim(),
      typeof clientIdentity === "string" ? clientIdentity.trim() : undefined
    );
  } catch (err: unknown) {
    console.error("Error generating LiveKit token:", err);
    return NextResponse.json(
      { error: "Invalid request body or server error" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const meetingId =
      searchParams.get("meetingId") ||
      searchParams.get("roomName") ||
      searchParams.get("room");
    const participantName =
      searchParams.get("participantName") ||
      searchParams.get("name") ||
      searchParams.get("username");
    const clientIdentity =
      searchParams.get("participantIdentity") ||
      searchParams.get("identity");

    const validationError = validateInputs(meetingId, participantName, clientIdentity);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    return await generateTokenResponse(
      meetingId!.trim(),
      participantName!.trim(),
      clientIdentity ? clientIdentity.trim() : undefined
    );
  } catch (err: unknown) {
    console.error("Error generating LiveKit token:", err);
    return NextResponse.json(
      { error: "Server error processing token request" },
      { status: 500 }
    );
  }
}

function validateInputs(
  meetingId: unknown,
  participantName: unknown,
  participantIdentity?: unknown
): string | null {
  if (!meetingId || typeof meetingId !== "string" || meetingId.trim().length === 0) {
    return "Meeting ID is required";
  }

  if (!participantName || typeof participantName !== "string" || participantName.trim().length === 0) {
    return "Participant name is required";
  }

  const cleanId = meetingId.trim();
  const cleanName = participantName.trim();

  if (cleanId.length < 3 || cleanId.length > 64) {
    return "Meeting ID must be between 3 and 64 characters";
  }

  // Safe URL characters: alphanumeric, dashes, underscores
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  if (!idRegex.test(cleanId)) {
    return "Meeting ID can only contain letters, numbers, hyphens, and underscores";
  }

  if (cleanName.length > 64) {
    return "Participant name must be under 64 characters";
  }

  // If client provides a session identity, validate format and length
  if (participantIdentity !== undefined && participantIdentity !== null) {
    if (typeof participantIdentity !== "string") {
      return "Participant identity must be a string";
    }
    const cleanIdentity = participantIdentity.trim();
    if (cleanIdentity.length < 3 || cleanIdentity.length > 128) {
      return "Participant identity must be between 3 and 128 characters";
    }
    // Safe characters for LiveKit identity: alphanumeric, underscores, hyphens, dots
    const identityRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!identityRegex.test(cleanIdentity)) {
      return "Participant identity can only contain letters, numbers, underscores, hyphens, and periods";
    }
  }

  return null;
}

async function generateTokenResponse(
  meetingId: string,
  participantName: string,
  clientIdentity?: string
) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880";

  if (!apiKey || !apiSecret) {
    console.error("Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in environment variables");
    return NextResponse.json(
      { error: "Server media credentials not configured" },
      { status: 500 }
    );
  }

  // LiveKit Room mapping: GraceMeet meetingId maps directly to the underlying media room
  const livekitRoomName = meetingId;

  // Use client-provided stable session identity if available, otherwise generate a deterministic fallback
  let participantIdentity: string;
  if (clientIdentity && clientIdentity.length >= 3) {
    participantIdentity = clientIdentity;
  } else {
    // Deterministic fallback: sanitizedName__sessionUUID
    const safeName = participantName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20) || "user";
    const sessionSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    participantIdentity = `${safeName}__${sessionSuffix}`;
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: "6h",
  });

  // Server-enforced permissions
  at.addGrant({
    roomJoin: true,
    room: livekitRoomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({
    token,
    url: livekitUrl,
    meetingId,
    participantIdentity,
  });
}

