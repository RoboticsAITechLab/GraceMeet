import Link from "next/link";
import MeetingRoomClient from "@/components/meeting/MeetingRoomClient";
import { AlertCircle, ArrowLeft } from "lucide-react";

interface MeetingPageProps {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ name?: string }>;
}

export default async function MeetingPage({
  params,
  searchParams,
}: MeetingPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const meetingId = resolvedParams.meetingId?.trim();
  const initialName = resolvedSearchParams.name?.trim() || "";

  // Validation: URL-safe alphanumeric, dashes, underscores, length 3-64
  const isValidId =
    meetingId &&
    meetingId.length >= 3 &&
    meetingId.length <= 64 &&
    /^[a-zA-Z0-9_-]+$/.test(meetingId);

  if (!isValidId) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#090d16] text-slate-100 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Meeting Not Found</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            This fellowship meeting link may be invalid or has expired. Please verify the link or start a new fellowship room.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go to GraceMeet Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MeetingRoomClient
      meetingId={meetingId}
      initialParticipantName={initialName}
    />
  );
}
