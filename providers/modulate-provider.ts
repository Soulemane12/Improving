import type { VoiceIntelligenceProvider } from "./types";
import type {
  Transcript,
  TranscriptSegment,
  VoiceAnalysisStartInput,
  VoiceAnalysisSummary,
  VoiceSignalEvent,
} from "@/types";
import { attachEventsToTranscript } from "@/lib/alignment";
import { mapProviderEvent, normalizeSeverity } from "@/lib/normalization";

const DEFAULT_API_BASE = "https://modulate-prototype-apis.com";
const DEFAULT_BATCH_PATH = "/api/velma-2-stt-batch";
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 700;

type ProviderPayload = Record<string, unknown>;

interface ModulateBatchUtterance {
  utterance_uuid: string;
  text: string;
  start_ms: number;
  duration_ms: number;
  speaker?: number;
  language?: string;
  emotion?: string | null;
  accent?: string | null;
}

interface ModulateBatchResponse {
  text: string;
  duration_ms: number;
  utterances: ModulateBatchUtterance[];
}

interface BatchFeatureProfile {
  speakerDiarization: boolean;
  emotionSignal: boolean;
  accentSignal: boolean;
  piiPhiTagging: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function asPositiveInt(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function extractTargetDurationSec(
  metadata: VoiceAnalysisStartInput["metadata"]
): number | undefined {
  if (!isRecord(metadata)) return undefined;
  const raw = metadata.targetDurationSec;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return undefined;
  }
  return raw;
}

function aggregateSignals(events: VoiceSignalEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
}

function parseBatchResponse(raw: unknown): ModulateBatchResponse {
  if (!isRecord(raw)) {
    throw new Error("Modulate response is not a valid JSON object.");
  }

  const text = asString(raw.text);
  const durationMs = asNumber(raw.duration_ms);
  const utteranceRaw = Array.isArray(raw.utterances) ? raw.utterances : [];

  const utterances: ModulateBatchUtterance[] = utteranceRaw
    .filter(isRecord)
    .map((u) => {
      const startMs = asNumber(u.start_ms);
      const duration = asNumber(u.duration_ms);
      return {
        utterance_uuid: asString(u.utterance_uuid, crypto.randomUUID()),
        text: asString(u.text),
        start_ms: Math.max(0, Math.round(startMs)),
        duration_ms: Math.max(0, Math.round(duration)),
        speaker:
          typeof u.speaker === "number" && Number.isFinite(u.speaker)
            ? Math.round(u.speaker)
            : undefined,
        language: typeof u.language === "string" ? u.language : undefined,
        emotion: typeof u.emotion === "string" ? u.emotion : null,
        accent: typeof u.accent === "string" ? u.accent : null,
      };
    });

  return {
    text,
    duration_ms: Math.max(0, Math.round(durationMs)),
    utterances,
  };
}

interface TextOccurrence {
  start: number;
  end: number;
  token: string;
}

function findOccurrences(text: string, regex: RegExp): TextOccurrence[] {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const pattern = new RegExp(regex.source, flags);
  const occurrences: TextOccurrence[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    if (!token) {
      pattern.lastIndex += 1;
      continue;
    }
    const start = match.index;
    const end = start + token.length;
    occurrences.push({ start, end, token: token.toLowerCase() });
  }

  return occurrences;
}

function clusterOccurrences(
  occurrences: TextOccurrence[],
  maxGapChars: number
): TextOccurrence[][] {
  if (occurrences.length === 0) return [];

  const clusters: TextOccurrence[][] = [[occurrences[0]]];
  for (let i = 1; i < occurrences.length; i += 1) {
    const current = occurrences[i];
    const activeCluster = clusters[clusters.length - 1];
    const previous = activeCluster[activeCluster.length - 1];

    if (current.start - previous.end <= maxGapChars) {
      activeCluster.push(current);
      continue;
    }
    clusters.push([current]);
  }

  return clusters;
}

function buildWindowFromRatios(
  startMs: number,
  endMs: number,
  startRatio: number,
  endRatio: number,
  minWindowMs = 500
): { tStartMs: number; tEndMs: number } {
  const safeDuration = Math.max(endMs - startMs, minWindowMs);
  const safeEndMs = startMs + safeDuration;
  const start = startMs + Math.round(safeDuration * clamp01(startRatio));
  const end = startMs + Math.round(safeDuration * clamp01(endRatio));

  const tStartMs = Math.max(startMs, Math.min(safeEndMs - 1, start));
  const tEndMs = Math.min(
    safeEndMs,
    Math.max(tStartMs + minWindowMs, end, tStartMs + 1)
  );

  return { tStartMs, tEndMs };
}

function buildWindowFromCharSpan(params: {
  textLength: number;
  startIdx: number;
  endIdx: number;
  startMs: number;
  endMs: number;
  minWindowMs?: number;
}): { tStartMs: number; tEndMs: number } {
  const { textLength, startIdx, endIdx, startMs, endMs, minWindowMs = 450 } = params;
  if (textLength <= 0) {
    return buildWindowFromRatios(startMs, endMs, 0.2, 0.35, minWindowMs);
  }

  const startRatio = clamp01(startIdx / textLength);
  const endRatio = clamp01(endIdx / textLength);
  return buildWindowFromRatios(
    startMs,
    endMs,
    startRatio,
    Math.max(endRatio, startRatio + 0.04),
    minWindowMs
  );
}

function buildSignalsFromUtterances(params: {
  utterances: ModulateBatchUtterance[];
  sessionId: string;
  attemptId: string;
  targetDurationSec?: number;
}): VoiceSignalEvent[] {
  const { utterances, sessionId, attemptId, targetDurationSec } = params;
  const events: VoiceSignalEvent[] = [];
  const fillerRegex = /\b(um+|uh+|erm|ah+|like|you know|kind of|sort of)\b/gi;
  const negativeStressEmotions = new Set([
    "angry",
    "anxious",
    "afraid",
    "concerned",
    "confused",
    "disappointed",
    "disgusted",
    "frustrated",
    "sad",
    "stressed",
    "tired",
  ]);
  const confidenceDipEmotions = new Set([
    "anxious",
    "afraid",
    "confused",
    "disappointed",
    "frustrated",
    "sad",
    "stressed",
  ]);
  const recoveryEmotions = new Set([
    "amused",
    "calm",
    "confident",
    "excited",
    "happy",
    "hopeful",
    "interested",
    "proud",
    "relieved",
  ]);

  let overrunEventAdded = false;

  utterances.forEach((utterance, index) => {
    const startMs = utterance.start_ms;
    const endMs = startMs + Math.max(utterance.duration_ms, 700);
    const text = utterance.text ?? "";
    const emotion = (utterance.emotion ?? "").toLowerCase();
    const words = countWords(text);
    const durationMin = utterance.duration_ms > 0 ? utterance.duration_ms / 60000 : 0;
    const wpm = durationMin > 0 ? words / durationMin : 0;
    const fillerOccurrences = findOccurrences(text, fillerRegex);
    const fillerCount = fillerOccurrences.length;
    const utteranceId = utterance.utterance_uuid || `utt-${index + 1}`;

    if (fillerCount > 0) {
      const clusters = clusterOccurrences(fillerOccurrences, 24);
      clusters.forEach((cluster, clusterIndex) => {
        const clusterStart = cluster[0].start;
        const clusterEnd = cluster[cluster.length - 1].end;
        const clusterTokens = cluster.map((c) => c.token);
        const clusterSize = cluster.length;
        const fillerWindow = buildWindowFromCharSpan({
          textLength: text.length,
          startIdx: clusterStart,
          endIdx: clusterEnd,
          startMs,
          endMs,
          minWindowMs: 350,
        });

        const fillerScore = clamp01(0.32 + clusterSize * 0.2);
        events.push({
          id: `${attemptId}-${utteranceId}-filler-${clusterIndex + 1}`,
          provider: "modulate",
          sessionId,
          attemptId,
          tStartMs: fillerWindow.tStartMs,
          tEndMs: fillerWindow.tEndMs,
          type: "filler_cluster",
          score: fillerScore,
          severity: normalizeSeverity(fillerScore),
          note: `Detected ${clusterSize} filler word(s): ${clusterTokens.join(", ")}`,
          raw: { utterance, cluster },
        });

        const hesitationWindow = buildWindowFromRatios(
          startMs,
          endMs,
          (fillerWindow.tStartMs - startMs) / Math.max(1, endMs - startMs) - 0.05,
          (fillerWindow.tEndMs - startMs) / Math.max(1, endMs - startMs) + 0.03,
          320
        );
        const hesitationScore = clamp01(0.3 + clusterSize * 0.14);
        events.push({
          id: `${attemptId}-${utteranceId}-hesitation-${clusterIndex + 1}`,
          provider: "modulate",
          sessionId,
          attemptId,
          tStartMs: hesitationWindow.tStartMs,
          tEndMs: hesitationWindow.tEndMs,
          type: "hesitation",
          score: hesitationScore,
          severity: normalizeSeverity(hesitationScore),
          note: "Hesitation markers detected around this phrase.",
          raw: { utterance, cluster },
        });
      });
    }

    if (wpm >= 185) {
      const score = clamp01(0.45 + (wpm - 185) / 80);
      const segmentCount =
        words >= 30 && endMs - startMs >= 7000
          ? Math.min(4, Math.max(2, Math.round(words / 24)))
          : 1;

      Array.from({ length: segmentCount }).forEach((_, segmentIndex) => {
        const paceWindow = buildWindowFromRatios(
          startMs,
          endMs,
          segmentIndex / segmentCount,
          (segmentIndex + 1) / segmentCount,
          450
        );
        events.push({
          id: `${attemptId}-${utteranceId}-pace-${segmentIndex + 1}`,
          provider: "modulate",
          sessionId,
          attemptId,
          tStartMs: paceWindow.tStartMs,
          tEndMs: paceWindow.tEndMs,
          type: "fast_pace",
          score,
          severity: normalizeSeverity(score),
          note:
            segmentCount > 1
              ? `Estimated speaking pace ${Math.round(wpm)} WPM (segment ${segmentIndex + 1}/${segmentCount}).`
              : `Estimated speaking pace ${Math.round(wpm)} WPM in this segment.`,
          raw: { utterance, segmentIndex, segmentCount },
        });
      });
    }

    if (negativeStressEmotions.has(emotion)) {
      const score = 0.76;
      const stressWindow = buildWindowFromRatios(startMs, endMs, 0.52, 0.82, 500);
      events.push({
        id: `${attemptId}-${utteranceId}-stress`,
        provider: "modulate",
        sessionId,
        attemptId,
        tStartMs: stressWindow.tStartMs,
        tEndMs: stressWindow.tEndMs,
        type: "stress_spike",
        score,
        severity: normalizeSeverity(score),
        note: `Emotion signal: ${utterance.emotion}.`,
        raw: utterance,
      });
    }

    if (confidenceDipEmotions.has(emotion)) {
      const score = 0.74;
      const confidenceWindow = buildWindowFromRatios(
        startMs,
        endMs,
        0.38,
        0.68,
        500
      );
      events.push({
        id: `${attemptId}-${utteranceId}-confidence`,
        provider: "modulate",
        sessionId,
        attemptId,
        tStartMs: confidenceWindow.tStartMs,
        tEndMs: confidenceWindow.tEndMs,
        type: "confidence_dip",
        score,
        severity: normalizeSeverity(score),
        note: `Confidence dip inferred from emotion signal: ${utterance.emotion}.`,
        raw: utterance,
      });
    }

    if (recoveryEmotions.has(emotion)) {
      const score = 0.67;
      const recoveryWindow = buildWindowFromRatios(startMs, endMs, 0.72, 0.96, 420);
      events.push({
        id: `${attemptId}-${utteranceId}-recovery`,
        provider: "modulate",
        sessionId,
        attemptId,
        tStartMs: recoveryWindow.tStartMs,
        tEndMs: recoveryWindow.tEndMs,
        type: "recovery",
        score,
        severity: normalizeSeverity(score),
        note: `Recovery signal inferred from emotion: ${utterance.emotion}.`,
        raw: utterance,
      });
    }

    if (index > 0) {
      const previous = utterances[index - 1];
      const previousEndMs = previous.start_ms + previous.duration_ms;
      const gapMs = startMs - previousEndMs;

      if (gapMs >= 900) {
        const score = clamp01(0.4 + (gapMs - 900) / 1800);
        events.push({
          id: `${attemptId}-${utteranceId}-gap`,
          provider: "modulate",
          sessionId,
          attemptId,
          tStartMs: previousEndMs,
          tEndMs: startMs,
          type: "hesitation",
          score,
          severity: normalizeSeverity(score),
          note: `Long pause (${gapMs}ms) between utterances.`,
          raw: { previous, current: utterance },
        });
      }
    }

    if (
      !overrunEventAdded &&
      targetDurationSec != null &&
      targetDurationSec > 0 &&
      endMs > targetDurationSec * 1000
    ) {
      const overtimeSec = (endMs - targetDurationSec * 1000) / 1000;
      const score = clamp01(0.5 + overtimeSec / 20);
      events.push({
        id: `${attemptId}-${utteranceId}-overrun`,
        provider: "modulate",
        sessionId,
        attemptId,
        tStartMs: Math.max(0, targetDurationSec * 1000),
        tEndMs: endMs,
        type: "timing_overrun_risk",
        score,
        severity: normalizeSeverity(score),
        note: `Run exceeded target by ${overtimeSec.toFixed(1)}s.`,
        raw: utterance,
      });
      overrunEventAdded = true;
    }
  });

  events.sort((a, b) => {
    if (a.tStartMs !== b.tStartMs) return a.tStartMs - b.tStartMs;
    return a.id.localeCompare(b.id);
  });

  return events;
}

function buildTranscript(
  response: ModulateBatchResponse,
  events: VoiceSignalEvent[]
): Transcript | undefined {
  const fullText = (response.text ?? "").trim();
  const fallbackDurationMs = response.duration_ms;

  const baseSegments: TranscriptSegment[] = response.utterances.map((u) => {
    const tStartMs = u.start_ms;
    const tEndMs = u.start_ms + u.duration_ms;
    return {
      id: u.utterance_uuid,
      tStartMs,
      tEndMs,
      text: u.text,
      speaker:
        typeof u.speaker === "number" && Number.isFinite(u.speaker)
          ? String(u.speaker)
          : undefined,
      flags: [],
    };
  });

  const estimatedSingleDurationMs =
    baseSegments.length === 1
      ? Math.max(0, baseSegments[0].tEndMs - baseSegments[0].tStartMs)
      : 0;

  const shouldChunkLongSingleUtterance =
    baseSegments.length === 1 &&
    countWords(baseSegments[0].text) >= 20 &&
    fullText.length > 0;

  const estimatedSegments = shouldChunkLongSingleUtterance
    ? splitIntoEstimatedSegments(
        fullText,
        estimatedSingleDurationMs > 0
          ? estimatedSingleDurationMs
          : fallbackDurationMs,
        baseSegments[0].id
      )
    : [];

  const segments = (() => {
    if (estimatedSegments.length > 1) return estimatedSegments;
    if (baseSegments.length > 0) return baseSegments;
    if (!fullText) return [];

    const fallbackSegments = splitIntoEstimatedSegments(
      fullText,
      fallbackDurationMs,
      "transcript"
    );
    if (fallbackSegments.length > 0) return fallbackSegments;

    return [
      {
        id: crypto.randomUUID(),
        tStartMs: 0,
        tEndMs: fallbackDurationMs,
        text: fullText,
        flags: [],
      },
    ];
  })();

  if (segments.length === 0) return undefined;

  return {
    fullText: fullText || segments.map((s) => s.text).join(" "),
    segments: attachEventsToTranscript(segments, events),
  };
}

function splitIntoEstimatedSegments(
  text: string,
  durationMs: number,
  idPrefix: string
): TranscriptSegment[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentenceParts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const parts =
    sentenceParts.length >= 2
      ? sentenceParts
      : chunkTextByWords(normalized, 18, 28);

  if (parts.length === 0) return [];

  const totalWords = parts.reduce((sum, part) => sum + countWords(part), 0);
  const safeTotalWords = Math.max(totalWords, 1);
  const estimatedDuration =
    durationMs > 0 ? durationMs : Math.max(2500, safeTotalWords * 380);

  const minSegmentMs = 600;
  let cursorMs = 0;

  return parts.map((part, index) => {
    const partWords = Math.max(1, countWords(part));
    const remainingParts = parts.length - index - 1;
    const rawSliceMs = Math.round((estimatedDuration * partWords) / safeTotalWords);
    const maxAllowedForThisPart = Math.max(
      minSegmentMs,
      estimatedDuration - cursorMs - remainingParts * minSegmentMs
    );
    const sliceMs =
      index === parts.length - 1
        ? Math.max(minSegmentMs, estimatedDuration - cursorMs)
        : Math.min(maxAllowedForThisPart, Math.max(minSegmentMs, rawSliceMs));

    const tStartMs = cursorMs;
    const tEndMs = Math.min(estimatedDuration, cursorMs + sliceMs);
    cursorMs = tEndMs;

    return {
      id: `${idPrefix}-${index + 1}`,
      tStartMs,
      tEndMs,
      text: part,
      flags: [],
    };
  });
}

function chunkTextByWords(
  text: string,
  targetWordsPerChunk: number,
  maxWordsPerChunk: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= maxWordsPerChunk) return [text];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < words.length) {
    const remaining = words.length - cursor;
    const take =
      remaining > maxWordsPerChunk
        ? targetWordsPerChunk
        : remaining;
    const end = Math.min(words.length, cursor + take);
    chunks.push(words.slice(cursor, end).join(" "));
    cursor = end;
  }

  return chunks;
}

