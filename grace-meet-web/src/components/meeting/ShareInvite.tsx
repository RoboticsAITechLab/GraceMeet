"use client";

import { useState } from "react";
import { Copy, Check, Share2, X, Sparkles, MessageCircle } from "lucide-react";
import { getMeetingUrl, formatInviteMessage } from "@/lib/utils/meetingId";

interface ShareInviteProps {
  meetingId: string;
  meetingTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareInvite({ meetingId, meetingTitle, isOpen, onClose }: ShareInviteProps) {
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  if (!isOpen) return null;

  const meetingUrl = getMeetingUrl(meetingId);
  const inviteMessage = formatInviteMessage(meetingId, meetingTitle);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Copy link error:", err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "GraceMeet Fellowship Invitation",
          text: inviteMessage,
          url: meetingUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.warn("Native share error:", err);
          handleCopyLink();
        }
      }
    } else {
      // Fallback: copy to clipboard
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const encodedText = encodeURIComponent(inviteMessage);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm transition-opacity">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-base font-bold text-white tracking-tight">
                Invite to Fellowship
              </h2>
              <p className="text-[11px] text-slate-400">Share this meeting with friends & cell group</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meeting Link Readout */}
        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Meeting Link
          </label>
          <div className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <span className="text-xs font-mono text-amber-300 truncate flex-1 select-all">
              {meetingUrl}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={`h-11 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
              copied
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-300" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* Native Web Share Button (WhatsApp, Telegram, Messages) */}
          <button
            type="button"
            onClick={handleNativeShare}
            className="h-11 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{shareSuccess ? "Shared!" : "Share Link"}</span>
          </button>
        </div>

        {/* WhatsApp Quick Direct Share */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>Share via WhatsApp</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-4">
          Anyone with this link can enter the pre-join room directly.
        </p>
      </div>
    </div>
  );
}
