"use client";

import { useState, useRef } from "react";
import { ThumbsUp, ThumbsDown, Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FeedbackSignal } from "@/lib/types";

interface FeedbackWidgetProps {
  searchId: string;
  repoUrl: string;
}

const FEEDBACK_OPTIONS: {
  signal: FeedbackSignal;
  icon: typeof ThumbsUp;
  label: string;
  activeColor: string;
}[] = [
  {
    signal: "useful",
    icon: ThumbsUp,
    label: "Useful",
    activeColor: "text-teal bg-teal/10 border-teal/30",
  },
  {
    signal: "not_useful",
    icon: ThumbsDown,
    label: "Not useful",
    activeColor: "text-amber-600 bg-amber-50 border-amber-300",
  },
  {
    signal: "inaccurate",
    icon: Flag,
    label: "Inaccurate",
    activeColor: "text-destructive bg-destructive/10 border-destructive/30",
  },
];

export function FeedbackWidget({ searchId, repoUrl }: FeedbackWidgetProps) {
  const [selected, setSelected] = useState<FeedbackSignal | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedSignals = useRef(new Set<FeedbackSignal>());

  async function submitFeedback(signal: FeedbackSignal, feedbackComment?: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_id: searchId,
          repo_url: repoUrl,
          signal,
          ...(feedbackComment ? { comment: feedbackComment } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      toast.success("Feedback submitted. Thanks!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit feedback"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelect(signal: FeedbackSignal) {
    if (selected === signal) {
      // Deselect
      setSelected(null);
      setShowComment(false);
      setComment("");
      return;
    }

    setSelected(signal);
    setShowComment(true);

    // Skip API call if this signal was already submitted
    if (!submittedSignals.current.has(signal)) {
      submittedSignals.current.add(signal);
      submitFeedback(signal);
    }
  }

  function handleCommentSubmit() {
    if (!selected || !comment.trim()) return;
    submitFeedback(selected, comment.trim());
    setShowComment(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {FEEDBACK_OPTIONS.map(({ signal, icon: Icon, label, activeColor }) => (
          <button
            key={signal}
            type="button"
            disabled={isSubmitting}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(signal);
            }}
            title={label}
            aria-label={label}
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-transparent p-1.5 transition-all",
              "text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary",
              "disabled:pointer-events-none disabled:opacity-50",
              selected === signal && activeColor
            )}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>

      {showComment && selected && (
        <div className="flex items-center gap-1.5 animate-slide-up">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommentSubmit();
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Add a comment (optional)"
            className="h-7 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal/40"
          />
          <button
            type="button"
            disabled={!comment.trim() || isSubmitting}
            onClick={(e) => {
              e.stopPropagation();
              handleCommentSubmit();
            }}
            className="h-7 rounded-md bg-teal px-2.5 text-xs font-medium text-white transition-colors hover:bg-teal/90 disabled:pointer-events-none disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
