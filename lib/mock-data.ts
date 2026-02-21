import type {
  VoiceSignalEvent,
  TranscriptSegment,
  Transcript,
  AttemptMetrics,
} from "@/types";

// ─── Mock Transcript (60-second listing opener) ─────────────────────────────

export function createMockTranscript(
  _sessionId: string,
  _attemptId: string
): Transcript {
  const segments: TranscriptSegment[] = [
    {
      id: `seg-1`,
      tStartMs: 0,
      tEndMs: 5000,
      text: "Hi, um, thanks for taking the time to chat today.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-2`,
      tStartMs: 5000,
      tEndMs: 12000,
      text: "I wanted to share a property that I think is a perfect fit for what you've been looking for.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-3`,
      tStartMs: 12000,
      tEndMs: 20000,
      text: "It's a three-bedroom two-bath in the heart of Maple Ridge with an updated kitchen and a huge backyard.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-4`,
      tStartMs: 20000,
      tEndMs: 28000,
      text: "I've been working in this neighborhood for over eight years and, you know, I've seen what sells here.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-5`,
      tStartMs: 28000,
      tEndMs: 37000,
      text: "Um, like, the comparable homes on this street have been, kind of, going for about four-fifty to four-eighty.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-6`,
      tStartMs: 37000,
      tEndMs: 45000,
      text: "This one is listed at four-sixty-five, which I think is really competitive given the recent renovations.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-7`,
      tStartMs: 45000,
      tEndMs: 53000,
      text: "Now the pricing does reflect the current market conditions, and there has been a lot of interest already.",
      speaker: "agent",
      flags: [],
    },
    {
      id: `seg-8`,
      tStartMs: 53000,
      tEndMs: 60000,
      text: "I think it would be worth taking a look in person. Would Thursday or Friday work for a showing?",
      speaker: "agent",
      flags: [],
    },
  ];

  const fullText = segments.map((s) => s.text).join(" ");
  return { fullText, segments };
}

// ─── Mock Voice Events ──────────────────────────────────────────────────────

export function createMockVoiceEvents(
  sessionId: string,
  attemptId: string
): VoiceSignalEvent[] {
  return [
    {
      id: `evt-1`,
      provider: "modulate",
      sessionId,
      attemptId,
      tStartMs: 2000,
      tEndMs: 4500,
      type: "hesitation",
      score: 0.6,
      severity: "medium",
      note: "Delivery showed hesitation at the opening — weak hook start",
    },
    {
      id: `evt-2`,
      provider: "modulate",
      sessionId,
      attemptId,
      tStartMs: 12000,
      tEndMs: 18000,
      type: "fast_pace",
      score: 0.82,
      severity: "high",
      note: "Pace increased significantly during value proposition — key details may be lost",
    },
    {
      id: `evt-3`,
      provider: "modulate",
      sessionId,
      attemptId,
      tStartMs: 20000,
      tEndMs: 26000,
      type: "confidence_dip",
      score: 0.55,
      severity: "medium",
      note: "Confidence dipped when transitioning into credibility statement",
    },
    {
      id: `evt-4`,
      provider: "modulate",
      sessionId,
      attemptId,
      tStartMs: 30000,
      tEndMs: 36000,
      type: "filler_cluster",
      score: 0.85,
      severity: "high",
      note: 'Cluster of filler words ("um", "like", "kind of") before second key point',
    },
    {
      id: `evt-5`,
      provider: "modulate",
      sessionId,
      attemptId,
      tStartMs: 45000,
      tEndMs: 51000,
      type: "stress_spike",
      score: 0.65,
      severity: "medium",
      note: "Delivery showed a stress spike around the pricing mention",
    },
    {
      id: `evt-6`,
      provider: "modulate",
      sessionId,
      attemptId,
      tStartMs: 57000,
      tEndMs: 60000,
      type: "recovery",
      score: 0.7,
      severity: "low",
      note: "Strong recovery in closing — confident ask for the showing",
    },
  ];
}

// ─── Mock Metrics ───────────────────────────────────────────────────────────

export function createMockMetrics(): AttemptMetrics {
  return {
    overallScore: 68,
    pacingScore: 72,
    confidenceScore: 64,
    clarityScore: 70,
    timingComplianceScore: 85,
    hookStrengthScore: 55,
    ctaStrengthScore: 78,
    fillerRatePerMin: 8.0,
    stressIndex: 0.42,
  };
}
