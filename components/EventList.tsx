"use client";

import type { VoiceSignalEvent, VoiceSignalType, Severity } from "@/types";

const SIGNAL_COLORS: Record<VoiceSignalType, string> = {
  fast_pace: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  hesitation: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  confidence_dip: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  stress_spike: "bg-red-500/20 text-red-400 border-red-500/30",
  filler_cluster: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  timing_overrun_risk: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  recovery: "bg-green-500/20 text-green-400 border-green-500/30",
  overlap_risk: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const COACHING_LABELS: Record<VoiceSignalType, string> = {
  fast_pace: "Pace increased significantly",
  hesitation: "Delivery showed hesitation",
  confidence_dip: "Confidence dipped",
  stress_spike: "Stress spike detected",
  filler_cluster: "Filler word cluster",
  timing_overrun_risk: "At risk of running over time",
  recovery: "Strong recovery",
  overlap_risk: "Overlap risk",
};

const SEVERITY_DOTS: Record<Severity, string> = {
  low: "bg-green-400",
  medium: "bg-amber-400",
  high: "bg-red-400",
};

interface EventListProps {
  events: VoiceSignalEvent[];
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
}

export function EventList({
  events,
  selectedEventId,
  onSelectEvent,
}: EventListProps) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
        Delivery Events ({events.length})
      </h3>
      <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
        {events.map((event) => {
          const isSelected = event.id === selectedEventId;

          return (
            <button
              key={event.id}
              onClick={() => onSelectEvent?.(event.id)}
              className={`
                flex items-start gap-3 p-3 rounded-lg text-left transition-all
                ${isSelected ? "bg-neutral-800 ring-1 ring-neutral-700" : "hover:bg-neutral-800/50"}
              `}
            >
              {/* Timestamp */}
              <span className="text-xs font-mono text-neutral-500 pt-0.5 shrink-0 w-10">
                {formatMs(event.tStartMs)}
              </span>

              {/* Type badge */}
              <span
                className={`
                  text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0
                  ${SIGNAL_COLORS[event.type]}
                `}
              >
                {event.type.replace(/_/g, " ")}
              </span>

              {/* Severity dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOTS[event.severity]}`}
                title={event.severity}
              />

              {/* Coaching-framed note */}
              <span className="text-sm text-neutral-300 leading-snug">
                {event.note ?? COACHING_LABELS[event.type]}
              </span>
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
