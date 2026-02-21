import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AttemptRow = {
  id: string;
  session_id: string;
  run_number: number;
  duration_sec: number | null;
  analysis_status: string;
  created_at: string;
};

type SessionRow = {
  id: string;
  scenario_id: string;
  target_duration_sec: number;
  user_id: string | null;
};

type MetricRow = {
  attempt_id: string;
  overall_score: number;
  pacing_score: number;
  confidence_score: number;
  clarity_score: number;
  timing_compliance_score: number;
  hook_strength_score: number;
  cta_strength_score: number;
  filler_rate_per_min: number;
  stress_index: number;
};

type StrategyRow = {
  attempt_id: string;
  strategy_id: string;
  label: string;
};

type ComparisonRow = {
  attempt_id: string;
  improved_count: number;
  declined_count: number;
  stable_count: number;
  overall_delta: unknown;
};

type AttemptView = {
  attemptId: string;
  sessionId: string;
  runNumber: number;
  createdAt: string;
  analysisStatus: string;
  durationSec: number | null;
  scenarioId: string;
  targetDurationSec: number;
  strategyId: string;
  strategyLabel: string;
  overallScore: number | null;
  pacingScore: number | null;
  confidenceScore: number | null;
  clarityScore: number | null;
  timingComplianceScore: number | null;
  hookStrengthScore: number | null;
  ctaStrengthScore: number | null;
  fillerRatePerMin: number | null;
  stressIndex: number | null;
  improvedCount: number | null;
  declinedCount: number | null;
  stableCount: number | null;
  comparisonOutcome: "improved" | "declined" | "stable" | "not_compared";
  overallDelta: number | null;
};

type TrendPoint = {
  label: string;
  createdAt: string;
  runNumber: number;
  overallScore: number | null;
  pacingScore: number | null;
  confidenceScore: number | null;
  clarityScore: number | null;
};

