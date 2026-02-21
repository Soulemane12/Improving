import type { VoiceSignalEvent, AttemptMetrics } from "@/types";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computeMetrics(params: {
  events: VoiceSignalEvent[];
  transcriptText: string;
  durationSec: number;
  targetSec: number;
}): AttemptMetrics {
  const { events, transcriptText, durationSec, targetSec } = params;

  const count = (t: string) => events.filter((e) => e.type === t).length;
  const avgScore = (types: string[]) => {
    const vals = events
      .filter((e) => types.includes(e.type))
      .map((e) => e.score ?? 0.5);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const fastPaceCount = count("fast_pace");
  const hesitationCount = count("hesitation");
  const confidenceDipCount = count("confidence_dip");
  const recoveryCount = count("recovery");
  const overrunRiskCount = count("timing_overrun_risk");

  // Filler rate from transcript text
  const fillers = (
    transcriptText.match(/\b(um|uh|like|kind of|you know)\b/gi) ?? []
  ).length;
  const fillerRatePerMin =
    durationSec > 0 ? (fillers / durationSec) * 60 : 0;

  // Stress index: average score of stress-related events
  const stressIndex = Math.min(
    1,
    avgScore(["stress_spike", "confidence_dip"])
  );

  // Pacing: penalize fast_pace, reward recovery
  const pacingScore = clamp(
    100 - fastPaceCount * 8 + recoveryCount * 4,
    0,
    100
  );

  // Confidence: penalize hesitation + confidence dips
  const confidenceScore = clamp(
    100 - hesitationCount * 6 - confidenceDipCount * 10,
    0,
    100
  );

  // Timing: penalize overtime + overrun risk signals
  const overtime = Math.max(0, durationSec - targetSec);
  const timingComplianceScore = clamp(
    100 - overtime * 3 - overrunRiskCount * 12,
    0,
    100
  );

  // Hook strength: first 10s delivery stability + filler impact
  const hookStrengthScore = clamp(
    80 - hesitationCount * 8 - (fillerRatePerMin > 10 ? 15 : 0),
    0,
    100
  );

  // Clarity: inverse of filler density + hesitation
  const clarityScore = clamp(
    100 - fillerRatePerMin * 3 - hesitationCount * 5,
    0,
    100
  );

  // CTA strength: reward recovery events, penalize overrun risk at end
  const ctaStrengthScore = clamp(
    75 + recoveryCount * 10 - overrunRiskCount * 15,
    0,
    100
  );

  // Overall: weighted average
  const overallScore = Math.round(
    pacingScore * 0.15 +
      confidenceScore * 0.2 +
      clarityScore * 0.1 +
      timingComplianceScore * 0.15 +
      hookStrengthScore * 0.2 +
      ctaStrengthScore * 0.1 +
      (1 - stressIndex) * 100 * 0.1
  );

  return {
    overallScore: clamp(overallScore, 0, 100),
    pacingScore,
    confidenceScore,
    clarityScore,
    timingComplianceScore,
    hookStrengthScore,
    ctaStrengthScore,
    fillerRatePerMin: Number(fillerRatePerMin.toFixed(1)),
    stressIndex: Number(stressIndex.toFixed(2)),
  };
}
