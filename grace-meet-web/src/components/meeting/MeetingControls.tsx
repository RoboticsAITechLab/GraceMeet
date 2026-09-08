"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
} from "lucide-react";

interface MeetingControlsProps {
  onLeave: () => void;
}

export default function MeetingControls({ onLeave }: MeetingControlsProps) {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const [isTogglingMic, setIsTogglingMic] = useState(false);
  const [isTogglingCam, setIsTogglingCam] = useState(false);

  const toggleMic = async () => {
    if (!localParticipant || isTogglingMic) return;
    setIsTogglingMic(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error("Error toggling microphone:", err);
    } finally {
      setIsTogglingMic(false);
    }
  };

  const toggleCam = async () => {
    if (!localParticipant || isTogglingCam) return;
    setIsTogglingCam(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error("Error toggling camera:", err);
    } finally {
      setIsTogglingCam(false);
    }
  };

  return (
    <nav
      aria-label="Meeting Controls"
      className="flex items-center gap-3 sm:gap-4 bg-slate-900/95 backdrop-blur-2xl px-4 sm:px-6 py-2 rounded-full border border-slate-800/90 shadow-2xl z-30"
    >
      {/* Microphone Button (48px touch target) */}
      <button
        type="button"
        id="btn-toggle-mic"
        onClick={toggleMic}
        disabled={isTogglingMic}
        aria-label={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
        title={isMicrophoneEnabled ? "Mute Microphone" : "Unmute Microphone"}
        className={`w-12 h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
          isMicrophoneEnabled
            ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80"
            : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
        }`}
      >
        {isMicrophoneEnabled ? (
          <Mic className="w-5 h-5 text-slate-200" />
        ) : (
          <MicOff className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Camera Button (48px touch target) */}
      <button
        type="button"
        id="btn-toggle-cam"
        onClick={toggleCam}
        disabled={isTogglingCam}
        aria-label={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
        title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
        className={`w-12 h-12 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-90 focus:outline-none ${
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

      <div className="h-6 w-px bg-slate-800 mx-0.5" />

      {/* Leave Button */}
      <button
        type="button"
        id="btn-leave-meeting"
        onClick={onLeave}
        aria-label="Leave Meeting"
        title="Leave Meeting"
        className="h-12 px-5 sm:px-6 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-90 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/25 transition-all focus:outline-none cursor-pointer"
      >
        <PhoneOff className="w-4 h-4" />
        <span className="hidden xs:inline">Leave</span>
      </button>
    </nav>
  );
}
