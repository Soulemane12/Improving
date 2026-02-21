/**
 * Analytics pipeline — fire-and-forget Supabase logging.
 *
 * This module is intentionally decoupled from the live coaching path.
 * Every function catches its own errors and logs to console;
 * callers should invoke without `await` so the request path is never blocked.
 */

import { supabase } from "./supabase";
import type {
  PracticeSession,
  Attempt,
  AttemptMetrics,
  VoiceSignalEvent,
  CoachingStrategyResult,
  RunComparison,
} from "@/types";

interface CompletedAttemptData {
  session: PracticeSession;
  attempt: Attempt;
  metrics: AttemptMetrics;
  events: VoiceSignalEvent[];
  strategy?: CoachingStrategyResult;
  comparison?: RunComparison;
}

/**
 * Log a completed attempt and all its related data to Supabase.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function logCompletedAttempt(
  data: CompletedAttemptData
): Promise<void> {
  if (!supabase) return;

  try {
    const { session, attempt, metrics, events, strategy, comparison } = data;

    // 1. Upsert session
    const { error: sessionErr } = await supabase.from("sessions").upsert(
      {
        id: session.id,
        user_id: session.userId ?? null,
        scenario_id: session.scenarioId,
        target_duration_sec: session.targetDurationSec,
        status: session.status,
        created_at: session.createdAt,
      },
      { onConflict: "id" }
    );
    if (sessionErr) console.error("[analytics] session upsert:", sessionErr.message);

    // 2. Upsert attempt
    const { error: attemptErr } = await supabase.from("attempts").upsert(
      {
        id: attempt.id,
        session_id: attempt.sessionId,
        run_number: attempt.runNumber,
        duration_sec: attempt.durationSec ?? null,
        analysis_status: attempt.analysisStatus,
        created_at: attempt.createdAt,
      },
      { onConflict: "id" }
    );
    if (attemptErr) console.error("[analytics] attempt upsert:", attemptErr.message);

    // 3. Upsert metrics
    const { error: metricsErr } = await supabase.from("attempt_metrics").upsert(
      {
        attempt_id: attempt.id,
        overall_score: metrics.overallScore,
        pacing_score: metrics.pacingScore,
        confidence_score: metrics.confidenceScore,
        clarity_score: metrics.clarityScore,
        timing_compliance_score: metrics.timingComplianceScore,
        hook_strength_score: metrics.hookStrengthScore,
        cta_strength_score: metrics.ctaStrengthScore,
        filler_rate_per_min: metrics.fillerRatePerMin,
        stress_index: metrics.stressIndex,
      },
      { onConflict: "attempt_id" }
    );
    if (metricsErr) console.error("[analytics] metrics upsert:", metricsErr.message);

    // 4. Upsert voice signal events
    if (events.length > 0) {
      const rows = events.map((e) => ({
        id: e.id,
        attempt_id: attempt.id,
        session_id: session.id,
        signal_type: e.type,
        severity: e.severity,
        t_start_ms: e.tStartMs,
        t_end_ms: e.tEndMs ?? null,
        score: e.score ?? null,
        note: e.note ?? null,
        provider: e.provider,
      }));
      const { error: eventsErr } = await supabase
        .from("voice_signal_events")
        .upsert(rows, { onConflict: "id" });
      if (eventsErr) console.error("[analytics] events upsert:", eventsErr.message);
    }

    // 5. Upsert coaching strategy
    if (strategy) {
      const { error: strategyErr } = await supabase
        .from("coaching_strategies")
        .upsert(
          {
            attempt_id: attempt.id,
            strategy_id: strategy.strategyId,
            label: strategy.label,
            description: strategy.description,
            reason: strategy.reason,
          },
          { onConflict: "attempt_id" }
        );
      if (strategyErr)
        console.error("[analytics] strategy upsert:", strategyErr.message);
    }

    // 6. Upsert run comparison
    if (comparison) {
      const { error: compErr } = await supabase
        .from("run_comparisons")
        .upsert(
          {
            attempt_id: attempt.id,
            previous_attempt_id: comparison.previousAttemptId,
            run_number: comparison.runNumber,
            summary: comparison.summary,
            improved_count: comparison.improvedCount,
            declined_count: comparison.declinedCount,
            stable_count: comparison.stableCount,
            pace_delta: comparison.pace,
            clarity_delta: comparison.clarity,
            confidence_delta: comparison.confidence,
            timing_compliance_delta: comparison.timingCompliance,
            filler_rate_delta: comparison.fillerRate,
            hook_strength_delta: comparison.hookStrength,
            cta_strength_delta: comparison.ctaStrength,
            stress_index_delta: comparison.stressIndex,
            overall_delta: comparison.overall,
          },
          { onConflict: "attempt_id" }
        );
      if (compErr) console.error("[analytics] comparison upsert:", compErr.message);
    }

    console.log(
      `[analytics] Logged attempt ${attempt.id} (run #${attempt.runNumber})`
    );
  } catch (err) {
    console.error("[analytics] logCompletedAttempt failed:", err);
  }
}
