"use client";

import type { VoiceSignalEvent, VoiceSignalType } from "@/types";

const SIGNAL_COLORS: Record<VoiceSignalType, string> = {
  fast_pace: "bg-violet-500",
  hesitation: "bg-amber-500",
  confidence_dip: "bg-blue-500",
  stress_spike: "bg-red-500",
  filler_cluster: "bg-orange-500",
  timing_overrun_risk: "bg-rose-500",
  recovery: "bg-green-500",
  overlap_risk: "bg-yellow-500",
};

const SIGNAL_LABELS: Record<VoiceSignalType, string> = {
  fast_pace: "Fast Pace",
  hesitation: "Hesitation",
  confidence_dip: "Confidence Dip",
  stress_spike: "Stress Spike",
  filler_cluster: "Filler Cluster",
  timing_overrun_risk: "Timing Risk",
  recovery: "Recovery",
  overlap_risk: "Overlap Risk",
};

interface SignalsTimelineProps {
  events: VoiceSignalEvent[];
  durationMs: number;
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
}

export function SignalsTimeline({
  events,
  durationMs,
  selectedEventId,
  onSelectEvent,
}: SignalsTimelineProps) {
  if (durationMs === 0) return null;

  return (
    <div className="flex flex-col gap-3 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
        Voice Signals Timeline
      </h3>

      {/* Timeline bar */}
      <div className="relative w-full h-12 bg-neutral-950 rounded-lg border border-neutral-800">
        {/* Time markers */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <div
            key={pct}
            className="absolute top-0 h-full border-l border-neutral-800"
            style={{ left: `${pct * 100}%` }}
          >
            <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] text-neutral-600">
              {formatMs(pct * durationMs)}
            </span>
          </div>
        ))}

        {/* Event markers */}
        {events.map((event) => {
          const leftPct = (event.tStartMs / durationMs) * 100;
          const widthPct = event.tEndMs
            ? ((event.tEndMs - event.tStartMs) / durationMs) * 100
            : 1;
          const isSelected = event.id === selectedEventId;

          return (
            <button
              key={event.id}
              onClick={() => onSelectEvent?.(event.id)}
              className={`
                absolute top-1 h-10 rounded cursor-pointer transition-all
                ${SIGNAL_COLORS[event.type]}
                ${isSelected ? "opacity-100 ring-2 ring-white" : "opacity-60 hover:opacity-90"}
              `}
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 0.8)}%`,
                minWidth: "6px",
              }}
              title={`${SIGNAL_LABELS[event.type]} (${formatMs(event.tStartMs)})`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {Array.from(new Set(events.map((e) => e.type))).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${SIGNAL_COLORS[type]}`} />
            <span className="text-xs text-neutral-400">{SIGNAL_LABELS[type]}</span>
          </div>
        ))}
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