/**
 * Modulate batch provider backed by the Velma-2 STT batch endpoint.
 *
 * Docs source used:
 * /Users/soulemanesow/Downloads/modulate/velma-2-stt-batch.yaml
 */
export class ModulateProvider implements VoiceIntelligenceProvider {
  private apiKey: string;
  private batchUrl: string;
  private requestTimeoutMs: number;
  private speakerDiarization: boolean;
  private emotionSignal: boolean;
  private accentSignal: boolean;
  private piiPhiTagging: boolean;
  private maxRetries: number;
  private retryBaseMs: number;
  private jobs = new Map<string, VoiceAnalysisSummary>();

  constructor() {
    this.apiKey = process.env.MODULATE_API_KEY ?? "";
    const apiBase = process.env.MODULATE_API_URL ?? DEFAULT_API_BASE;
    const endpointPath = process.env.MODULATE_BATCH_PATH ?? DEFAULT_BATCH_PATH;
    this.batchUrl = new URL(endpointPath, apiBase).toString();
    this.requestTimeoutMs = asPositiveInt(
      process.env.MODULATE_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    );
    this.speakerDiarization = asBoolean(
      process.env.MODULATE_SPEAKER_DIARIZATION,
      true
    );
    this.emotionSignal = asBoolean(process.env.MODULATE_EMOTION_SIGNAL, true);
    this.accentSignal = asBoolean(process.env.MODULATE_ACCENT_SIGNAL, false);
    this.piiPhiTagging = asBoolean(process.env.MODULATE_PII_PHI_TAGGING, false);
    this.maxRetries = asPositiveInt(
      process.env.MODULATE_MAX_RETRIES,
      DEFAULT_MAX_RETRIES
    );
    this.retryBaseMs = asPositiveInt(
      process.env.MODULATE_RETRY_BASE_MS,
      DEFAULT_RETRY_BASE_MS
    );
  }

