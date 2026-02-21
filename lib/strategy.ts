import type { AttemptMetrics, CoachingStrategyResult } from "@/types";

export interface StrategyContext {
  durationOverTargetSec?: number;
  fastPaceCount?: number;
  persona?: string;
  goal?: string;
}

/**
 * Rule-based coaching strategy selector.
 * Consumes metrics + optional context to pick the best next drill.
 */
export function selectCoachingStrategy(
  metrics: AttemptMetrics,
  ctx?: StrategyContext
): CoachingStrategyResult {
  const {
    timingComplianceScore,
    hookStrengthScore,
    pacingScore,
    fillerRatePerMin,
    confidenceScore,
    stressIndex,
  } = metrics;

  // Overtime + weak hook → restructure the pitch
  if (timingComplianceScore < 70 && hookStrengthScore < 60) {
    return {
      strategyId: "outline-first",
      label: "Outline-First",
      description:
        "Restructure your opener with a tight outline: hook (5s), value prop (15s), credibility (10s), key points (20s), CTA (10s). Practice hitting each section within its time budget.",
      reason:
        "Your delivery ran over the target time and the opening hook didn't land strongly. A clear outline will fix both.",
    };
  }

  // Pace issues → pacing drill
  if (pacingScore < 70) {
    return {
      strategyId: "pacing-drill",
      label: "Pacing Drill",
      description:
        "Re-deliver the value proposition section at 70% of your current speed. Pause for one beat between each key benefit. The goal is to let each point land before moving to the next.",
      reason:
        "Multiple sections were delivered too quickly, especially the value proposition. Slowing down will improve clarity and listener comprehension.",
    };
  }

  // Filler overload → suppression exercise
  if (fillerRatePerMin > 10) {
    return {
      strategyId: "filler-suppression",
      label: "Filler Suppression",
      description:
        "Deliver the same pitch but replace every filler word with a silent pause. Focus on the moments before transitions — that's where fillers cluster most.",
      reason:
        "Your filler word rate is above 10 per minute. Silent pauses project more confidence than filled ones.",
    };
  }

  // Confidence issues with stressful persona
  if (confidenceScore < 65 && (ctx?.persona?.includes("skeptic") || stressIndex > 0.6)) {
    return {
      strategyId: "persona-drill",
      label: "Persona Drill",
      description:
        "Re-run the opener imagining the listener is actively pushing back. Maintain steady energy through the credibility section and hold your vocal power through pricing. End with a firm CTA, not a question.",
      reason:
        "Confidence dipped during key moments, especially under stress. Practicing against resistance will build vocal steadiness.",
    };
  }

  // Stress management
  if (stressIndex > 0.5) {
    return {
      strategyId: "stress-anchoring",
      label: "Stress Anchoring",
      description:
        "Before your next run, take three slow breaths. During the pitch, anchor your voice on the first word of each new section. If you feel pace creeping up, pause and reset.",
      reason:
        "Stress indicators were elevated, particularly around pricing and transitions. Anchoring techniques can help regulate delivery under pressure.",
    };
  }

  // Default: general refinement
  return {
    strategyId: "general-refinement",
    label: "General Refinement",
    description:
      "Good foundation. For your next run, focus on making the hook more punchy (try a specific number or surprising fact in the first 5 seconds) and strengthening the transition into your CTA.",
    reason:
      "No major red flags — this is about polishing the details to move from good to great.",
  };
}
