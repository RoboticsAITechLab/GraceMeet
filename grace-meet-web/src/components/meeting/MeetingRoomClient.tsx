"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
  useConnectionState,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import PreJoinScreen, { PreJoinChoices } from "./PreJoinScreen";
import MeetingHeader, { LayoutMode } from "./MeetingHeader";
import MeetingControls from "./MeetingControls";
import ParticipantGrid from "./ParticipantGrid";
import SpeakerView from "./SpeakerView";

interface MeetingRoomClientProps {
  meetingId?: string;
  roomName?: string;
  initialParticipantName?: string;
}

export default function MeetingRoomClient({
  meetingId: propMeetingId,
  roomName: propRoomName,
  initialParticipantName = "",
}: MeetingRoomClientProps) {
  const router = useRouter();
  const meetingId = (propMeetingId || propRoomName || "fellowship").trim();

  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [userChoices, setUserChoices] = useState<PreJoinChoices>({
    participantName: initialParticipantName,
    isMicEnabled: true,
    isCamEnabled: true,
  });

  const handlePreJoinSubmit = useCallback(
    async (choices: PreJoinChoices) => {
      setUserChoices(choices);
      setIsConnecting(true);
      setConnectionError(null);

      try {
        const res = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            participantName: choices.participantName,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to generate meeting credentials");
        }

        setToken(data.token);
        setLivekitUrl(data.url);
      } catch (err: unknown) {
        console.error("Token error:", err);
        setConnectionError(
          err instanceof Error ? err.message : "Error connecting to meeting"
        );
      } finally {
        setIsConnecting(false);
      }
    },
    [meetingId]
  );

  const handleLeave = useCallback(() => {
    router.push("/");
  }, [router]);

  // If no token, present the mobile-first PreJoin screen with camera/mic preview & share link
  if (!token) {
    return (
      <PreJoinScreen
        meetingId={meetingId}
        initialParticipantName={userChoices.participantName}
        onJoin={handlePreJoinSubmit}
        isConnecting={isConnecting}
      />
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#090d16] text-slate-100 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm text-center">
          <h2 className="text-base font-bold text-rose-400 mb-2">Connection Error</h2>
          <p className="text-xs text-slate-400 mb-4">{connectionError}</p>
          <button
            type="button"
            onClick={() => setToken(null)}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Back to Pre-Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={userChoices.isCamEnabled}
      audio={userChoices.isMicEnabled}
      token={token}
      serverUrl={livekitUrl || undefined}
      connect={true}
      data-lk-theme="default"
      onDisconnected={handleLeave}
      className="h-[100dvh] w-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden"
    >
      <RoomAudioRenderer />
      <MeetingContent meetingId={meetingId} onLeave={handleLeave} />
    </LiveKitRoom>
  );
}

// Inner Meeting Content executing within the LiveKitRoom context
function MeetingContent({
  meetingId,
  onLeave,
}: {
  meetingId: string;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");

  // Subscribe to all camera & screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const handleDisconnect = () => {
    try {
      room.disconnect();
    } finally {
      onLeave();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      {/* Top Mobile Header */}
      <MeetingHeader
        meetingId={meetingId}
        participantCount={participants.length}
        connectionState={connectionState}
        layoutMode={layoutMode}
        onToggleLayout={setLayoutMode}
      />

      {/* Main Video Stage with tight mobile margins */}
      <main className="flex-1 flex items-center justify-center p-1 xs:p-2 sm:p-4 overflow-hidden min-h-0">
        {layoutMode === "grid" ? (
          <ParticipantGrid tracks={tracks} />
        ) : (
          <SpeakerView tracks={tracks} />
        )}
      </main>

      {/* Bottom Floating Control Dock with safe area support */}
      <footer className="h-16 sm:h-20 flex items-center justify-center px-3 z-20 shrink-0 pb-safe">
        <MeetingControls onLeave={handleDisconnect} />
      </footer>
    </div>
  );
}
