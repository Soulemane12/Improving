"use client";

import type { AttemptMetrics } from "@/types";

interface MetricCard {
  label: string;
  value: number;
  format: "score" | "rate" | "index";
  description: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

interface MetricsDashboardProps {
  metrics: AttemptMetrics | null;
  loading?: boolean;
}

export function MetricsDashboard({ metrics, loading }: MetricsDashboardProps) {
  const cards: MetricCard[] = metrics
    ? [
        {
          label: "Overall",
          value: metrics.overallScore,
          format: "score",
          description: "Weighted composite score",
        },
        {
          label: "Pacing",
          value: metrics.pacingScore,
          format: "score",
          description: "Delivery speed consistency",
        },
        {
          label: "Confidence",
          value: metrics.confidenceScore,
          format: "score",
          description: "Vocal steadiness and energy",
        },
        {
          label: "Clarity",
          value: metrics.clarityScore,
          format: "score",
          description: "Clean delivery, minimal fillers",
        },
        {
          label: "Timing",
          value: metrics.timingComplianceScore,
          format: "score",
          description: "Within target duration",
        },
        {
          label: "Hook Strength",
          value: metrics.hookStrengthScore,
          format: "score",
          description: "Opening 10s impact",
        },
        {
          label: "CTA Strength",
          value: metrics.ctaStrengthScore,
          format: "score",
          description: "Closing ask effectiveness",
        },
        {
          label: "Filler Rate",
          value: metrics.fillerRatePerMin,
          format: "rate",
          description: "Filler words per minute",
        },
        {
          label: "Stress Index",
          value: metrics.stressIndex,
          format: "index",
          description: "Delivery stress level (0-1)",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
        Coaching Metrics
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {loading || !metrics
          ? Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-neutral-800/50 animate-pulse"
              >
                <div className="h-3 w-16 bg-neutral-700 rounded mb-2" />
                <div className="h-8 w-12 bg-neutral-700 rounded" />
              </div>
            ))
          : cards.map((card) => (
              <div
                key={card.label}
                className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800"
              >
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                  {card.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-2xl font-bold ${
                      card.format === "score"
                        ? getScoreColor(card.value)
                        : card.format === "rate"
                          ? card.value > 10
                            ? "text-red-400"
                            : card.value > 6
                              ? "text-amber-400"
                              : "text-green-400"
                          : card.value > 0.6
                            ? "text-red-400"
                            : card.value > 0.3
                              ? "text-amber-400"
                              : "text-green-400"
                    }`}
                  >
                    {card.format === "index"
                      ? card.value.toFixed(2)
                      : card.format === "rate"
                        ? card.value.toFixed(1)
                        : card.value}
                  </span>
                  {card.format === "score" && (
                    <span className="text-[10px] text-neutral-600">/100</span>
                  )}
                  {card.format === "rate" && (
                    <span className="text-[10px] text-neutral-600">/min</span>
                  )}
                </div>
                {card.format === "score" && (
                  <div className="w-full h-1 bg-neutral-700 rounded-full mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(card.value)}`}
                      style={{ width: `${card.value}%` }}
                    />
                  </div>
                )}
                <div className="text-[10px] text-neutral-600 mt-1">
                  {card.description}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
