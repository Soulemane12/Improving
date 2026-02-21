// ─── Capture & Analysis Status ───────────────────────────────────────────────

export type CaptureState = "idle" | "recording" | "stopped" | "error";

export type AnalysisStatus =
  | "recording"
  | "processing_audio"
  | "extracting_voice_signals"
  | "scoring"
  | "strategy_selection"
  | "coaching_ready";

// ─── Voice Signal Types ─────────────────────────────────────────────────────

export type VoiceSignalType =
  | "hesitation"
  | "fast_pace"
  | "confidence_dip"
  | "stress_spike"
  | "filler_cluster"
  | "timing_overrun_risk"
  | "recovery"
  | "overlap_risk";

export type Severity = "low" | "medium" | "high";

export interface VoiceSignalEvent {
  id: string;
  provider: string;
  sessionId: string;
  attemptId: string;
  tStartMs: number;
  tEndMs?: number;
  type: VoiceSignalType;
  score?: number; // normalized 0..1
  severity: Severity;
  note?: string;
  raw?: unknown;
}

// ─── Transcript ─────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string;
  tStartMs: number;
  tEndMs: number;
  text: string;
  speaker?: string;
  flags: VoiceSignalType[];
}

export interface Transcript {
  fullText: string;
  segments: TranscriptSegment[];
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export interface AttemptMetrics {
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

// ─── Session & Attempt ──────────────────────────────────────────────────────

export type SessionStatus = "active" | "completed" | "abandoned";

export interface PracticeSession {
  id: string;
  userId?: string;
  scenarioId: string;
  targetDurationSec: number;
  status: SessionStatus;
  createdAt: string;
}

export type AttemptAnalysisStatus =
  | "recording"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface Attempt {
  id: string;
  sessionId: string;
  runNumber: number;
  audioUrl?: string;
  durationSec?: number;
  providerJobId?: string;
  analysisStatus: AttemptAnalysisStatus;
  createdAt: string;
}

// ─── Provider-Facing Types ──────────────────────────────────────────────────

export interface VoiceAnalysisStartInput {
  sessionId: string;
  attemptId: string;
  userId?: string;
  scenarioId: string;
  audioUrl?: string;
  audioMimeType?: string;
  liveStreamRef?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceAnalysisSummary {
  sessionId: string;
  attemptId: string;
  status: "queued" | "processing" | "completed" | "failed";
  transcript?: Transcript;
  events: VoiceSignalEvent[];
  aggregateSignals?: Record<string, number>;
}

// ─── Coaching Strategy ──────────────────────────────────────────────────────

export interface CoachingStrategyResult {
  strategyId: string;
  label: string;
  description: string;
  reason: string;
}

// ─── Frontend Contract (stable) ─────────────────────────────────────────────

export interface OpeningCoachAnalysisResponse {
  sessionId: string;
  attemptId: string;
  status: AnalysisStatus;
  durationSec?: number;
  transcript?: {
    fullText: string;
    segments: Array<{
      id: string;
      tStartMs: number;
      tEndMs: number;
      text: string;
      flags: VoiceSignalType[];
    }>;
  };
  voiceSignals: Array<{
    id: string;
    tStartMs: number;
    tEndMs?: number;
    type: VoiceSignalType;
    severity: Severity;
    score?: number;
    note?: string;
  }>;
  metrics?: AttemptMetrics;
  strategy?: CoachingStrategyResult;
}

// ─── SSE Event Types ────────────────────────────────────────────────────────

export type SSEEventType =
  | "status_change"
  | "voice_event"
  | "transcript"
  | "metrics"
  | "strategy";

export interface SSEMessage {
  type: SSEEventType;
  sessionId: string;
  attemptId: string;
  payload: unknown;
}
