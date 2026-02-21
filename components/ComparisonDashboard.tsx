"use client";

import type { MetricDelta, RunComparison } from "@/types";

function trendIcon(trend: MetricDelta["trend"]): string {
  if (trend === "improved") return "\u25B2"; // ▲
  if (trend === "declined") return "\u25BC"; // ▼
  return "\u2501"; // ━
}

function trendColor(trend: MetricDelta["trend"]): string {
  if (trend === "improved") return "text-green-400";
  if (trend === "declined") return "text-red-400";
  return "text-neutral-500";
}

function trendBg(trend: MetricDelta["trend"]): string {
  if (trend === "improved") return "bg-green-500/10 border-green-500/20";
  if (trend === "declined") return "bg-red-500/10 border-red-500/20";
  return "bg-neutral-800/50 border-neutral-700/50";
}

function formatDelta(delta: MetricDelta): string {
  const abs = Math.abs(delta.delta);
  // For filler rate and stress index, show decimal values
  if (delta.label === "Filler Rate") return abs.toFixed(1);
  if (delta.label === "Stress Index") return abs.toFixed(2);
  return String(Math.round(abs));
}

function formatValue(delta: MetricDelta): string {
  if (delta.label === "Filler Rate") return delta.current.toFixed(1);
  if (delta.label === "Stress Index") return delta.current.toFixed(2);
  return String(Math.round(delta.current));
}

function summaryBg(comparison: RunComparison): string {
  if (comparison.improvedCount > comparison.declinedCount)
    return "bg-green-500/10 border-green-500/20";
  if (comparison.declinedCount > comparison.improvedCount)
    return "bg-red-500/10 border-red-500/20";
  return "bg-amber-500/10 border-amber-500/20";
}

interface ComparisonDashboardProps {
  comparison: RunComparison | null;
}

export function ComparisonDashboard({
  comparison,
}: ComparisonDashboardProps) {
  if (!comparison) return null;

  const deltas: MetricDelta[] = [
    comparison.overall,
    comparison.pace,
    comparison.confidence,
    comparison.clarity,
    comparison.timingCompliance,
    comparison.hookStrength,
    comparison.ctaStrength,
    comparison.fillerRate,
    comparison.stressIndex,
  ];

  return (
    <div className="flex flex-col gap-3 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
          Run {comparison.runNumber} vs Previous
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">
            {comparison.improvedCount} improved
          </span>
          <span className="text-red-400">
            {comparison.declinedCount} declined
          </span>
          <span className="text-neutral-500">
            {comparison.stableCount} stable
          </span>
        </div>
      </div>

      {/* Summary banner */}
      <div
        className={`px-4 py-3 rounded-lg border text-sm ${summaryBg(comparison)}`}
      >
        {comparison.summary}
      </div>

      {/* Delta grid */}
      <div className="grid grid-cols-3 gap-3">
        {deltas.map((delta) => (
          <div
            key={delta.label}
            className={`p-3 rounded-lg border transition-colors ${trendBg(delta.trend)}`}
          >
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
              {delta.label}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">
                {formatValue(delta)}
              </span>
              <span
                className={`text-sm font-semibold flex items-center gap-0.5 ${trendColor(delta.trend)}`}
              >
                <span className="text-[10px]">{trendIcon(delta.trend)}</span>
                {delta.trend !== "stable" && formatDelta(delta)}
              </span>
            </div>

            {/* Previous value reference */}
            <div className="text-[10px] text-neutral-600 mt-1">
              Previous:{" "}
              {delta.label === "Filler Rate"
                ? delta.previous.toFixed(1)
                : delta.label === "Stress Index"
                  ? delta.previous.toFixed(2)
                  : Math.round(delta.previous)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
