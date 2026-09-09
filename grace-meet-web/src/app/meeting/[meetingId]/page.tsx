import Link from "next/link";
import MeetingRoomClient from "@/components/meeting/MeetingRoomClient";
import { AlertCircle, ArrowLeft, PlusCircle, ShieldAlert } from "lucide-react";
import { meetingStore, isValidMeetingIdFormat } from "@/lib/server/meetingStore";

interface MeetingPageProps {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ name?: string; title?: string }>;
}

export default async function MeetingPage({
  params,
  searchParams,
}: MeetingPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const rawMeetingId = resolvedParams.meetingId?.trim() || "";
  const initialName = resolvedSearchParams.name?.trim() || "";
  const titleHint = resolvedSearchParams.title?.trim() || undefined;

  // 1. Format validation
  if (!isValidMeetingIdFormat(rawMeetingId)) {
    return <MeetingNotFoundView reason="invalid_format" />;
  }

  // 2. Persistent meeting record lookup with optional title hint
  const meeting = await meetingStore.getMeeting(rawMeetingId, titleHint);

  // 3. Handle nonexistent meeting
  if (!meeting) {
    return <MeetingNotFoundView reason="not_found" />;
  }

  // 4. Handle disabled meeting
  if (meeting.status === "disabled") {
    return <MeetingDisabledView title={meeting.title} />;
  }

  // 5. Active meeting -> Render pre-join and meeting room
  return (
    <MeetingRoomClient
      meetingId={meeting.meetingId}
      meetingTitle={meeting.title}
      initialParticipantName={initialName}
    />
  );
}

function MeetingNotFoundView({ reason }: { reason: "invalid_format" | "not_found" }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#090d16] text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Meeting Not Found</h1>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          {reason === "invalid_format"
            ? "The provided meeting link format is invalid. Please check your invitation URL."
            : "This fellowship meeting does not exist or has expired. Please verify the link or create a new meeting."}
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href="/?create=true"
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create a New Meeting</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to GraceMeet Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MeetingDisabledView({ title }: { title: string }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#090d16] text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Meeting Unavailable</h1>
        <p className="text-sm font-semibold text-slate-200 mt-1">
          &ldquo;{title}&rdquo;
        </p>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          This meeting is currently unavailable or has been concluded by the host.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to GraceMeet Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
