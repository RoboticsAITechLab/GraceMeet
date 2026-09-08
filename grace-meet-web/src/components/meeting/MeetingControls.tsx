"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useLocalParticipant,
  useRoomContext,
  useIsSpeaking,
} from "@livekit/components-react";
import { Room, Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  Hand,
  Smile,
  Share2,
  AlertCircle,
  RotateCw,
} from "lucide-react";

interface MeetingControlsProps {
  onLeave: () => void;
  onOpenShare: () => void;
  onRaiseHandToggle?: (raised: boolean) => void;
  isHandRaised?: boolean;
  onSendReaction?: (emoji: string) => void;
}

const REACTION_EMOJIS = [
  { emoji: "🙏", label: "Amen" },
  { emoji: "✝️", label: "Faith" },
  { emoji: "🤲", label: "Pray" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🙌", label: "Praise" },
  { emoji: "👏", label: "Clap" },
];

export default function MeetingControls({
  onLeave,
  onOpenShare,
  onRaiseHandToggle,
  isHandRaised = false,
  onSendReaction,
}: MeetingControlsProps) {
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();
  const isSpeaking = useIsSpeaking(localParticipant);

  const [isTogglingMic, setIsTogglingMic] = useState(false);
  const [isTogglingCam, setIsTogglingCam] = useState(false);
  const [isFlippingCam, setIsFlippingCam] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isReactionsOpen, setIsReactionsOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<{
    type: "mic" | "camera";
    message: string;
  } | null>(null);

  // Check if device has multiple cameras (front + back)
  useEffect(() => {
    async function checkCameras() {
      try {
        const devices = await Room.getLocalDevices("videoinput");
        if (devices.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch {
        // Fallback for mobile devices: assume true on touch screens
        if (typeof window !== "undefined" && "ontouchstart" in window) {
          setHasMultipleCameras(true);
        }
      }
    }
    checkCameras();
  }, []);

  // Safe phone-optimized mic toggle with immediate tactile response
  const toggleMic = useCallback(async () => {
    if (!localParticipant || isTogglingMic) return;
    navigator.vibrate?.(35);
    setIsTogglingMic(true);
    setPermissionError(null);

    try {
      const nextState = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(nextState);
    } catch (err: unknown) {
      console.error("Microphone toggle error:", err);
      setPermissionError({
        type: "mic",
        message:
          "Microphone permission blocked. Please allow mic in your browser settings (🔒 icon).",
      });
    } finally {
      setIsTogglingMic(false);
    }
  }, [localParticipant, isMicrophoneEnabled, isTogglingMic]);

  // Safe phone-optimized camera toggle
  const toggleCam = useCallback(async () => {
    if (!localParticipant || isTogglingCam) return;
    navigator.vibrate?.(35);
    setIsTogglingCam(true);
    setPermissionError(null);

    try {
      const nextState = !isCameraEnabled;
      await localParticipant.setCameraEnabled(nextState, {
        facingMode,
      });
    } catch (err: unknown) {
      console.error("Camera toggle error:", err);
      setPermissionError({
        type: "camera",
        message:
          "Camera permission blocked. Please allow camera in your browser settings (🔒 icon).",
      });
    } finally {
      setIsTogglingCam(false);
    }
  }, [localParticipant, isCameraEnabled, isTogglingCam, facingMode]);

  // Flip Camera between front selfie and rear camera for phone users
  const flipCamera = useCallback(async () => {
    if (!localParticipant || !isCameraEnabled || isFlippingCam) return;
    navigator.vibrate?.(45);
    setIsFlippingCam(true);

    const nextFacing = facingMode === "user" ? "environment" : "user";
    try {
      const devices = await Room.getLocalDevices("videoinput");
      if (devices.length > 1 && room) {
        const currentTrack = localParticipant.getTrackPublication(
          Track.Source.Camera
        )?.track;
        const currentDeviceId =
          currentTrack?.mediaStreamTrack?.getSettings()?.deviceId;
        const otherDevice = devices.find(
          (d) => d.deviceId && d.deviceId !== currentDeviceId
        );
        if (otherDevice) {
          await room.switchActiveDevice("videoinput", otherDevice.deviceId);
          setFacingMode(nextFacing);
          return;
        }
      }

      // Fallback restart with alternate facing mode
      await localParticipant.setCameraEnabled(false);
      await new Promise((r) => setTimeout(r, 120));
      await localParticipant.setCameraEnabled(true, { facingMode: nextFacing });
      setFacingMode(nextFacing);
    } catch (err) {
      console.error("Flip camera error:", err);
    } finally {
      setIsFlippingCam(false);
    }
  }, [localParticipant, isCameraEnabled, isFlippingCam, facingMode, room]);

  const handleHandToggle = useCallback(() => {
    navigator.vibrate?.(40);
    onRaiseHandToggle?.(!isHandRaised);
  }, [isHandRaised, onRaiseHandToggle]);

  const handleSelectReaction = useCallback(
    (emoji: string) => {
      navigator.vibrate?.(30);
      onSendReaction?.(emoji);
      setIsReactionsOpen(false);
    },
    [onSendReaction]
  );

  return (
    <div className="relative flex flex-col items-center select-none touch-manipulation">
      {/* Device Permission Error Toast */}
      {permissionError && (
        <div className="absolute -top-16 inset-x-0 w-80 sm:w-96 max-w-[90vw] mx-auto bg-rose-950/95 border border-rose-600/80 backdrop-blur-xl text-white px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2.5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">
              {permissionError.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (permissionError.type === "mic") toggleMic();
              else toggleCam();
            }}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 rounded-lg text-[10px] font-bold text-white shrink-0 cursor-pointer"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setPermissionError(null)}
            className="text-slate-400 hover:text-white p-1 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Reactions Tray */}
      {isReactionsOpen && (
        <div className="absolute -top-16 bg-slate-900/95 backdrop-blur-2xl px-3 py-2 rounded-full border border-slate-700/80 shadow-2xl flex items-center gap-2 z-30 animate-in fade-in zoom-in-95 duration-150">
          {REACTION_EMOJIS.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => handleSelectReaction(r.emoji)}
              className="w-10 h-10 rounded-full hover:bg-slate-800 active:scale-125 transition-transform flex items-center justify-center text-xl cursor-pointer"
              title={r.label}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Control Dock */}
      <nav
        aria-label="Meeting Controls"
        className="flex items-center gap-2 xs:gap-3 sm:gap-3.5 bg-slate-900/95 backdrop-blur-2xl px-3 xs:px-4 sm:px-6 py-2 rounded-full border border-slate-800/90 shadow-2xl z-30"
      >
        {/* 1. Microphone Toggle */}
        <button
          type="button"
          id="btn-toggle-mic"
          onClick={toggleMic}
          disabled={isTogglingMic}
          aria-label={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
          title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
          className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
            isMicrophoneEnabled
              ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
          }`}
        >
          {isSpeaking && isMicrophoneEnabled && (
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-75 pointer-events-none" />
          )}
          {isMicrophoneEnabled ? (
            <Mic className="w-5 h-5 text-slate-200" />
          ) : (
            <MicOff className="w-5 h-5 text-white" />
          )}
        </button>

        {/* 2. Camera Toggle */}
        <button
          type="button"
          id="btn-toggle-cam"
          onClick={toggleCam}
          disabled={isTogglingCam}
          aria-label={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
          title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
            isCameraEnabled
              ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
          }`}
        >
          {isCameraEnabled ? (
            <VideoIcon className="w-5 h-5 text-slate-200" />
          ) : (
            <VideoOff className="w-5 h-5 text-white" />
          )}
        </button>

        {/* 3. Flip Camera (Mobile Front/Rear Switcher) */}
        {(hasMultipleCameras || isCameraEnabled) && (
          <button
            type="button"
            id="btn-flip-camera"
            onClick={flipCamera}
            disabled={!isCameraEnabled || isFlippingCam}
            aria-label="Switch Camera (Front / Rear)"
            title="Switch Camera (Front / Rear)"
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
              !isCameraEnabled
                ? "opacity-40 cursor-not-allowed bg-slate-800/50 text-slate-500"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80"
            }`}
          >
            {isFlippingCam ? (
              <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <SwitchCamera className="w-4 h-4" />
            )}
          </button>
        )}

        {/* 4. Raise Hand Toggle */}
        <button
          type="button"
          id="btn-raise-hand"
          onClick={handleHandToggle}
          aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
          title={isHandRaised ? "Lower Hand" : "Raise Hand"}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
            isHandRaised
              ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30 ring-2 ring-amber-400"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80"
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        {/* 5. Fellowship Reactions Tray Button */}
        <button
          type="button"
          id="btn-reactions"
          onClick={() => setIsReactionsOpen((p) => !p)}
          aria-label="Fellowship Reactions"
          title="Fellowship Reactions"
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
            isReactionsOpen
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80"
          }`}
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* 6. Quick Share Invite Button */}
        <button
          type="button"
          id="btn-quick-share"
          onClick={onOpenShare}
          aria-label="Share Meeting Invite"
          title="Share Meeting Invite"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none"
        >
          <Share2 className="w-4 h-4 text-emerald-400" />
        </button>

        <div className="h-6 w-px bg-slate-800 mx-0.5" />

        {/* 7. Leave Call Button */}
        <button
          type="button"
          id="btn-leave-meeting"
          onClick={onLeave}
          aria-label="Leave Meeting"
          title="Leave Meeting"
          className="h-11 sm:h-12 px-4 xs:px-5 sm:px-6 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-90 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/25 transition-all focus:outline-none cursor-pointer"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden xs:inline">Leave</span>
        </button>
      </nav>
    </div>
  );
}
