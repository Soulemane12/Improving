import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";

function mapMetrics(
  metrics:
    | {
        overallScore: number;
        pacingScore: number;
        confidenceScore: number;
        clarityScore: number;
        timingComplianceScore: number;
        hookStrengthScore: number;
        ctaStrengthScore: number;
        fillerRatePerMin: number;
        stressIndex: number;
      }
    | undefined
) {
  if (!metrics) return null;
  return {
    overall_score: metrics.overallScore,
    pacing_score: metrics.pacingScore,
    confidence_score: metrics.confidenceScore,
    clarity_score: metrics.clarityScore,
    timing_compliance_score: metrics.timingComplianceScore,
    hook_strength_score: metrics.hookStrengthScore,
    cta_strength_score: metrics.ctaStrengthScore,
    filler_rate_per_min: metrics.fillerRatePerMin,
    stress_index: metrics.stressIndex,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    request_id?: string;
    session_id?: string;
    attempt_id?: string;
  };

  const sessionId = body.session_id;
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  const session = store.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const attempts = store
    .getAttemptsBySession(sessionId)
    .sort((a, b) => b.runNumber - a.runNumber);

  if (attempts.length === 0) {
    return NextResponse.json(
      { error: "No attempts found for session" },
      { status: 404 }
    );
  }

  const selectedAttempt =
    body.attempt_id != null
      ? attempts.find((attempt) => attempt.id === body.attempt_id)
      : attempts[0];

  if (!selectedAttempt) {
    return NextResponse.json(
      { error: "attempt_id not found in session" },
      { status: 404 }
    );
  }

  const analysis = store.getAnalysisResponse(sessionId, selectedAttempt.id);
  const transcript = analysis.transcript;

  return NextResponse.json({
    request_id: body.request_id ?? null,
    session_id: session.id,
    attempt_id: selectedAttempt.id,
    scenario_id: session.scenarioId,
    target_duration_sec: session.targetDurationSec,
    status: analysis.status,
    transcript: transcript
      ? {
          full_text: transcript.fullText,
          utterances: transcript.segments.map((segment) => ({
            text: segment.text,
            start_ms: segment.tStartMs,
            end_ms: segment.tEndMs,
            speaker: "Speaker 1",
            flags: segment.flags,
          })),
        }
      : {
          full_text: "",
          utterances: [],
        },
    metrics: mapMetrics(analysis.metrics),
    events: analysis.voiceSignals.map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      score: event.score ?? null,
      note: event.note ?? null,
      start_ms: event.tStartMs,
      end_ms: event.tEndMs ?? null,
    })),
    strategy: analysis.strategy ?? null,
    comparison: analysis.comparison ?? null,
  });
}
