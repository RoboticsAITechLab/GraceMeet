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
  useDataChannel,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import PreJoinScreen, { PreJoinChoices } from "./PreJoinScreen";
import MeetingHeader, { LayoutMode } from "./MeetingHeader";
import MeetingControls from "./MeetingControls";
import ParticipantGrid from "./ParticipantGrid";
import SpeakerView from "./SpeakerView";
import AudioUnlockBanner from "./AudioUnlockBanner";
import FloatingReactions, { ReactionItem } from "./FloatingReactions";
import ShareInvite from "./ShareInvite";

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
    facingMode: "user",
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

        // Give phone camera driver 120ms to release hardware handle safely
        await new Promise((r) => setTimeout(r, 120));

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
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
      video={
        userChoices.isCamEnabled
          ? {
              facingMode: userChoices.facingMode || "user",
            }
          : false
      }
      audio={
        userChoices.isMicEnabled
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false
      }
      token={token}
      serverUrl={livekitUrl || undefined}
      connect={true}
      data-lk-theme="default"
      onDisconnected={handleLeave}
      onMediaDeviceFailure={(err) => {
        console.warn("LiveKit media device notice:", err);
      }}
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
  const { localParticipant } = useLocalParticipant();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});

  // Subscribe to all camera & screen share tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Real-time Data Channel for Reactions & Hand Raises
  const { send: sendBroadcast } = useDataChannel(
    "gracemeet-events",
    (message) => {
      try {
        const decoded = new TextDecoder().decode(message.payload);
        const data = JSON.parse(decoded);
        if (data.type === "reaction" && data.emoji) {
          const newReaction: ReactionItem = {
            id: `${Date.now()}-${Math.random()}`,
            emoji: data.emoji,
            xOffset: 15 + Math.random() * 65,
          };
          setReactions((prev) => [...prev.slice(-15), newReaction]);
        } else if (data.type === "hand" && data.identity) {
          setRaisedHands((prev) => ({
            ...prev,
            [data.identity]: !!data.raised,
          }));
        }
      } catch {
        // ignore malformed data
      }
    }
  );

  const handleSendReaction = useCallback(
    (emoji: string) => {
      const newReaction: ReactionItem = {
        id: `${Date.now()}-${Math.random()}`,
        emoji,
        xOffset: 15 + Math.random() * 65,
      };
      setReactions((prev) => [...prev.slice(-15), newReaction]);

      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: "reaction", emoji })
        );
        sendBroadcast(payload, { reliable: false });
      } catch (err) {
        console.error("Reaction broadcast error:", err);
      }
    },
    [sendBroadcast]
  );

  const handleReactionComplete = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleRaiseHandToggle = useCallback(
    (raised: boolean) => {
      if (!localParticipant) return;
      setRaisedHands((prev) => ({
        ...prev,
        [localParticipant.identity]: raised,
      }));

      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: "hand",
            identity: localParticipant.identity,
            raised,
          })
        );
        sendBroadcast(payload, { reliable: true });
      } catch (err) {
        console.error("Hand broadcast error:", err);
      }
    },
    [localParticipant, sendBroadcast]
  );

  const isLocalHandRaised = localParticipant
    ? !!raisedHands[localParticipant.identity]
    : false;

  const handleDisconnect = () => {
    try {
      room.disconnect();
    } finally {
      onLeave();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      {/* Audio Unlock Banner for Mobile Browsers */}
      <AudioUnlockBanner />

      {/* Kinetic Floating Reactions Overlay */}
      <FloatingReactions
        reactions={reactions}
        onReactionComplete={handleReactionComplete}
      />

      {/* Top Mobile Header */}
      <MeetingHeader
        meetingId={meetingId}
        participantCount={participants.length}
        connectionState={connectionState}
        layoutMode={layoutMode}
        onToggleLayout={setLayoutMode}
      />

      {/* Main Video Stage with tight mobile margins */}
      <main className="flex-1 flex items-center justify-center p-1 xs:p-2 sm:p-4 overflow-hidden min-h-0 relative">
        {layoutMode === "grid" ? (
          <ParticipantGrid tracks={tracks} raisedHands={raisedHands} />
        ) : (
          <SpeakerView tracks={tracks} />
        )}
      </main>

      {/* Bottom Floating Control Dock with safe area support */}
      <footer className="h-16 sm:h-20 flex items-center justify-center px-3 z-20 shrink-0 pb-safe">
        <MeetingControls
          onLeave={handleDisconnect}
          onOpenShare={() => setIsShareModalOpen(true)}
          onRaiseHandToggle={handleRaiseHandToggle}
          isHandRaised={isLocalHandRaised}
          onSendReaction={handleSendReaction}
        />
      </footer>

      {/* In-Call Share Invite Modal */}
      {isShareModalOpen && (
        <ShareInvite
          meetingId={meetingId}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}
