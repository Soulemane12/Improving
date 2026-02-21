"use client";

import type { CaptureState } from "@/types";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

interface RecordingPanelProps {
  state: CaptureState;
  elapsedMs: number;
  targetSec: number;
  onStart: () => void;
  onStop: () => void;
  hasConsented: boolean;
  onConsent: () => void;
}

export function RecordingPanel({
  state,
  elapsedMs,
  targetSec,
  onStart,
  onStop,
  hasConsented,
  onConsent,
}: RecordingPanelProps) {
  const isRecording = state === "recording";
  const elapsed = formatTime(elapsedMs);
  const target = formatTime(targetSec * 1000);
  const progress = targetSec > 0 ? Math.min((elapsedMs / 1000 / targetSec) * 100, 100) : 0;

  if (!hasConsented) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            Microphone Access Required
          </h3>
          <p className="text-sm text-neutral-400 max-w-md">
            This app needs access to your microphone to record your practice
            session. Audio is processed for coaching feedback and is not stored
            permanently.
          </p>
        </div>
        <button
          onClick={onConsent}
          className="px-6 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition-colors"
        >
          Allow Microphone Access
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      {/* Timer */}
      <div className="flex items-baseline gap-2 font-mono">
        <span className={`text-4xl font-bold ${isRecording ? "text-red-400" : "text-white"}`}>
          {elapsed}
        </span>
        <span className="text-neutral-500 text-lg">/ {target}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            progress >= 100 ? "bg-amber-500" : "bg-white"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Record/Stop button */}
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={state === "error"}
        className={`
          flex items-center gap-2 px-8 py-3 rounded-full font-medium text-sm transition-all
          ${
            isRecording
              ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
              : "bg-white text-black hover:bg-neutral-200"
          }
          ${state === "error" ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {isRecording ? (
          <>
            <span className="w-3 h-3 bg-red-500 rounded-sm animate-pulse" />
            Stop Recording
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" />
            </svg>
            {state === "stopped" ? "Record Again" : "Start Recording"}
          </>
        )}
      </button>

      {state === "error" && (
        <p className="text-sm text-red-400">
          Could not access microphone. Please check permissions.
        </p>
      )}
    </div>
  );
}
