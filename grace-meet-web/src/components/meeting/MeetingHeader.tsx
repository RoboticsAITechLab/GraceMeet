"use client";

import { useState, useEffect } from "react";
import { ConnectionState } from "livekit-client";
import {
  Users,
  Share2,
  Wifi,
  WifiOff,
  LayoutGrid,
  UserCheck,
} from "lucide-react";
import ShareInvite from "./ShareInvite";

export type LayoutMode = "grid" | "speaker";

interface MeetingHeaderProps {
  meetingId: string;
  meetingTitle?: string;
  participantCount: number;
  connectionState: ConnectionState;
  layoutMode: LayoutMode;
  onToggleLayout: (mode: LayoutMode) => void;
}

export default function MeetingHeader({
  meetingId,
  meetingTitle,
  participantCount,
  connectionState,
  layoutMode,
  onToggleLayout,
}: MeetingHeaderProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSec % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <>
      <header className="h-12 sm:h-14 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md px-2.5 sm:px-6 flex items-center justify-between z-20 shrink-0 pt-safe">
        {/* Left: Brand + Title / Room Code */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white font-bold text-xs">✝</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs text-white tracking-tight hidden sm:inline shrink-0">
              GraceMeet
            </span>
            {meetingTitle && (
              <span className="text-xs text-slate-300 font-medium truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] hidden xs:inline">
                · {meetingTitle}
              </span>
            )}
            <span className="text-[10px] sm:text-[11px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium truncate max-w-[90px] xs:max-w-[120px] sm:max-w-[160px] shrink-0">
              {meetingId}
            </span>
          </div>
        </div>

        {/* Right: Meeting Status & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Quick Layout Switcher Button */}
          <button
            type="button"
            onClick={() => onToggleLayout(layoutMode === "grid" ? "speaker" : "grid")}
            title={`Switch to ${layoutMode === "grid" ? "Speaker View" : "Grid View"}`}
            className="h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1 text-[11px] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer"
          >
            {layoutMode === "grid" ? (
              <>
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Speaker</span>
              </>
            ) : (
              <>
                <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Grid</span>
              </>
            )}
          </button>

          {/* Meeting Timer */}
          <div className="text-[10px] sm:text-xs font-mono text-slate-400 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
            {formatTimer(elapsedSeconds)}
          </div>

          {/* Connection Indicator */}
          <div className="flex items-center">
            {connectionState === ConnectionState.Connected ? (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 p-1.5 sm:px-2 sm:py-1 rounded-lg border border-emerald-500/20 text-[10px]">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden md:inline">Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 p-1.5 sm:px-2 sm:py-1 rounded-lg border border-amber-500/20 text-[10px]">
                <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
                <span className="hidden md:inline">{connectionState}</span>
              </span>
            )}
          </div>

          {/* Participant Count */}
          <div className="flex items-center gap-1 text-slate-300 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-[10px] sm:text-xs">
            <Users className="w-3 h-3 text-slate-400" />
            <span>{participantCount}</span>
          </div>

          {/* Share Invite Trigger Button */}
          <button
            type="button"
            id="btn-share-invite-header"
            onClick={() => setIsShareModalOpen(true)}
            title="Share meeting invitation link"
            className="h-8 px-2.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 text-xs rounded-lg border border-amber-500/30 transition active:scale-95 cursor-pointer flex items-center gap-1.5 font-medium"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline text-[11px]">Invite</span>
          </button>
        </div>
      </header>

      {/* Share Invite Modal / Bottom Sheet */}
      <ShareInvite
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </>
  );
}
