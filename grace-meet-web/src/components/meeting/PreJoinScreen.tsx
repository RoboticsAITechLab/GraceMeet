"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createLocalVideoTrack,
  createLocalAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack,
} from "livekit-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Share2,
  Copy,
  Check,
  SwitchCamera,
} from "lucide-react";
import ShareInvite from "./ShareInvite";
import { getMeetingUrl } from "@/lib/utils/meetingId";

export interface PreJoinChoices {
  participantName: string;
  isMicEnabled: boolean;
  isCamEnabled: boolean;
  facingMode?: "user" | "environment";
}

interface PreJoinScreenProps {
  meetingId: string;
  initialParticipantName?: string;
  onJoin: (choices: PreJoinChoices) => void;
  isConnecting?: boolean;
}

export default function PreJoinScreen({
  meetingId,
  initialParticipantName = "",
  onJoin,
  isConnecting = false,
}: PreJoinScreenProps) {
  const router = useRouter();
  const [participantName, setParticipantName] = useState(initialParticipantName);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedQuick, setCopiedQuick] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const meetingUrl = getMeetingUrl(meetingId);

  // Load saved name from localStorage asynchronously
  useEffect(() => {
    if (!initialParticipantName) {
      try {
        const saved = localStorage.getItem("gracemeet_name");
        if (saved) {
          queueMicrotask(() => {
            setParticipantName(saved);
          });
        }
      } catch {
        // ignore
      }
    }
  }, [initialParticipantName]);

  const stopAllTracks = useCallback(() => {
    if (videoTrackRef.current) {
      try {
        videoTrackRef.current.stop();
      } catch {
        // ignore
      }
      videoTrackRef.current = null;
    }
    if (audioTrackRef.current) {
      try {
        audioTrackRef.current.stop();
      } catch {
        // ignore
      }
      audioTrackRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = "";
    }
  }, []);

  // Video track lifecycle effect with portrait mobile sensor fallback
  useEffect(() => {
    let isCancelled = false;

    async function setupVideo() {
      if (!isCamEnabled) {
        if (videoTrackRef.current) {
          videoTrackRef.current.stop();
          videoTrackRef.current = null;
        }
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = "";
        }
        return;
      }

      try {
        if (videoTrackRef.current) {
          videoTrackRef.current.stop();
        }

        // Try ideal constraints first, fallback to basic facingMode for restrictive mobile sensors
        let videoTrack: LocalVideoTrack;
        try {
          videoTrack = await createLocalVideoTrack({
            facingMode,
            resolution: {
              width: 640,
              height: 480,
              frameRate: 30,
            },
          });
        } catch {
          videoTrack = await createLocalVideoTrack({
            facingMode,
          });
        }

        if (isCancelled) {
          videoTrack.stop();
          return;
        }

        videoTrackRef.current = videoTrack;

        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = "";
          const el = videoTrack.attach();
          el.className = `w-full h-full object-cover rounded-xl sm:rounded-2xl ${
            facingMode === "user" ? "-scale-x-100" : ""
          }`;
          videoContainerRef.current.appendChild(el);
        }
        setMediaError(null);
      } catch (err: unknown) {
        if (!isCancelled) {
          console.warn("Camera access warning:", err);
          setMediaError("Camera permission blocked. Tap allow or join with mic only.");
        }
      }
    }

    setupVideo();

    return () => {
      isCancelled = true;
    };
  }, [isCamEnabled, facingMode]);

  // Audio track lifecycle effect
  useEffect(() => {
    let isCancelled = false;

    async function setupAudio() {
      if (!isMicEnabled) {
        if (audioTrackRef.current) {
          audioTrackRef.current.stop();
          audioTrackRef.current = null;
        }
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        return;
      }

      try {
        if (audioTrackRef.current) {
          audioTrackRef.current.stop();
        }
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
        });

        if (isCancelled) {
          audioTrack.stop();
          return;
        }

        audioTrackRef.current = audioTrack;

        const mediaStream = audioTrack.mediaStream;
        if (mediaStream && typeof window !== "undefined" && window.AudioContext) {
          const audioCtx = new (
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(mediaStream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkAudio = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkAudio);
          };
          animFrameRef.current = requestAnimationFrame(checkAudio);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.warn("Microphone access warning:", err);
          setIsMicEnabled(false);
          setMediaError("Microphone permission denied.");
        }
      }
    }

    setupAudio();

    return () => {
      isCancelled = true;
    };
  }, [isMicEnabled]);

  // Cleanup all tracks on final unmount
  useEffect(() => {
    return () => {
      stopAllTracks();
    };
  }, [stopAllTracks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = participantName.trim();
    if (!cleanName || isConnecting) return;

    try {
      localStorage.setItem("gracemeet_name", cleanName);
    } catch {
      // ignore
    }

    stopAllTracks();

    onJoin({
      participantName: cleanName,
      isMicEnabled,
      isCamEnabled,
      facingMode,
    });
  };

  const handleQuickCopy = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopiedQuick(true);
      setTimeout(() => setCopiedQuick(false), 2000);
    } catch (err) {
      console.error("Quick copy failed:", err);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "✝";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#090d16] text-slate-100 selection:bg-amber-500/25 selection:text-amber-200">
      {/* Mobile-optimized Slim Header */}
      <header className="h-13 sm:h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-3 sm:px-8 flex items-center justify-between z-20 shrink-0 pt-safe">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm sm:text-base">✝</span>
          </div>
          <span className="text-sm sm:text-base font-bold text-white tracking-tight">
            GraceMeet
          </span>
        </div>

        {/* Top Right: Share Invite Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="h-8 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Invite</span>
          </button>
        </div>
      </header>

      {/* Main Content: Mobile-First Single-Scroll Viewport */}
      <main className="flex-1 flex flex-col justify-center items-center px-3 py-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full pb-safe">
        <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 items-center">
          
          {/* Top on Mobile / Left on Desktop: Live Camera Preview */}
          <div className="w-full lg:col-span-7 flex flex-col items-center">
            <div className="relative w-full h-48 xs:h-56 sm:h-72 lg:h-80 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Live Video Element */}
              <div
                ref={videoContainerRef}
                className={`w-full h-full absolute inset-0 ${
                  !isCamEnabled ? "hidden" : "block"
                }`}
              />

              {/* Camera Off Avatar Fallback */}
              {!isCamEnabled && (
                <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-inner">
                    <span className="text-xl sm:text-2xl font-bold text-amber-400">
                      {getInitials(participantName)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Camera Off
                  </p>
                </div>
              )}

              {/* Top Name Badge */}
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="text-[10px] sm:text-[11px] font-medium bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-800 text-slate-300">
                  {participantName.trim() || "Guest"}
                </span>
              </div>

              {/* Audio Level Indicator */}
              <div className="absolute top-2.5 right-2.5 z-10">
                {isMicEnabled ? (
                  <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-full border border-slate-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="w-8 sm:w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-75"
                        style={{ width: `${Math.max(8, audioLevel)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-rose-950/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-rose-800 text-[10px] text-rose-300 font-medium">
                    <MicOff className="w-3 h-3 text-rose-400" />
                    <span>Muted</span>
                  </div>
                )}
              </div>

              {/* Fast Media Toggles Overlaid on Bottom of Video */}
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3 z-10">
                <button
                  type="button"
                  id="prejoin-toggle-mic"
                  onClick={() => setIsMicEnabled((p) => !p)}
                  title={isMicEnabled ? "Mute Microphone" : "Unmute Microphone"}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-lg active:scale-95 ${
                    isMicEnabled
                      ? "bg-slate-800/90 hover:bg-slate-700 text-white backdrop-blur-md border border-slate-700"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                  }`}
                >
                  {isMicEnabled ? (
                    <Mic className="w-5 h-5 text-slate-200" />
                  ) : (
                    <MicOff className="w-5 h-5 text-white" />
                  )}
                </button>

                <button
                  type="button"
                  id="prejoin-toggle-cam"
                  onClick={() => setIsCamEnabled((p) => !p)}
                  title={isCamEnabled ? "Turn Off Camera" : "Turn On Camera"}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-lg active:scale-95 ${
                    isCamEnabled
                      ? "bg-slate-800/90 hover:bg-slate-700 text-white backdrop-blur-md border border-slate-700"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                  }`}
                >
                  {isCamEnabled ? (
                    <VideoIcon className="w-5 h-5 text-slate-200" />
                  ) : (
                    <VideoOff className="w-5 h-5 text-white" />
                  )}
                </button>

                {/* Flip Camera (Front / Rear) */}
                <button
                  type="button"
                  id="prejoin-flip-cam"
                  onClick={() => {
                    navigator.vibrate?.(40);
                    setFacingMode((f) => (f === "user" ? "environment" : "user"));
                  }}
                  disabled={!isCamEnabled}
                  title="Switch Camera (Front / Back)"
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-lg active:scale-95 ${
                    !isCamEnabled
                      ? "opacity-40 cursor-not-allowed bg-slate-800/40 text-slate-600"
                      : "bg-slate-800/90 hover:bg-slate-700 text-slate-200 backdrop-blur-md border border-slate-700"
                  }`}
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom on Mobile / Right on Desktop: Join Form + Meeting Ready Card */}
          <div className="w-full lg:col-span-5 flex flex-col">
            <div className="bg-slate-900/95 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="mb-3">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Fellowship Ready
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Confirm your name and invite participants
                </p>
              </div>

              {/* Shareable Link Display Box with Quick Copy */}
              <div className="mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-amber-300 truncate select-all">
                  {meetingUrl}
                </span>
                <button
                  type="button"
                  onClick={handleQuickCopy}
                  title="Copy meeting link"
                  className="h-7 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium flex items-center gap-1 shrink-0 transition active:scale-95 cursor-pointer"
                >
                  {copiedQuick ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {mediaError && (
                <div className="mb-3 p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{mediaError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Your Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="prejoin-participant-name"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="e.g. Pastor David, Sarah"
                    className="w-full h-11 sm:h-12 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                    maxLength={64}
                    required
                    disabled={isConnecting}
                  />
                </div>

                {/* Compact Device Chips */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsMicEnabled((p) => !p)}
                    className="h-10 px-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 cursor-pointer active:scale-95 transition text-left"
                  >
                    <div className={isMicEnabled ? "text-emerald-400" : "text-rose-400"}>
                      {isMicEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[11px] font-medium text-slate-300 truncate">
                      {isMicEnabled ? "Mic On" : "Mic Muted"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCamEnabled((p) => !p)}
                    className="h-10 px-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 cursor-pointer active:scale-95 transition text-left"
                  >
                    <div className={isCamEnabled ? "text-emerald-400" : "text-rose-400"}>
                      {isCamEnabled ? <VideoIcon className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[11px] font-medium text-slate-300 truncate">
                      {isCamEnabled ? "Camera On" : "Camera Off"}
                    </span>
                  </button>
                </div>

                {/* Primary Join Action (Big 48px touch target) */}
                <button
                  type="submit"
                  id="btn-join-fellowship"
                  disabled={isConnecting || !participantName.trim()}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-98 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Meeting</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1 text-amber-400 hover:underline cursor-pointer"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Share Invite</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopAllTracks();
                    router.push("/");
                  }}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Share Invite Modal / Bottom Sheet */}
      <ShareInvite
        meetingId={meetingId}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
