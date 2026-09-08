"use client";

import { useEffect, useState } from "react";

export interface ReactionItem {
  id: string;
  emoji: string;
  xOffset: number; // percentage across screen 10-90
}

interface FloatingReactionsProps {
  reactions: ReactionItem[];
  onReactionComplete: (id: string) => void;
}

export default function FloatingReactions({
  reactions,
  onReactionComplete,
}: FloatingReactionsProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {reactions.map((r) => (
        <ReactionBubble
          key={r.id}
          reaction={r}
          onComplete={() => onReactionComplete(r.id)}
        />
      ))}
    </div>
  );
}

function ReactionBubble({
  reaction,
  onComplete,
}: {
  reaction: ReactionItem;
  onComplete: () => void;
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute bottom-24 text-3xl sm:text-4xl animate-float-reaction select-none filter drop-shadow-lg pointer-events-none"
      style={{
        left: `${reaction.xOffset}%`,
      }}
    >
      {reaction.emoji}
    </div>
  );
}
