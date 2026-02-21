import type {
  PracticeSession,
  Attempt,
  VoiceSignalEvent,
  Transcript,
  AttemptMetrics,
  CoachingStrategyResult,
  RunComparison,
  OpeningCoachAnalysisResponse,
  AnalysisStatus,
} from "@/types";

// ─── In-Memory Store ────────────────────────────────────────────────────────
// Replace with a real database when moving beyond hackathon/demo.

const sessions = new Map<string, PracticeSession>();
const attempts = new Map<string, Attempt>();
const voiceEvents = new Map<string, VoiceSignalEvent[]>(); // keyed by attemptId
const transcripts = new Map<string, Transcript>(); // keyed by attemptId
const metrics = new Map<string, AttemptMetrics>(); // keyed by attemptId
const strategies = new Map<string, CoachingStrategyResult>(); // keyed by attemptId
const analysisStatuses = new Map<string, AnalysisStatus>(); // keyed by attemptId
const comparisons = new Map<string, RunComparison>(); // keyed by attemptId
const audioChunks = new Map<string, ArrayBuffer[]>(); // keyed by attemptId

// ─── Sessions ───────────────────────────────────────────────────────────────

export function createSession(session: PracticeSession): PracticeSession {
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): PracticeSession | undefined {
  return sessions.get(id);
}

// ─── Attempts ───────────────────────────────────────────────────────────────

export function createAttempt(attempt: Attempt): Attempt {
  attempts.set(attempt.id, attempt);
  voiceEvents.set(attempt.id, []);
  audioChunks.set(attempt.id, []);
  analysisStatuses.set(attempt.id, "recording");
  return attempt;
}

export function getAttempt(id: string): Attempt | undefined {
  return attempts.get(id);
}

export function updateAttempt(
  id: string,
  updates: Partial<Attempt>
): Attempt | undefined {
  const existing = attempts.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  attempts.set(id, updated);
  return updated;
}

export function getAttemptsBySession(sessionId: string): Attempt[] {
  return Array.from(attempts.values()).filter(
    (a) => a.sessionId === sessionId
  );
}

// ─── Audio Chunks ───────────────────────────────────────────────────────────

export function addAudioChunk(attemptId: string, chunk: ArrayBuffer): void {
  const existing = audioChunks.get(attemptId) ?? [];
  existing.push(chunk);
  audioChunks.set(attemptId, existing);
}

export function getAudioChunks(attemptId: string): ArrayBuffer[] {
  return audioChunks.get(attemptId) ?? [];
}

export function clearAudioChunks(attemptId: string): void {
  audioChunks.delete(attemptId);
}

// ─── Voice Events ───────────────────────────────────────────────────────────

export function addVoiceEvent(event: VoiceSignalEvent): void {
  const existing = voiceEvents.get(event.attemptId) ?? [];
  // Idempotency: skip if event ID already exists
  if (existing.some((e) => e.id === event.id)) return;
  existing.push(event);
  existing.sort((a, b) => a.tStartMs - b.tStartMs);
  voiceEvents.set(event.attemptId, existing);
}

export function addVoiceEvents(events: VoiceSignalEvent[]): void {
  for (const event of events) {
    addVoiceEvent(event);
  }
}

export function getVoiceEvents(attemptId: string): VoiceSignalEvent[] {
  return voiceEvents.get(attemptId) ?? [];
}

// ─── Transcript ─────────────────────────────────────────────────────────────

export function setTranscript(attemptId: string, transcript: Transcript): void {
  transcripts.set(attemptId, transcript);
}

export function getTranscript(attemptId: string): Transcript | undefined {
  return transcripts.get(attemptId);
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export function setMetrics(attemptId: string, m: AttemptMetrics): void {
  metrics.set(attemptId, m);
}

export function getMetrics(attemptId: string): AttemptMetrics | undefined {
  return metrics.get(attemptId);
}

// ─── Strategy ───────────────────────────────────────────────────────────────

export function setStrategy(
  attemptId: string,
  strategy: CoachingStrategyResult
): void {
  strategies.set(attemptId, strategy);
}

export function getStrategy(
  attemptId: string
): CoachingStrategyResult | undefined {
  return strategies.get(attemptId);
}

// ─── Comparison ──────────────────────────────────────────────────────────────

export function setComparison(
  attemptId: string,
  comparison: RunComparison
): void {
  comparisons.set(attemptId, comparison);
}

export function getComparison(attemptId: string): RunComparison | undefined {
  return comparisons.get(attemptId);
}

/**
 * Find the most recent completed attempt for this session that has metrics,
 * excluding the current attempt. Returns the attempt + its metrics, or undefined.
 */
export function getPreviousCompletedAttemptWithMetrics(
  sessionId: string,
  excludeAttemptId: string
): { attempt: Attempt; metrics: AttemptMetrics } | undefined {
  const sessionAttempts = getAttemptsBySession(sessionId)
    .filter(
      (a) =>
        a.id !== excludeAttemptId &&
        (a.analysisStatus === "completed" || a.analysisStatus === "processing")
    )
    .sort((a, b) => b.runNumber - a.runNumber);

  for (const attempt of sessionAttempts) {
    const m = metrics.get(attempt.id);
    if (m) return { attempt, metrics: m };
  }
  return undefined;
}

// ─── Analysis Status ────────────────────────────────────────────────────────

export function setAnalysisStatus(
  attemptId: string,
  status: AnalysisStatus
): void {
  analysisStatuses.set(attemptId, status);
}

export function getAnalysisStatus(
  attemptId: string
): AnalysisStatus | undefined {
  return analysisStatuses.get(attemptId);
}

// ─── Build Frontend Response ────────────────────────────────────────────────

export function getAnalysisResponse(
  sessionId: string,
  attemptId: string
): OpeningCoachAnalysisResponse {
  const status = getAnalysisStatus(attemptId) ?? "recording";
  const attempt = getAttempt(attemptId);
  const transcript = getTranscript(attemptId);
  const events = getVoiceEvents(attemptId);
  const m = getMetrics(attemptId);
  const strategy = getStrategy(attemptId);
  const comparison = getComparison(attemptId);

  return {
    sessionId,
    attemptId,
    status,
    durationSec: attempt?.durationSec,
    transcript: transcript
      ? {
          fullText: transcript.fullText,
          segments: transcript.segments.map((s) => ({
            id: s.id,
            tStartMs: s.tStartMs,
            tEndMs: s.tEndMs,
            text: s.text,
            flags: s.flags,
          })),
        }
      : undefined,
    voiceSignals: events.map((e) => ({
      id: e.id,
      tStartMs: e.tStartMs,
      tEndMs: e.tEndMs,
      type: e.type,
      severity: e.severity,
      score: e.score,
      note: e.note,
    })),
    metrics: m,
    strategy,
    comparison,
  };
}