  async startAnalysis(
    input: VoiceAnalysisStartInput
  ): Promise<{ providerJobId: string }> {
    if (!this.apiKey) {
      throw new Error(
        "Missing MODULATE_API_KEY. Add it to your environment to use real transcription."
      );
    }
    if (!input.audioBuffer) {
      throw new Error(
        "Missing audioBuffer in startAnalysis input. Provide recorded audio bytes."
      );
    }

    const fileName = input.audioFileName ?? "recording.webm";
    // Prefer the normalized audio MIME type when available; keep
    // application/octet-stream as a safe fallback.
    const normalizedAudioMime =
      typeof input.audioMimeType === "string"
        ? input.audioMimeType.split(";")[0]?.trim().toLowerCase()
        : "";
    const uploadMimeType =
      normalizedAudioMime && normalizedAudioMime.startsWith("audio/")
        ? normalizedAudioMime
        : "application/octet-stream";
    const uploadBlob = new Blob([input.audioBuffer], {
      type: uploadMimeType,
    });

    const profiles = this.buildProfiles();
    let lastError = "Unknown transcription failure.";

    for (const profile of profiles) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.requestTimeoutMs
        );

        try {
          const response = await this.sendBatchRequest({
            blob: uploadBlob,
            fileName,
            profile,
            signal: controller.signal,
          });

          if (!response.ok) {
            const detail = await this.extractErrorDetail(response);
            lastError = detail;
            const retryable =
              response.status === 408 ||
              response.status === 429 ||
              response.status >= 500;

            if (retryable && attempt < this.maxRetries) {
              await sleep(this.retryBaseMs * attempt);
              continue;
            }

            // Try the next fallback profile for transient server-side failures.
            if (response.status >= 500) {
              break;
            }

            throw new Error(detail);
          }

          const result = parseBatchResponse(await response.json());
          const events = buildSignalsFromUtterances({
            utterances: result.utterances,
            sessionId: input.sessionId,
            attemptId: input.attemptId,
            targetDurationSec: extractTargetDurationSec(input.metadata),
          });
          const transcript = buildTranscript(result, events);

          const providerJobId = `modulate-${crypto.randomUUID().slice(0, 12)}`;
          const summary: VoiceAnalysisSummary = {
            sessionId: input.sessionId,
            attemptId: input.attemptId,
            status: "completed",
            transcript,
            events,
            aggregateSignals: aggregateSignals(events),
          };
          this.jobs.set(providerJobId, summary);

          return { providerJobId };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown request error.";
          lastError = message;

          // AbortError / network errors: retry within this profile.
          if (attempt < this.maxRetries) {
            await sleep(this.retryBaseMs * attempt);
            continue;
          }
          break;
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    throw new Error(lastError);
  }

