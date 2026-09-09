"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useRoomContext,
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import {
  Wifi,
  WifiOff,
  RotateCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Video,
  VideoOff,
  Mic,
  MicOff,
  AlertCircle,
  CheckCircle2,
  Server,
  User,
  ShieldCheck,
  Activity,
} from "lucide-react";

export type MediaDiagnosticState = "connected" | "off" | "error" | "starting" | "unavailable";

interface LiveKitStatusProps {
  className?: string;
}

export default function LiveKitStatus({ className = "" }: LiveKitStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTechDetailsOpen, setIsTechDetailsOpen] = useState(false);

  const room = useRoomContext();
  const connectionState = useConnectionState();
  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
    cameraTrack,
    microphoneTrack,
    lastCameraError,
    lastMicrophoneError,
  } = useLocalParticipant();

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close panel on Click Outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Derive Room Name directly from connected LiveKit room
  const roomName = useMemo(() => {
    if (room?.name) return room.name;
    if (connectionState === ConnectionState.Connected) return "Active Room";
    return "Not connected";
  }, [room, connectionState]);

  // Derive Participant Connection status
  const isParticipantConnected = useMemo(() => {
    if (connectionState !== ConnectionState.Connected) return false;
    return !!localParticipant;
  }, [connectionState, localParticipant]);

  // Accurately derive Camera Track state from actual LiveKit publication/track/error
  const cameraState: MediaDiagnosticState = useMemo(() => {
    if (connectionState === ConnectionState.Disconnected) {
      return "unavailable";
    }

    if (lastCameraError && !cameraTrack?.track) {
      return "error";
    }

    if (isCameraEnabled) {
      if (
        cameraTrack?.track &&
        !cameraTrack.isMuted &&
        cameraTrack.track.mediaStreamTrack?.readyState === "live"
      ) {
        return "connected";
      }
      if (!cameraTrack?.track) {
        return "starting";
      }
      return "off";
    }

    return "off";
  }, [connectionState, isCameraEnabled, cameraTrack, lastCameraError]);

  // Accurately derive Microphone Track state from actual LiveKit publication/track/error
  const microphoneState: MediaDiagnosticState = useMemo(() => {
    if (connectionState === ConnectionState.Disconnected) {
      return "unavailable";
    }

    if (lastMicrophoneError && !microphoneTrack?.track) {
      return "error";
    }

    if (isMicrophoneEnabled) {
      if (
        microphoneTrack?.track &&
        !microphoneTrack.isMuted &&
        microphoneTrack.track.mediaStreamTrack?.readyState === "live"
      ) {
        return "connected";
      }
      if (!microphoneTrack?.track) {
        return "starting";
      }
      return "off";
    }

    return "off";
  }, [connectionState, isMicrophoneEnabled, microphoneTrack, lastMicrophoneError]);

  // Compact Header Indicator config based on ConnectionState
  const statusConfig = useMemo(() => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return {
          label: "LiveKit Connected",
          shortLabel: "Connected",
          icon: <Wifi className="w-3 h-3 text-emerald-400" />,
          pillClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
          dotClass: "bg-emerald-400",
        };
      case ConnectionState.Reconnecting:
        return {
          label: "Reconnecting…",
          shortLabel: "Reconnecting…",
          icon: <RotateCw className="w-3 h-3 text-amber-400 animate-spin" />,
          pillClass: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
          dotClass: "bg-amber-400 animate-ping",
        };
      case ConnectionState.Connecting:
        return {
          label: "Connecting…",
          shortLabel: "Connecting…",
          icon: <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />,
          pillClass: "text-sky-400 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20",
          dotClass: "bg-sky-400",
        };
      case ConnectionState.Disconnected:
      default:
        return {
          label: "Disconnected",
          shortLabel: "Disconnected",
          icon: <WifiOff className="w-3 h-3 text-rose-400" />,
          pillClass: "text-rose-400 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20",
          dotClass: "bg-rose-400",
        };
    }
  }, [connectionState]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* 1. Header Compact Status Indicator (Accessible Trigger) */}
      <button
        ref={triggerRef}
        type="button"
        id="livekit-diagnostics-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`LiveKit connection diagnostics: ${statusConfig.label}. Click to view media status.`}
        title="Click to open LiveKit connection & media diagnostics"
        className={`h-8 px-2 sm:px-2.5 rounded-lg border flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${statusConfig.pillClass}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className={`rounded-full h-1.5 w-1.5 ${statusConfig.dotClass}`} />
        </span>
        {statusConfig.icon}
        <span className="hidden sm:inline">{statusConfig.label}</span>
        <span className="inline sm:hidden">{statusConfig.shortLabel}</span>
      </button>

      {/* 2. Diagnostics Popover (Desktop) / Bottom Sheet (Mobile) */}
      {isOpen && (
        <div className="fixed sm:absolute inset-0 sm:inset-auto sm:right-0 sm:top-10 sm:mt-1 z-50 flex items-end sm:items-start justify-center sm:justify-end bg-black/60 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none p-0 sm:p-0">
          {/* Mobile backdrop click to dismiss */}
          <div
            className="fixed inset-0 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="LiveKit Connection & Media Diagnostics"
            className="relative w-full max-w-md sm:w-84 bg-slate-900/98 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl z-10 text-slate-200 animate-in fade-in slide-in-from-bottom-3 sm:slide-in-from-top-2 duration-150"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    LiveKit Diagnostics
                  </h3>
                  <p className="text-[10px] text-slate-400">Session & Realtime Media Status</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close diagnostics panel"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Section */}
            <div className="py-3 space-y-2.5 border-b border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  Status
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  {connectionState === ConnectionState.Connected && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  )}
                  {connectionState === ConnectionState.Reconnecting && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                      Reconnecting
                    </span>
                  )}
                  {connectionState === ConnectionState.Connecting && (
                    <span className="flex items-center gap-1 text-sky-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                      Connecting
                    </span>
                  )}
                  {connectionState === ConnectionState.Disconnected && (
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Disconnected
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  Room
                </span>
                <span
                  className="font-mono text-[11px] text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 max-w-[190px] truncate"
                  title={roomName}
                >
                  {roomName}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Participant
                </span>
                <span className="text-xs font-medium">
                  {isParticipantConnected ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  ) : connectionState === ConnectionState.Reconnecting ? (
                    <span className="text-amber-400">Reconnecting…</span>
                  ) : (
                    <span className="text-rose-400">Not connected</span>
                  )}
                </span>
              </div>
            </div>

            {/* Realtime Media Section */}
            <div className="py-3 space-y-2.5 border-b border-slate-800/80">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Realtime Media
              </span>

              {/* Camera Status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  {cameraState === "connected" ? (
                    <Video className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <VideoOff className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Camera
                </span>
                <MediaBadge state={cameraState} errorMsg={lastCameraError?.message} />
              </div>

              {/* Microphone Status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  {microphoneState === "connected" ? (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <MicOff className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  Microphone
                </span>
                <MediaBadge state={microphoneState} errorMsg={lastMicrophoneError?.message} />
              </div>
            </div>

            {/* Technical Details Expandable Section */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsTechDetailsOpen((p) => !p)}
                className="w-full flex items-center justify-between text-[11px] font-medium text-slate-400 hover:text-slate-200 py-1 cursor-pointer transition"
              >
                <span>Technical Details</span>
                {isTechDetailsOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {isTechDetailsOpen && (
                <div className="mt-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-[10px] font-mono text-slate-300 animate-in fade-in duration-150">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Connection State:</span>
                    <span className="text-slate-300">{connectionState}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room Name:</span>
                    <span className="text-amber-300 truncate max-w-[150px]" title={roomName}>
                      {roomName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Identity:</span>
                    <span
                      className="text-slate-300 truncate max-w-[150px]"
                      title={localParticipant?.identity || "none"}
                    >
                      {localParticipant?.identity || "none"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Participant Name:</span>
                    <span className="text-slate-300 truncate max-w-[150px]">
                      {localParticipant?.name || "none"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Camera Track:</span>
                    <span className="text-slate-300">
                      {cameraTrack?.trackSid ? "Published" : "Not Published"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Camera ReadyState:</span>
                    <span className="text-slate-300">
                      {cameraTrack?.track?.mediaStreamTrack?.readyState || "none"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Microphone Track:</span>
                    <span className="text-slate-300">
                      {microphoneTrack?.trackSid ? "Published" : "Not Published"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mic ReadyState:</span>
                    <span className="text-slate-300">
                      {microphoneTrack?.track?.mediaStreamTrack?.readyState || "none"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">getUserMedia API:</span>
                    <span className="text-emerald-400">
                      {typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" ? "Available" : "Not Found"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ICE Candidates:</span>
                    <span className="text-slate-300">Dual STUN (Cloudflare + Google)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">TURN Relay:</span>
                    <span className={process.env.NEXT_PUBLIC_TURN_URL ? "text-emerald-400" : "text-amber-400/80"}>
                      {process.env.NEXT_PUBLIC_TURN_URL ? "Enabled (Custom TURN)" : "Direct/STUN (TURN Optional)"}
                    </span>
                  </div>
                  {(lastCameraError || lastMicrophoneError) && (
                    <div className="pt-1 text-[9px] text-rose-400 border-t border-slate-800">
                      {lastCameraError && <div>Cam Error: {lastCameraError.message}</div>}
                      {lastMicrophoneError && <div>Mic Error: {lastMicrophoneError.message}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaBadge({
  state,
  errorMsg,
}: {
  state: MediaDiagnosticState;
  errorMsg?: string;
}) {
  switch (state) {
    case "connected":
      return (
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Connected
        </span>
      );
    case "starting":
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Starting
        </span>
      );
    case "error":
      return (
        <span
          className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold flex items-center gap-1 cursor-help"
          title={errorMsg || "Device error"}
        >
          <AlertCircle className="w-3 h-3" />
          Error
        </span>
      );
    case "unavailable":
      return <span className="text-slate-500 text-[10px]">— Not available</span>;
    case "off":
    default:
      return (
        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-medium flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          Off
        </span>
      );
  }
}