type SessionSummary = {
  sessionId: string;
  scenarioId: string;
  targetDurationSec: number;
  attemptsCount: number;
  completedAttempts: number;
  firstAttemptAt: string;
  latestAttemptAt: string;
  avgOverallScore: number | null;
  avgPacingScore: number | null;
  avgConfidenceScore: number | null;
  avgClarityScore: number | null;
  trend: TrendPoint[];
  attempts: AttemptView[];
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function parseDelta(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === "object") {
    const maybe = (raw as Record<string, unknown>).delta;
    if (typeof maybe === "number" && Number.isFinite(maybe)) return maybe;
    if (typeof maybe === "string") {
      const parsed = Number(maybe);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function comparisonOutcome(
  comparison: ComparisonRow | undefined
): AttemptView["comparisonOutcome"] {
  if (!comparison) return "not_compared";
  if (comparison.improved_count > comparison.declined_count) return "improved";
  if (comparison.declined_count > comparison.improved_count) return "declined";
  return "stable";
}

export async function GET() {
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  const attemptsRes = await supabase
    .from("attempts")
    .select("id,session_id,run_number,duration_sec,analysis_status,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (attemptsRes.error) {
    return NextResponse.json(
      { error: attemptsRes.error.message },
      { status: 502 }
    );
  }

  const attempts = (attemptsRes.data ?? []) as AttemptRow[];
  if (attempts.length === 0) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        attemptsTotal: 0,
        completedAttempts: 0,
        completionRate: 0,
        attemptsWithMetrics: 0,
        comparisonCoverageRate: 0,
        avgOverallScore: null,
        avgPacingScore: null,
        avgConfidenceScore: null,
        avgClarityScore: null,
        avgTimingScore: null,
        avgHookScore: null,
        avgCtaScore: null,
        avgFillerRate: null,
        avgStressIndex: null,
        lastAttemptAt: null,
      },
      recentAttempts: [],
      dailyTrend: [],
      strategyPerformance: [],
      attemptTrend: [],
      sessions: [],
      newestSession: null,
    });
  }

  const sessionIds = [...new Set(attempts.map((a) => a.session_id))];
  const attemptIds = attempts.map((a) => a.id);

  const [sessionsRes, metricsRes, strategiesRes, comparisonsRes] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id,scenario_id,target_duration_sec,user_id")
        .in("id", sessionIds),
      supabase
        .from("attempt_metrics")
        .select(
          "attempt_id,overall_score,pacing_score,confidence_score,clarity_score,timing_compliance_score,hook_strength_score,cta_strength_score,filler_rate_per_min,stress_index"
        )
        .in("attempt_id", attemptIds),
      supabase
        .from("coaching_strategies")
        .select("attempt_id,strategy_id,label")
        .in("attempt_id", attemptIds),
      supabase
        .from("run_comparisons")
        .select(
          "attempt_id,improved_count,declined_count,stable_count,overall_delta"
        )
        .in("attempt_id", attemptIds),
    ]);

  const queryErrors = [
    sessionsRes.error,
    metricsRes.error,
    strategiesRes.error,
    comparisonsRes.error,
  ].filter(Boolean);
  if (queryErrors.length > 0) {
    return NextResponse.json(
      { error: queryErrors.map((e) => e?.message).join(" | ") },
      { status: 502 }
    );
  }

  const sessions = (sessionsRes.data ?? []) as SessionRow[];
  const metrics = (metricsRes.data ?? []) as MetricRow[];
  const strategies = (strategiesRes.data ?? []) as StrategyRow[];
  const comparisons = (comparisonsRes.data ?? []) as ComparisonRow[];

  const sessionsById = new Map(sessions.map((row) => [row.id, row]));
  const metricsByAttemptId = new Map(metrics.map((row) => [row.attempt_id, row]));
  const strategiesByAttemptId = new Map(
    strategies.map((row) => [row.attempt_id, row])
  );
  const comparisonsByAttemptId = new Map(
    comparisons.map((row) => [row.attempt_id, row])
  );

  const merged: AttemptView[] = attempts.map((attempt) => {
    const session = sessionsById.get(attempt.session_id);
    const metric = metricsByAttemptId.get(attempt.id);
    const strategy = strategiesByAttemptId.get(attempt.id);
    const comparison = comparisonsByAttemptId.get(attempt.id);

    return {
      attemptId: attempt.id,
      sessionId: attempt.session_id,
      runNumber: attempt.run_number,
      createdAt: attempt.created_at,
      analysisStatus: attempt.analysis_status,
      durationSec: attempt.duration_sec,
      scenarioId: session?.scenario_id ?? "unknown",
      targetDurationSec: session?.target_duration_sec ?? 60,
      strategyId: strategy?.strategy_id ?? "unassigned",
      strategyLabel: strategy?.label ?? "Unassigned",
      overallScore: metric?.overall_score ?? null,
      pacingScore: metric?.pacing_score ?? null,
      confidenceScore: metric?.confidence_score ?? null,
      clarityScore: metric?.clarity_score ?? null,
      timingComplianceScore: metric?.timing_compliance_score ?? null,
      hookStrengthScore: metric?.hook_strength_score ?? null,
      ctaStrengthScore: metric?.cta_strength_score ?? null,
      fillerRatePerMin: metric?.filler_rate_per_min ?? null,
      stressIndex: metric?.stress_index ?? null,
      improvedCount: comparison?.improved_count ?? null,
      declinedCount: comparison?.declined_count ?? null,
      stableCount: comparison?.stable_count ?? null,
      comparisonOutcome: comparisonOutcome(comparison),
      overallDelta: parseDelta(comparison?.overall_delta),
    };
  });

  const metricsOnly = merged.filter((attempt) => attempt.overallScore != null);
  const completedAttempts = merged.filter(
    (attempt) => attempt.analysisStatus === "completed"
  ).length;
  const comparisonsCount = merged.filter(
    (attempt) => attempt.comparisonOutcome !== "not_compared"
  ).length;

  const summary = {
    attemptsTotal: merged.length,
    completedAttempts,
    completionRate: Number((completedAttempts / merged.length).toFixed(3)),
    attemptsWithMetrics: metricsOnly.length,
    comparisonCoverageRate: Number((comparisonsCount / merged.length).toFixed(3)),
    avgOverallScore: average(
      metricsOnly.map((attempt) => attempt.overallScore as number)
    ),
    avgPacingScore: average(
      metricsOnly.map((attempt) => attempt.pacingScore as number)
    ),
    avgConfidenceScore: average(
      metricsOnly.map((attempt) => attempt.confidenceScore as number)
    ),
    avgClarityScore: average(
      metricsOnly.map((attempt) => attempt.clarityScore as number)
    ),
    avgTimingScore: average(
      metricsOnly.map((attempt) => attempt.timingComplianceScore as number)
    ),
    avgHookScore: average(
      metricsOnly.map((attempt) => attempt.hookStrengthScore as number)
    ),
    avgCtaScore: average(
      metricsOnly.map((attempt) => attempt.ctaStrengthScore as number)
    ),
    avgFillerRate: average(
      metricsOnly.map((attempt) => attempt.fillerRatePerMin as number)
    ),
    avgStressIndex: average(
      metricsOnly.map((attempt) => attempt.stressIndex as number)
    ),
    lastAttemptAt: merged[0]?.createdAt ?? null,
  };

  const dailyMap = new Map<
    string,
    {
      date: string;
      attempts: number;
      overall: number[];
      pacing: number[];
      confidence: number[];
      clarity: number[];
    }
  >();

  for (const attempt of merged) {
    const date = attempt.createdAt.slice(0, 10);
    const bucket =
      dailyMap.get(date) ??
      {
        date,
        attempts: 0,
        overall: [],
        pacing: [],
        confidence: [],
        clarity: [],
      };

    bucket.attempts += 1;
    if (attempt.overallScore != null) bucket.overall.push(attempt.overallScore);
    if (attempt.pacingScore != null) bucket.pacing.push(attempt.pacingScore);
    if (attempt.confidenceScore != null) bucket.confidence.push(attempt.confidenceScore);
    if (attempt.clarityScore != null) bucket.clarity.push(attempt.clarityScore);

    dailyMap.set(date, bucket);
  }

  const dailyTrend = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((bucket) => ({
      date: bucket.date,
      attempts: bucket.attempts,
      avgOverallScore: average(bucket.overall),
      avgPacingScore: average(bucket.pacing),
      avgConfidenceScore: average(bucket.confidence),
      avgClarityScore: average(bucket.clarity),
    }));

  const strategyMap = new Map<
    string,
    {
      strategyId: string;
      strategyLabel: string;
      attempts: number;
      withComparison: number;
      wins: number;
      overallScores: number[];
      pacingScores: number[];
      confidenceScores: number[];
      clarityScores: number[];
      netImproved: number[];
      overallDeltas: number[];
    }
  >();

  for (const attempt of merged) {
    const key = attempt.strategyId;
    const bucket =
      strategyMap.get(key) ??
      {
        strategyId: attempt.strategyId,
        strategyLabel: attempt.strategyLabel,
        attempts: 0,
        withComparison: 0,
        wins: 0,
        overallScores: [],
        pacingScores: [],
        confidenceScores: [],
        clarityScores: [],
        netImproved: [],
        overallDeltas: [],
      };

    bucket.attempts += 1;
    if (attempt.overallScore != null) bucket.overallScores.push(attempt.overallScore);
    if (attempt.pacingScore != null) bucket.pacingScores.push(attempt.pacingScore);
    if (attempt.confidenceScore != null) {
      bucket.confidenceScores.push(attempt.confidenceScore);
    }
    if (attempt.clarityScore != null) bucket.clarityScores.push(attempt.clarityScore);

    if (attempt.comparisonOutcome !== "not_compared") {
      bucket.withComparison += 1;
      if (attempt.comparisonOutcome === "improved") bucket.wins += 1;
    }

    if (attempt.improvedCount != null && attempt.declinedCount != null) {
      bucket.netImproved.push(attempt.improvedCount - attempt.declinedCount);
    }
    if (attempt.overallDelta != null) bucket.overallDeltas.push(attempt.overallDelta);

    strategyMap.set(key, bucket);
  }

  const strategyPerformance = [...strategyMap.values()]
    .map((bucket) => ({
      strategyId: bucket.strategyId,
      strategyLabel: bucket.strategyLabel,
      attempts: bucket.attempts,
      attemptsWithComparison: bucket.withComparison,
      strategyWinRate:
        bucket.withComparison > 0
          ? Number((bucket.wins / bucket.withComparison).toFixed(3))
          : null,
      avgOverallScore: average(bucket.overallScores),
      avgPacingScore: average(bucket.pacingScores),
      avgConfidenceScore: average(bucket.confidenceScores),
      avgClarityScore: average(bucket.clarityScores),
      avgNetImprovedCount: average(bucket.netImproved),
      avgOverallDelta: average(bucket.overallDeltas),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const attemptsAsc = [...merged].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  const attemptTrend: TrendPoint[] = attemptsAsc.map((attempt, index) => ({
    label: `A${index + 1}`,
    createdAt: attempt.createdAt,
    runNumber: attempt.runNumber,
    overallScore: attempt.overallScore,
    pacingScore: attempt.pacingScore,
    confidenceScore: attempt.confidenceScore,
    clarityScore: attempt.clarityScore,
  }));

  const sessionMap = new Map<
    string,
    {
      sessionId: string;
      scenarioId: string;
      targetDurationSec: number;
      attempts: AttemptView[];
    }
  >();

  for (const attempt of merged) {
    const bucket =
      sessionMap.get(attempt.sessionId) ??
      {
        sessionId: attempt.sessionId,
        scenarioId: attempt.scenarioId,
        targetDurationSec: attempt.targetDurationSec,
        attempts: [],
      };
    bucket.attempts.push(attempt);
    sessionMap.set(attempt.sessionId, bucket);
  }

  const sessionsSummary: SessionSummary[] = [...sessionMap.values()]
    .map((bucket) => {
      const attemptsDesc = [...bucket.attempts].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      const attemptsAscForSession = [...bucket.attempts].sort((a, b) => {
        if (a.runNumber !== b.runNumber) return a.runNumber - b.runNumber;
        return a.createdAt.localeCompare(b.createdAt);
      });
      const withScores = bucket.attempts.filter(
        (attempt) => attempt.overallScore != null
      );

      const completedInSession = bucket.attempts.filter(
        (attempt) => attempt.analysisStatus === "completed"
      ).length;

      return {
        sessionId: bucket.sessionId,
        scenarioId: bucket.scenarioId,
        targetDurationSec: bucket.targetDurationSec,
        attemptsCount: bucket.attempts.length,
        completedAttempts: completedInSession,
        firstAttemptAt:
          attemptsAscForSession[0]?.createdAt ?? attemptsDesc[0]?.createdAt ?? "",
        latestAttemptAt: attemptsDesc[0]?.createdAt ?? "",
        avgOverallScore: average(
          withScores.map((attempt) => attempt.overallScore as number)
        ),
        avgPacingScore: average(
          withScores.map((attempt) => attempt.pacingScore as number)
        ),
        avgConfidenceScore: average(
          withScores.map((attempt) => attempt.confidenceScore as number)
        ),
        avgClarityScore: average(
          withScores.map((attempt) => attempt.clarityScore as number)
        ),
        trend: attemptsAscForSession.map((attempt) => ({
          label: `Run ${attempt.runNumber}`,
          createdAt: attempt.createdAt,
          runNumber: attempt.runNumber,
          overallScore: attempt.overallScore,
          pacingScore: attempt.pacingScore,
          confidenceScore: attempt.confidenceScore,
          clarityScore: attempt.clarityScore,
        })),
        attempts: attemptsDesc,
      };
    })
    .sort((a, b) => b.latestAttemptAt.localeCompare(a.latestAttemptAt));

  const newestSession = sessionsSummary[0] ?? null;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary,
    recentAttempts: merged.slice(0, 50),
    dailyTrend,
    strategyPerformance,
    attemptTrend,
    sessions: sessionsSummary,
    newestSession,
  });
}
