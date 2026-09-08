"use client";

import { ParticipantTile } from "@livekit/components-react";
import { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Sparkles } from "lucide-react";

interface ParticipantGridProps {
  tracks: TrackReferenceOrPlaceholder[];
  raisedHands?: Record<string, boolean>;
}

export default function ParticipantGrid({
  tracks,
  raisedHands = {},
}: ParticipantGridProps) {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-900/60 border border-slate-800 rounded-2xl max-w-xs sm:max-w-md mx-auto">
        <div className="h-10 w-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-2.5">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-sm sm:text-base font-semibold text-white">Connecting Media...</h2>
        <p className="text-xs text-slate-400 mt-1">
          Synchronizing participant video and audio with LiveKit.
        </p>
      </div>
    );
  }

  // Mobile-first phone-optimized grid configuration
  const getGridClasses = (count: number) => {
    if (count === 1) {
      // 1 Participant: Full mobile stage
      return "grid-cols-1 grid-rows-1 h-full w-full max-w-4xl";
    }
    if (count === 2) {
      // 2 Participants: Stacked top/bottom on mobile portrait (FaceTime style), 2 columns on tablet/desktop!
      return "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 h-full w-full max-w-6xl";
    }
    if (count <= 4) {
      // 3-4 Participants: 2x2 grid on mobile & desktop
      return "grid-cols-2 grid-rows-2 h-full w-full max-w-6xl";
    }
    if (count <= 6) {
      // 5-6 Participants: 2 cols x 3 rows on mobile, 3 cols x 2 rows on desktop
      return "grid-cols-2 sm:grid-cols-3 h-full w-full max-w-7xl";
    }
    // 7+ Participants: Scalable scrollable grid
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 h-full w-full max-w-7xl";
  };

  return (
    <div
      className={`grid gap-1.5 xs:gap-2 sm:gap-3.5 w-full h-full items-center justify-center mx-auto overflow-hidden p-0.5 xs:p-1 sm:p-2 ${getGridClasses(
        tracks.length
      )}`}
    >
      {tracks.map((track) => {
        const key =
          track.publication?.trackSid ||
          `${track.participant.identity}-${track.source}`;
        const isHandRaised = !!raisedHands[track.participant.identity];

        return (
          <div
            key={key}
            className="relative w-full h-full min-h-0 flex items-center justify-center rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md"
          >
            {isHandRaised && (
              <div className="absolute top-2 left-2 z-20 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-bounce pointer-events-none">
                <span>✋</span>
                <span className="hidden xs:inline">Hand Raised</span>
              </div>
            )}
            <ParticipantTile
              trackRef={track}
              className="w-full h-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
}
