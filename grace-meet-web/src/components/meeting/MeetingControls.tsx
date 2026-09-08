"use client";

import { useState, useCallback } from "react";
import { useLocalParticipant, useIsSpeaking } from "@livekit/components-react";
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
import { GraceMediaState } from "@/lib/hooks/useGraceMediaState";

interface MeetingControlsProps {
  mediaState: GraceMediaState;
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
  mediaState,
  onLeave,
  onOpenShare,
  onRaiseHandToggle,
  isHandRaised = false,
  onSendReaction,
}: MeetingControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const isSpeaking = useIsSpeaking(localParticipant);

  const [isReactionsOpen, setIsReactionsOpen] = useState(false);

  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isCameraPending,
    isMicPending,
    cameraError,
    micError,
    hasMultipleCameras,
    toggleCamera,
    toggleMicrophone,
    flipCamera,
    clearErrors,
  } = mediaState;

  const handleToggleMic = useCallback(async () => {
    navigator.vibrate?.(35);
    try {
      await toggleMicrophone();
    } catch {
      // Error handled and stored in mediaState
    }
  }, [toggleMicrophone]);

  const handleToggleCam = useCallback(async () => {
    navigator.vibrate?.(35);
    try {
      await toggleCamera();
    } catch {
      // Error handled and stored in mediaState
    }
  }, [toggleCamera]);

  const handleFlipCamera = useCallback(async () => {
    navigator.vibrate?.(45);
    await flipCamera();
  }, [flipCamera]);

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

  const activeError = cameraError || micError;

  return (
    <div className="relative flex flex-col items-center select-none touch-manipulation">
      {/* Media Permission / Device Error Banner */}
      {activeError && (
        <div className="absolute -top-16 inset-x-0 w-80 sm:w-96 max-w-[90vw] mx-auto bg-rose-950/95 border border-rose-600/80 backdrop-blur-xl text-white px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2.5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">
              {activeError.message ||
                "Device permission blocked. Open browser settings (🔒 icon) and allow access."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearErrors();
              if (micError) handleToggleMic();
              else handleToggleCam();
            }}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 rounded-lg text-[10px] font-bold text-white shrink-0 cursor-pointer"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={clearErrors}
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
          onClick={handleToggleMic}
          disabled={isMicPending}
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
          {isMicPending ? (
            <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
          ) : isMicrophoneEnabled ? (
            <Mic className="w-5 h-5 text-slate-200" />
          ) : (
            <MicOff className="w-5 h-5 text-white" />
          )}
        </button>

        {/* 2. Camera Toggle */}
        <button
          type="button"
          id="btn-toggle-cam"
          onClick={handleToggleCam}
          disabled={isCameraPending}
          aria-label={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
          title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
            isCameraEnabled
              ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
          }`}
        >
          {isCameraPending ? (
            <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
          ) : isCameraEnabled ? (
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
            onClick={handleFlipCamera}
            disabled={!isCameraEnabled || isCameraPending}
            aria-label="Switch Camera (Front / Rear)"
            title="Switch Camera (Front / Rear)"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
              !isCameraEnabled
                ? "opacity-40 cursor-not-allowed bg-slate-800/50 text-slate-500"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80"
            }`}
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        )}

        {/* 4. Raise Hand Toggle */}
        <button
          type="button"
          id="btn-raise-hand"
          onClick={handleHandToggle}
          aria-label={isHandRaised ? "Lower Hand" : "Raise Hand"}
          title={isHandRaised ? "Lower Hand" : "Raise Hand"}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
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
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
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
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none"
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