  async getStatus(providerJobId: string): Promise<VoiceAnalysisSummary> {
    const summary = this.jobs.get(providerJobId);
    if (!summary) {
      return {
        sessionId: "",
        attemptId: "",
        status: "failed",
        events: [],
      };
    }
    return summary;
  }

  async parseWebhook(
    body: unknown
  ): Promise<VoiceSignalEvent[] | VoiceAnalysisSummary | null> {
    if (!isRecord(body)) return null;

    const sessionId = asString(body.sessionId);
    const attemptId = asString(body.attemptId);

    if (!sessionId || !attemptId) return null;

    if ("events" in body && Array.isArray(body.events)) {
      const events = body.events
        .filter(isRecord)
        .map((event) => mapProviderEvent(event, sessionId, attemptId));
      return events;
    }

    if ("text" in body || "utterances" in body) {
      const parsed = parseBatchResponse(body);
      const events = buildSignalsFromUtterances({
        utterances: parsed.utterances,
        sessionId,
        attemptId,
        targetDurationSec: extractTargetDurationSec(
          isRecord(body.metadata) ? body.metadata : undefined
        ),
      });
      const transcript = buildTranscript(parsed, events);
      return {
        sessionId,
        attemptId,
        status: "completed",
        transcript,
        events,
        aggregateSignals: aggregateSignals(events),
      };
    }

    return null;
  }

