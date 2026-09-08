"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Users, BookOpen, Shield, ArrowRight, Sparkles, HeartHandshake } from "lucide-react";
import { generateMeetingId } from "@/lib/utils/meetingId";

export default function HomePage() {
  const router = useRouter();
  const [participantName, setParticipantName] = useState("");
  const [meetingInput, setMeetingInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Restore saved participant name after mount asynchronously
  useEffect(() => {
    try {
      const savedName = localStorage.getItem("gracemeet_name");
      if (savedName) {
        queueMicrotask(() => {
          setParticipantName(savedName);
        });
      }
    } catch {
      // ignore local storage restrictions
    }
  }, []);

  const saveName = (name: string) => {
    try {
      localStorage.setItem("gracemeet_name", name);
    } catch {
      // ignore
    }
  };

  const handleStartInstantMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) {
      setErrorMsg("Please enter your name to start a meeting");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);
    saveName(participantName.trim());

    // Generate cryptographically unguessable meeting ID (e.g. fellowship-8f4k2m)
    const newMeetingId = generateMeetingId("fellowship");
    router.push(`/meeting/${encodeURIComponent(newMeetingId)}?name=${encodeURIComponent(participantName.trim())}`);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim()) {
      setErrorMsg("Please enter your name to join");
      return;
    }
    if (!meetingInput.trim()) {
      setErrorMsg("Please enter a meeting code or paste invite link");
      return;
    }

    // Support either direct meeting ID or full meeting URL pasted into input
    let cleanId = meetingInput.trim();
    if (cleanId.includes("/meeting/")) {
      cleanId = cleanId.split("/meeting/")[1].split("?")[0];
    } else if (cleanId.includes("/room/")) {
      cleanId = cleanId.split("/room/")[1].split("?")[0];
    }
    cleanId = cleanId.toLowerCase().replace(/\s+/g, "-");

    const idRegex = /^[a-zA-Z0-9_-]+$/;
    if (!idRegex.test(cleanId) || cleanId.length < 3) {
      setErrorMsg("Invalid meeting code or link");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);
    saveName(participantName.trim());
    router.push(`/meeting/${encodeURIComponent(cleanId)}?name=${encodeURIComponent(participantName.trim())}`);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#090d16] text-slate-100 selection:bg-amber-500/25 selection:text-amber-200">
      {/* Mobile-optimized Top Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 pt-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
              <span className="text-white font-bold text-base">✝</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white">
                GraceMeet
              </span>
              <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Church
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400 text-[11px] bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live SFU
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero & Action Section */}
      <main className="flex-1 flex flex-col justify-center items-center px-3.5 py-4 sm:py-8 md:py-12 max-w-5xl mx-auto w-full pb-safe">
        <div className="text-center max-w-2xl mb-5 sm:mb-8 space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700/40 text-indigo-300 text-[11px] font-medium">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Meet. Pray. Learn. Fellowship.</span>
          </div>

          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Sacred Fellowship, <br />
            <span className="bg-gradient-to-r from-amber-300 via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              Boundless Connection.
            </span>
          </h1>

          <p className="text-xs sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
            One-tap shareable meeting links crafted for prayer groups, church ministries, and Bible studies.
          </p>
        </div>

        {/* Meeting Setup Card */}
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl backdrop-blur-xl relative">
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <span className="text-rose-400 font-bold">!</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Participant Name Input */}
          <div className="mb-4 sm:mb-5">
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Your Name <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              id="participant-name-input"
              value={participantName}
              onChange={(e) => {
                setParticipantName(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              placeholder="e.g. Pastor David, Sarah"
              className="w-full h-11 sm:h-12 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm transition"
              maxLength={64}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-slate-800/70">
            {/* Primary Action: Instant Meeting */}
            <div className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl bg-gradient-to-b from-indigo-950/40 to-slate-950 border border-indigo-900/40 hover:border-indigo-700/60 transition">
              <div>
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-2">
                  <Video className="w-4 h-4 text-indigo-400" />
                </div>
                <h2 className="text-xs sm:text-sm font-semibold text-white">Start a Meeting</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Generate unique shareable link.
                </p>
              </div>

              <button
                type="button"
                id="btn-start-meeting"
                onClick={handleStartInstantMeeting}
                disabled={isSubmitting}
                className="mt-3 w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition disabled:opacity-60 cursor-pointer"
              >
                <span>Start Meeting</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Secondary Action: Join with Code or Link */}
            <div className="flex flex-col justify-between p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition">
              <div>
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <h2 className="text-xs sm:text-sm font-semibold text-white">Join Meeting</h2>
                <div className="mt-1.5">
                  <input
                    type="text"
                    id="meeting-code-input"
                    value={meetingInput}
                    onChange={(e) => {
                      setMeetingInput(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="Enter code or paste link"
                    className="w-full h-9 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-500"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button
                type="button"
                id="btn-join-meeting"
                onClick={handleJoinMeeting}
                disabled={isSubmitting}
                className="mt-3 w-full h-11 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-700/60 transition disabled:opacity-60 cursor-pointer"
              >
                <span>Join Meeting</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-3xl">
          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center sm:items-start gap-3">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">One-Tap Invite</h3>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                Share directly to WhatsApp & Telegram.
              </p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center sm:items-start gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Scripture Teaching</h3>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                Screen sharing for Bible study classes.
              </p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center sm:items-start gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Private & Self-Hosted</h3>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                Local LiveKit media server routing.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 py-3 text-center text-[11px] text-slate-500 pb-safe">
        <p>GraceMeet — Church-Focused Video Meetings</p>
      </footer>
    </div>
  );
}
