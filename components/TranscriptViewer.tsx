"use client";

import type { TranscriptSegment, VoiceSignalType } from "@/types";

const FLAG_UNDERLINE_COLORS: Record<VoiceSignalType, string> = {
  fast_pace: "decoration-violet-500",
  hesitation: "decoration-amber-500",
  confidence_dip: "decoration-blue-500",
  stress_spike: "decoration-red-500",
  filler_cluster: "decoration-orange-500",
  timing_overrun_risk: "decoration-rose-500",
  recovery: "decoration-green-500",
  overlap_risk: "decoration-yellow-500",
};

const FLAG_BG_COLORS: Record<VoiceSignalType, string> = {
  fast_pace: "bg-violet-500/10",
  hesitation: "bg-amber-500/10",
  confidence_dip: "bg-blue-500/10",
  stress_spike: "bg-red-500/10",
  filler_cluster: "bg-orange-500/10",
  timing_overrun_risk: "bg-rose-500/10",
  recovery: "bg-green-500/10",
  overlap_risk: "bg-yellow-500/10",
};

const FLAG_LABELS: Record<VoiceSignalType, string> = {
  fast_pace: "Pace increased",
  hesitation: "Hesitation detected",
  confidence_dip: "Confidence dip",
  stress_spike: "Stress spike",
  filler_cluster: "Filler words",
  timing_overrun_risk: "Timing risk",
  recovery: "Strong recovery",
  overlap_risk: "Overlap risk",
};

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  onSelectSegment?: (segmentId: string) => void;
  selectedSegmentId?: string | null;
}

export function TranscriptViewer({
  segments,
  onSelectSegment,
  selectedSegmentId,
}: TranscriptViewerProps) {
  if (segments.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
        Transcript
      </h3>
      <div className="flex flex-col gap-2">
        {segments.map((seg) => {
          const hasFlags = seg.flags.length > 0;
          const isSelected = seg.id === selectedSegmentId;
          // Use the first flag for primary coloring
          const primaryFlag = seg.flags[0];

          return (
            <button
              key={seg.id}
              onClick={() => onSelectSegment?.(seg.id)}
              className={`
                text-left p-3 rounded-lg transition-all
                ${isSelected ? "ring-1 ring-neutral-600" : ""}
                ${hasFlags && primaryFlag ? FLAG_BG_COLORS[primaryFlag] : "hover:bg-neutral-800/30"}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Timestamp */}
                <span className="text-[10px] font-mono text-neutral-600 pt-1 shrink-0 w-10">
                  {formatMs(seg.tStartMs)}
                </span>

                <div className="flex flex-col gap-1.5">
                  {/* Transcript text */}
                  <p
                    className={`
                      text-sm leading-relaxed
                      ${
                        hasFlags && primaryFlag
                          ? `text-neutral-200 underline underline-offset-4 decoration-wavy ${FLAG_UNDERLINE_COLORS[primaryFlag]}`
                          : "text-neutral-400"
                      }
                    `}
                  >
                    {seg.text}
                  </p>

                  {/* Flag badges */}
                  {hasFlags && (
                    <div className="flex flex-wrap gap-1">
                      {seg.flags.map((flag) => (
                        <span
                          key={flag}
                          className="text-[10px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded"
                        >
                          {FLAG_LABELS[flag]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}:${s.toString().padStart(2, "0")}`;
}
