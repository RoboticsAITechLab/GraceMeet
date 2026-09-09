import { NextRequest, NextResponse } from "next/server";
import { meetingStore, isValidMeetingIdFormat } from "@/lib/server/meetingStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    const rawHost = typeof body.hostName === "string" ? body.hostName.trim() : "";
    const rawCustomId = typeof body.customMeetingId === "string" ? body.customMeetingId.trim() : "";

    // Sanitize title (default to "Sunday Fellowship" if empty, max 80 chars)
    const title = rawTitle ? rawTitle.slice(0, 80) : "Sunday Fellowship";
    const hostName = rawHost ? rawHost.slice(0, 64) : undefined;

    if (rawCustomId && !isValidMeetingIdFormat(rawCustomId)) {
      return NextResponse.json(
        { error: "Custom meeting ID must be 3-64 alphanumeric characters, dashes, or underscores" },
        { status: 400 }
      );
    }

    const meeting = await meetingStore.createMeeting({
      title,
      hostName,
      customMeetingId: rawCustomId || undefined,
    });

    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const origin = hostHeader ? `${proto}://${hostHeader}` : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = `${origin}/meeting/${encodeURIComponent(meeting.meetingId)}`;

    return NextResponse.json(
      {
        meeting,
        url,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[GraceMeet][API] Create meeting error:", err);
    const message = err instanceof Error ? err.message : "Failed to create meeting";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const meetingId = searchParams.get("meetingId") || searchParams.get("id");

    if (meetingId) {
      const cleanId = meetingId.trim();
      if (!isValidMeetingIdFormat(cleanId)) {
        return NextResponse.json(
          { error: "Invalid meeting ID format" },
          { status: 400 }
        );
      }

      const meeting = await meetingStore.getMeeting(cleanId);
      if (!meeting) {
        return NextResponse.json(
          { error: "Meeting not found" },
          { status: 404 }
        );
      }

      if (meeting.status === "disabled") {
        return NextResponse.json(
          { error: "Meeting is currently unavailable", status: "disabled" },
          { status: 403 }
        );
      }

      return NextResponse.json({ meeting });
    }

    // Default: list recent meetings
    const meetings = await meetingStore.listMeetings();
    return NextResponse.json({ meetings });
  } catch (err: unknown) {
    console.error("[GraceMeet][API] Get meeting error:", err);
    return NextResponse.json(
      { error: "Server error querying meeting" },
      { status: 500 }
    );
  }
}
