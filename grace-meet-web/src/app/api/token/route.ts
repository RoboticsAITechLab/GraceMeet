import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meetingId = body.meetingId || body.roomName;
    const participantName = body.participantName;

    const validationError = validateInputs(meetingId, participantName);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    return await generateTokenResponse(meetingId.trim(), participantName.trim());
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

    const validationError = validateInputs(meetingId, participantName);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    return await generateTokenResponse(meetingId!.trim(), participantName!.trim());
  } catch (err: unknown) {
    console.error("Error generating LiveKit token:", err);
    return NextResponse.json(
      { error: "Server error processing token request" },
      { status: 500 }
    );
  }
}

function validateInputs(meetingId: unknown, participantName: unknown): string | null {
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

  return null;
}

async function generateTokenResponse(meetingId: string, participantName: string) {
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

  // Generate unique identity per tab to prevent accidental collisions if user opens 2 tabs with same name
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const participantIdentity = `${participantName}__${randomSuffix}`;

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
  });
}
