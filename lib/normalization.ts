import type { Severity, VoiceSignalType, VoiceSignalEvent } from "@/types";

/** Map a raw 0..1 score to a severity bucket. */
export function normalizeSeverity(score?: number): Severity {
  if (score == null) return "low";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/** Map a provider label/category pair to our internal signal type. */
export function mapToInternalType(
  label: string,
  category?: string
): VoiceSignalType {
  const l = (label ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();

  if (l.includes("hesitat") || l.includes("pause") || c.includes("hesitat"))
    return "hesitation";
  if (l.includes("fast") || l.includes("pace") || l.includes("rush"))
    return "fast_pace";
  if (l.includes("confiden") || l.includes("energy_drop"))
    return "confidence_dip";
  if (l.includes("stress") || l.includes("tension")) return "stress_spike";
  if (l.includes("filler") || l.includes("um") || l.includes("uh"))
    return "filler_cluster";
  if (l.includes("overrun") || l.includes("timing")) return "timing_overrun_risk";
  if (l.includes("recover") || l.includes("rebound")) return "recovery";
  if (l.includes("overlap") || l.includes("interrupt")) return "overlap_risk";

  // Fallback
  return "hesitation";
}

/**
 * Convert a raw provider event payload into the normalized VoiceSignalEvent.
 * The exact shape of `raw` depends on the provider — adapt fields as needed.
 */
export function mapProviderEvent(
  raw: Record<string, unknown>,
  sessionId: string,
  attemptId: string
): VoiceSignalEvent {
  const score =
    typeof raw.score === "number" ? raw.score : undefined;

  return {
    provider: "modulate",
    sessionId,
    attemptId,
    id:
      typeof raw.id === "string"
        ? raw.id
        : crypto.randomUUID(),
    tStartMs: Math.round(
      ((typeof raw.start_sec === "number"
        ? raw.start_sec
        : typeof raw.timestamp_sec === "number"
          ? raw.timestamp_sec
          : 0) as number) * 1000
    ),
    tEndMs:
      typeof raw.end_sec === "number"
        ? Math.round(raw.end_sec * 1000)
        : undefined,
    type: mapToInternalType(
      (raw.label as string) ?? "",
      (raw.category as string) ?? ""
    ),
    score,
    severity: normalizeSeverity(score),
    note:
      (raw.explanation as string) ??
      (raw.note as string) ??
      undefined,
    raw,
  };
}
