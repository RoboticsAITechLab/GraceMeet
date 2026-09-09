"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Video,
  Users,
  BookOpen,
  Shield,
  ArrowRight,
  Sparkles,
  HeartHandshake,
  Check,
  Copy,
  Share2,
  RotateCcw,
} from "lucide-react";
import { formatInviteMessage } from "@/lib/utils/meetingId";

interface CreatedMeetingData {
  meetingId: string;
  title: string;
  url: string;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#090d16]" />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active view tab: 'create' | 'join'
  const isCreateParam = searchParams.get("create") === "true";
  const [activeTab, setActiveTab] = useState<"create" | "join">(isCreateParam ? "create" : "create");

  // Participant / Host details
  const [participantName, setParticipantName] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingInput, setMeetingInput] = useState("");

  // Submission & state handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdMeeting, setCreatedMeeting] = useState<CreatedMeetingData | null>(null);

  // Copy & Share feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharedNotice, setSharedNotice] = useState(false);

  // Quick suggestions for church meeting titles
  const SUGGESTED_TITLES = [
    "Sunday Prayer",
    "Bible Study",
    "Cell Fellowship",
    "Worship Practice",
  ];

  // Restore saved participant name after mount
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

  // Handle Meeting Creation Flow
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const titleToUse = meetingTitle.trim() || "Sunday Fellowship";
    setIsSubmitting(true);

    if (participantName.trim()) {
      saveName(participantName.trim());
    }

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleToUse,
          hostName: participantName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create meeting");
      }

      // Transition to Meeting Created View
      setCreatedMeeting({
        meetingId: data.meeting.meetingId,
        title: data.meeting.title,
        url: data.url,
      });
    } catch (err: unknown) {
      console.error("[GraceMeet] Create meeting error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Error creating meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Start Meeting (navigation from Meeting Created screen)
  const handleStartMeeting = () => {
    if (!createdMeeting) return;
    const nameParam = participantName.trim() ? `?name=${encodeURIComponent(participantName.trim())}` : "";
    router.push(`/meeting/${encodeURIComponent(createdMeeting.meetingId)}${nameParam}`);
  };

  // Handle Copy Link
  const handleCopyLink = async () => {
    if (!createdMeeting) return;
    try {
      await navigator.clipboard.writeText(createdMeeting.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Handle Share (Web Share API with fallback)
  const handleShare = async () => {
    if (!createdMeeting) return;
    const inviteText = formatInviteMessage(createdMeeting.meetingId, createdMeeting.title);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `GraceMeet: ${createdMeeting.title}`,
          text: inviteText,
          url: createdMeeting.url,
        });
        setSharedNotice(true);
        setTimeout(() => setSharedNotice(false), 2000);
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      // Fallback: Copy to clipboard
      handleCopyLink();
    }
  };

  // Handle Guest Joining Existing Meeting
  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
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
      setErrorMsg("Invalid meeting code or link format");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);
    if (participantName.trim()) {
      saveName(participantName.trim());
    }

    const nameParam = participantName.trim() ? `?name=${encodeURIComponent(participantName.trim())}` : "";
    router.push(`/meeting/${encodeURIComponent(cleanId)}${nameParam}`);
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
            Permanent, reusable meeting links crafted for church congregations, prayer groups, and Bible studies.
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

          {/* STATE 1: Meeting Created Screen */}
          {createdMeeting ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center pb-2">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-6 h-6" />
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full mb-1">
                  Meeting Created
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {createdMeeting.title}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Your permanent meeting link is ready. Share it anytime with participants.
                </p>
              </div>

              {/* Permanent URL Display Box */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
                    Permanent Link
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-mono">
                    ID: {createdMeeting.meetingId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-mono text-amber-300 truncate select-all flex-1">
                    {createdMeeting.url}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Copy Link & Share */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`h-11 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                    copiedLink
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="h-11 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{sharedNotice ? "Shared!" : "Share"}</span>
                </button>
              </div>

              {/* Primary Action: Start Meeting */}
              <button
                type="button"
                id="btn-start-created-meeting"
                onClick={handleStartMeeting}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-98 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <span>Start Meeting</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Reset to create another meeting */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedMeeting(null);
                    setMeetingTitle("");
                  }}
                  className="text-[11px] text-slate-400 hover:text-white transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Create another meeting</span>
                </button>
              </div>
            </div>
          ) : (
            /* STATE 2: Tabs (Create Meeting / Join Meeting) */
            <div>
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-slate-950 p-1 mb-5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("create");
                    setErrorMsg("");
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTab === "create"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Create Meeting</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("join");
                    setErrorMsg("");
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTab === "join"
                      ? "bg-slate-800 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Join Meeting</span>
                </button>
              </div>

              {/* Participant / Host Name Input (Common to both) */}
              <div className="mb-4">
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

              {/* TAB 1: CREATE MEETING */}
              {activeTab === "create" && (
                <form onSubmit={handleCreateMeeting} className="space-y-4">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      id="meeting-title-input"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="e.g. Sunday Prayer"
                      className="w-full h-11 sm:h-12 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition"
                      maxLength={80}
                      disabled={isSubmitting}
                    />

                    {/* Church-appropriate quick suggestions */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {SUGGESTED_TITLES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setMeetingTitle(t)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition cursor-pointer ${
                            meetingTitle === t
                              ? "bg-amber-500/20 border-amber-500 text-amber-300"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    Generates a permanent link that can be reused for future gatherings.
                  </p>

                  <button
                    type="submit"
                    id="btn-create-meeting"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Creating Meeting...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Meeting</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TAB 2: JOIN MEETING */}
              {activeTab === "join" && (
                <form onSubmit={handleJoinMeeting} className="space-y-4">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Meeting Link or Code <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="meeting-code-input"
                      value={meetingInput}
                      onChange={(e) => {
                        setMeetingInput(e.target.value);
                        if (errorMsg) setErrorMsg("");
                      }}
                      placeholder="e.g. grace-7xk92m or paste full link"
                      className="w-full h-11 sm:h-12 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm font-mono transition"
                      disabled={isSubmitting}
                    />
                  </div>

                  <button
                    type="submit"
                    id="btn-join-meeting"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-100 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 transition disabled:opacity-60 cursor-pointer"
                  >
                    <span>Join Meeting</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Feature Badges */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-3xl">
          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center sm:items-start gap-3">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Permanent Link</h3>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                Reuse the same link weekly for cell groups and prayer calls.
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
                HD screen sharing for Bible study and sermon classes.
              </p>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center sm:items-start gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Private & Dedicated</h3>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
                Self-hosted LiveKit SFU WebRTC routing.
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
