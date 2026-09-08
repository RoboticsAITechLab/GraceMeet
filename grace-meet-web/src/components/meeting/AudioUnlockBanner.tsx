"use client";

import { useAudioPlayback, useRoomContext } from "@livekit/components-react";
import { Volume2 } from "lucide-react";

export default function AudioUnlockBanner() {
  const room = useRoomContext();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);

  if (canPlayAudio) {
    return null;
  }

  return (
    <div className="fixed top-14 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 animate-bounce">
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(40);
          startAudio();
        }}
        className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xl shadow-amber-500/40 border border-amber-300 active:scale-95 transition-all cursor-pointer"
      >
        <Volume2 className="w-4 h-4 animate-pulse" />
        <span>Tap to enable audio & speaker on this phone</span>
      </button>
    </div>
  );
}
