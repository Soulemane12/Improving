import type {
  AttemptMetrics,
  MetricDelta,
  MetricTrend,
  RunComparison,
} from "@/types";

const STABLE_THRESHOLD = 2; // points — anything within ±2 is "stable"
const FILLER_STABLE_THRESHOLD = 0.5; // fillers/min
const STRESS_STABLE_THRESHOLD = 0.05; // 0..1 index

function trend(
  delta: number,
  threshold: number,
  invertBetter = false
): MetricTrend {
  // For most metrics higher = better (invertBetter=false).
  // For fillerRate and stressIndex, lower = better (invertBetter=true).
  if (Math.abs(delta) <= threshold) return "stable";
  const positive = delta > 0;
  if (invertBetter) return positive ? "declined" : "improved";
  return positive ? "improved" : "declined";
}

function buildDelta(
  label: string,
  previous: number,
  current: number,
  threshold: number,
  invertBetter = false
): MetricDelta {
  const delta = current - previous;
  return {
    previous,
    current,
    delta: Number(delta.toFixed(2)),
    trend: trend(delta, threshold, invertBetter),
    label,
  };
}

function buildSummary(
  improved: number,
  declined: number,
  stable: number
): string {
  const total = improved + declined + stable;
  if (improved === total) return "Across the board improvement — great work.";
  if (declined === total) return "All metrics dipped this run. Reset and try the coaching strategy before your next attempt.";
  if (improved === 0 && declined === 0) return "Metrics held steady. Push for a breakthrough on your next run.";
  if (improved > declined) {
    return `${improved} of ${total} metrics improved. Keep the momentum going.`;
  }
  if (declined > improved) {
    return `${declined} of ${total} metrics declined. Focus on the coaching strategy before your next run.`;
  }
  return "Mixed results — some metrics improved, others slipped. Review the details below.";
}

export function compareRuns(params: {
  previousMetrics: AttemptMetrics;
  currentMetrics: AttemptMetrics;
  previousAttemptId: string;
  currentAttemptId: string;
  runNumber: number;
}): RunComparison {
  const { previousMetrics: prev, currentMetrics: curr } = params;

  const deltas: MetricDelta[] = [
    buildDelta("Pacing", prev.pacingScore, curr.pacingScore, STABLE_THRESHOLD),
    buildDelta("Clarity", prev.clarityScore, curr.clarityScore, STABLE_THRESHOLD),
    buildDelta("Confidence", prev.confidenceScore, curr.confidenceScore, STABLE_THRESHOLD),
    buildDelta("Timing Compliance", prev.timingComplianceScore, curr.timingComplianceScore, STABLE_THRESHOLD),
    buildDelta("Filler Rate", prev.fillerRatePerMin, curr.fillerRatePerMin, FILLER_STABLE_THRESHOLD, true),
    buildDelta("Hook Strength", prev.hookStrengthScore, curr.hookStrengthScore, STABLE_THRESHOLD),
    buildDelta("CTA Strength", prev.ctaStrengthScore, curr.ctaStrengthScore, STABLE_THRESHOLD),
    buildDelta("Stress Index", prev.stressIndex, curr.stressIndex, STRESS_STABLE_THRESHOLD, true),
    buildDelta("Overall", prev.overallScore, curr.overallScore, STABLE_THRESHOLD),
  ];

  const improvedCount = deltas.filter((d) => d.trend === "improved").length;
  const declinedCount = deltas.filter((d) => d.trend === "declined").length;
  const stableCount = deltas.filter((d) => d.trend === "stable").length;

  return {
    previousAttemptId: params.previousAttemptId,
    currentAttemptId: params.currentAttemptId,
    runNumber: params.runNumber,
    pace: deltas[0],
    clarity: deltas[1],
    confidence: deltas[2],
    timingCompliance: deltas[3],
    fillerRate: deltas[4],
    hookStrength: deltas[5],
    ctaStrength: deltas[6],
    stressIndex: deltas[7],
    overall: deltas[8],
    summary: buildSummary(improvedCount, declinedCount, stableCount),
    improvedCount,
    declinedCount,
    stableCount,
  };
}