  private buildProfiles(): BatchFeatureProfile[] {
    const configured: BatchFeatureProfile = {
      speakerDiarization: this.speakerDiarization,
      emotionSignal: this.emotionSignal,
      accentSignal: this.accentSignal,
      piiPhiTagging: this.piiPhiTagging,
    };

    const conservative: BatchFeatureProfile = {
      speakerDiarization: true,
      emotionSignal: false,
      accentSignal: false,
      piiPhiTagging: false,
    };

    const minimal: BatchFeatureProfile = {
      speakerDiarization: false,
      emotionSignal: false,
      accentSignal: false,
      piiPhiTagging: false,
    };

    const profiles = [configured, conservative, minimal];
    const seen = new Set<string>();

    return profiles.filter((profile) => {
      const key = [
        profile.speakerDiarization,
        profile.emotionSignal,
        profile.accentSignal,
        profile.piiPhiTagging,
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async sendBatchRequest(params: {
    blob: Blob;
    fileName: string;
    profile: BatchFeatureProfile;
    signal: AbortSignal;
  }): Promise<Response> {
    const { blob, fileName, profile, signal } = params;
    const form = new FormData();
    form.append("upload_file", blob, fileName);
    form.append("speaker_diarization", String(profile.speakerDiarization));
    form.append("emotion_signal", String(profile.emotionSignal));
    form.append("accent_signal", String(profile.accentSignal));
    form.append("pii_phi_tagging", String(profile.piiPhiTagging));

    return fetch(this.batchUrl, {
      method: "POST",
      headers: { "X-API-Key": this.apiKey },
      body: form,
      cache: "no-store",
      signal,
    });
  }

  private async extractErrorDetail(response: Response): Promise<string> {
    let detail = `Modulate request failed with status ${response.status}.`;
    try {
      const errorJson = (await response.json()) as ProviderPayload;
      if (typeof errorJson.detail === "string" && errorJson.detail.trim()) {
        detail = errorJson.detail;
      }
    } catch {
      const errorText = await response.text();
      if (errorText.trim()) detail = errorText;
    }
    return detail;
  }
}

export const modulateProvider = new ModulateProvider();
