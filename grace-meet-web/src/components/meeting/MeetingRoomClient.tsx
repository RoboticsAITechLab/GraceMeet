"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import {
  Track,
  Room,
  VideoPresets,
  ConnectionState,
  DisconnectReason,
  RoomEvent,
} from "livekit-client";
import { RotateCw, WifiOff, AlertCircle } from "lucide-react";
import PreJoinScreen, { PreJoinChoices } from "./PreJoinScreen";
import MeetingHeader, { LayoutMode } from "./MeetingHeader";
import MeetingControls from "./MeetingControls";
import ParticipantGrid from "./ParticipantGrid";
import SpeakerView from "./SpeakerView";
import AudioUnlockBanner from "./AudioUnlockBanner";
import FloatingReactions, { ReactionItem } from "./FloatingReactions";
import ShareInvite from "./ShareInvite";
import { useGraceMediaState } from "@/lib/hooks/useGraceMediaState";

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
  const [isUnexpectedlyDisconnected, setIsUnexpectedlyDisconnected] =
    useState(false);
  const [isReconnectingManual, setIsReconnectingManual] = useState(false);

  const [userChoices, setUserChoices] = useState<PreJoinChoices>({
    participantName: initialParticipantName,
    isMicEnabled: true,
    isCamEnabled: true,
    facingMode: "user",
  });

  // Single, stable Room instance with adaptive stream, dynacast, and mobile VP8 simulcast
  const room = useMemo(() => {
    return new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h540.resolution,
      },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [
          VideoPresets.h180,
          VideoPresets.h360,
          VideoPresets.h540,
        ],
        videoCodec: "vp8",
        dtx: true,
        red: true,
      },
    });
  }, []);

  const handlePreJoinSubmit = useCallback(
    async (choices: PreJoinChoices) => {
      setUserChoices(choices);
      setIsConnecting(true);
      setConnectionError(null);
      setIsUnexpectedlyDisconnected(false);

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

        // Give phone camera driver 120ms to release preview hardware handle
        await new Promise((r) => setTimeout(r, 120));

        setToken(data.token);
        setLivekitUrl(data.url);
      } catch (err: unknown) {
        console.error("[GraceMeet][Room] Token error:", err);
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
    try {
      room.disconnect(true);
    } catch {
      // ignore
    }
    router.push("/");
  }, [router, room]);

  // Reset unexpected disconnect state if room successfully reconnects
  useEffect(() => {
    const handleConnectedOrReconnected = () => {
      setIsUnexpectedlyDisconnected(false);
    };

    room.on(RoomEvent.Connected, handleConnectedOrReconnected);
    room.on(RoomEvent.Reconnected, handleConnectedOrReconnected);

    return () => {
      room.off(RoomEvent.Connected, handleConnectedOrReconnected);
      room.off(RoomEvent.Reconnected, handleConnectedOrReconnected);
    };
  }, [room]);

  // Manual reconnect handler when connection was lost and auto-reconnect exhausted
  const handleManualReconnect = useCallback(async () => {
    if (!token || !livekitUrl || isReconnectingManual) return;
    setIsReconnectingManual(true);
    console.log("[GraceMeet][Reconnect] Attempting manual room reconnection...");
    try {
      await room.connect(livekitUrl, token);
      setIsUnexpectedlyDisconnected(false);
    } catch (err) {
      console.error("[GraceMeet][Reconnect] Direct reconnect failed:", err);
      // If token expired, fetch fresh token and connect
      try {
        const res = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            participantName: userChoices.participantName,
          }),
        });
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          setLivekitUrl(data.url);
          await room.connect(data.url, data.token);
          setIsUnexpectedlyDisconnected(false);
        }
      } catch (refreshErr) {
        console.error("[GraceMeet][Reconnect] Token renewal failed:", refreshErr);
      }
    } finally {
      setIsReconnectingManual(false);
    }
  }, [token, livekitUrl, isReconnectingManual, room, meetingId, userChoices.participantName]);

  // If no token, present the mobile-first PreJoin screen
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
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-rose-400 mb-2">
            Connection Error
          </h2>
          <p className="text-xs text-slate-400 mb-4">{connectionError}</p>
          <button
            type="button"
            onClick={() => {
              setToken(null);
              setConnectionError(null);
            }}
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
      room={room}
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
      onConnected={() => {
        console.log("[GraceMeet][Room] Connected to LiveKit SFU");
        setIsUnexpectedlyDisconnected(false);
      }}
      onDisconnected={(reason?: DisconnectReason) => {
        console.log("[GraceMeet][Room] Room disconnected, reason:", reason);
        if (reason === DisconnectReason.CLIENT_INITIATED) {
          handleLeave();
        } else {
          // Do NOT kick user out of meeting on network drops! Show recovery dialog
          setIsUnexpectedlyDisconnected(true);
        }
      }}
      onMediaDeviceFailure={(err) => {
        console.warn("[GraceMeet][Media] Media device notice:", err);
      }}
      className="h-[100dvh] w-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden relative"
    >
      <RoomAudioRenderer />
      <MeetingContent
        meetingId={meetingId}
        onLeave={handleLeave}
        userChoices={userChoices}
        isUnexpectedlyDisconnected={isUnexpectedlyDisconnected}
        isReconnectingManual={isReconnectingManual}
        onManualReconnect={handleManualReconnect}
      />
    </LiveKitRoom>
  );
}

// Inner Meeting Content executing within the LiveKitRoom context
function MeetingContent({
  meetingId,
  onLeave,
  userChoices,
  isUnexpectedlyDisconnected,
  isReconnectingManual,
  onManualReconnect,
}: {
  meetingId: string;
  onLeave: () => void;
  userChoices: PreJoinChoices;
  isUnexpectedlyDisconnected: boolean;
  isReconnectingManual: boolean;
  onManualReconnect: () => Promise<void>;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Centralized GraceMeet media controller as single source of truth
  const mediaState = useGraceMediaState(
    room,
    userChoices.facingMode,
    userChoices.isCamEnabled,
    userChoices.isMicEnabled
  );

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
        console.error("[GraceMeet][DataChannel] Reaction error:", err);
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
        console.error("[GraceMeet][DataChannel] Hand raise error:", err);
      }
    },
    [localParticipant, sendBroadcast]
  );

  const isLocalHandRaised = localParticipant
    ? !!raisedHands[localParticipant.identity]
    : false;

  const handleDisconnect = () => {
    try {
      room.disconnect(true);
    } finally {
      onLeave();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      {/* Audio Unlock Banner for Mobile Browsers */}
      <AudioUnlockBanner />

      {/* Non-blocking Reconnecting Floating Pill (never covers the video stage) */}
      {connectionState === ConnectionState.Reconnecting && (
        <div className="absolute top-13 xs:top-14 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
          <div className="bg-amber-500/95 backdrop-blur-md text-slate-950 font-bold text-[11px] sm:text-xs px-3.5 py-1 rounded-full shadow-xl flex items-center gap-1.5 animate-pulse border border-amber-400 pointer-events-auto">
            <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
            <span>Reconnecting to GraceMeet…</span>
          </div>
        </div>
      )}

      {/* Full In-Room Connection Lost Recovery Dialog (does NOT unmount meeting or kick user) */}
      {isUnexpectedlyDisconnected && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <WifiOff className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">
              Connection Lost
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Your connection to the GraceMeet room was interrupted. You can
              reconnect to resume fellowship.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onManualReconnect}
                disabled={isReconnectingManual}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isReconnectingManual ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Reconnecting...</span>
                  </>
                ) : (
                  <span>Reconnect</span>
                )}
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      )}

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
          mediaState={mediaState}
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
