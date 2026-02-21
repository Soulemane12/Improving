"use client";

import type { AnalysisStatus } from "@/types";

const STEPS: { key: AnalysisStatus; label: string }[] = [
  { key: "processing_audio", label: "Processing Audio" },
  { key: "extracting_voice_signals", label: "Extracting Voice Signals" },
  { key: "scoring", label: "Computing Scores" },
  { key: "strategy_selection", label: "Selecting Strategy" },
  { key: "coaching_ready", label: "Coaching Ready" },
];

function getStepIndex(status: AnalysisStatus): number {
  return STEPS.findIndex((s) => s.key === status);
}

interface ProcessingStatusProps {
  status: AnalysisStatus;
}

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  const currentIdx = getStepIndex(status);

  if (status === "recording") return null;

  return (
    <div className="flex flex-col gap-3 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
        Analysis Progress
      </h3>
      <div className="flex flex-col gap-2">
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {/* Step indicator */}
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0
                  ${isComplete ? "bg-green-500/20 text-green-400" : ""}
                  ${isCurrent ? "bg-white/10 text-white" : ""}
                  ${isPending ? "bg-neutral-800 text-neutral-600" : ""}
                `}
              >
                {isComplete ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : isCurrent ? (
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 bg-neutral-600 rounded-full" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm ${
                  isComplete
                    ? "text-green-400"
                    : isCurrent
                      ? "text-white font-medium"
                      : "text-neutral-600"
                }`}
              >
                {step.label}
              </span>

              {/* Current step animation */}
              {isCurrent && (
                <span className="text-xs text-neutral-500 animate-pulse">
                  ...
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
