"use client";

import { useMemo } from "react";
import { ParticipantTile, useSpeakingParticipants } from "@livekit/components-react";
import { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Volume2 } from "lucide-react";

interface SpeakerViewProps {
  tracks: TrackReferenceOrPlaceholder[];
}

export default function SpeakerView({ tracks }: SpeakerViewProps) {
  const speakingParticipants = useSpeakingParticipants();

  // Identify the active speaker's track, falling back to the first available track
  const { activeTrack, otherTracks } = useMemo(() => {
    if (tracks.length === 0) {
      return { activeTrack: null, otherTracks: [] };
    }

    // Try finding track belonging to active speaker
    const activeSpeakerIdentity = speakingParticipants[0]?.identity;
    let mainTrack = tracks[0];

    if (activeSpeakerIdentity) {
      const match = tracks.find(
        (t) => t.participant.identity === activeSpeakerIdentity
      );
      if (match) mainTrack = match;
    }

    const rest = tracks.filter((t) => t !== mainTrack);
    return { activeTrack: mainTrack, otherTracks: rest };
  }, [tracks, speakingParticipants]);

  if (!activeTrack) {
    return null;
  }

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto gap-1.5 sm:gap-3 overflow-hidden p-0.5 xs:p-1 sm:p-2">
      {/* Primary Active Speaker Stage */}
      <div className="flex-1 relative w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-0 flex items-center justify-center">
        <ParticipantTile
          trackRef={activeTrack}
          className="w-full h-full object-cover"
        />

        {/* Active Speaker Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-amber-300 text-[10px] sm:text-xs font-semibold shadow-md">
          <Volume2 className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>Active Speaker</span>
        </div>
      </div>

      {/* Secondary Filmstrip for Other Participants (Compact on Phone) */}
      {otherTracks.length > 0 && (
        <div className="h-20 xs:h-24 sm:h-32 shrink-0 flex items-center gap-2 overflow-x-auto py-0.5 px-0.5">
          {otherTracks.map((track) => {
            const key =
              track.publication?.trackSid ||
              `${track.participant.identity}-${track.source}`;

            return (
              <div
                key={key}
                className="relative h-full aspect-video rounded-lg sm:rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md shrink-0 transition-transform active:scale-95"
              >
                <ParticipantTile
                  trackRef={track}
                  className="w-full h-full object-cover text-xs"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
