import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import * as store from "@/lib/store";
import { publish } from "@/lib/events";
import { computeMetrics } from "@/lib/metrics";
import { compareRuns } from "@/lib/comparison";
import { selectCoachingStrategy } from "@/lib/strategy";
import { generateCoachingSentence } from "@/lib/claude-coaching";
import { logCompletedAttempt } from "@/lib/analytics";
import { modulateProvider } from "@/providers/modulate-provider";
import type {
  AnalysisStatus,
  Transcript,
  VoiceAnalysisStartInput,
} from "@/types";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableProviderError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("internal server error") ||
    normalized.includes("status 5") ||
    normalized.includes("timed out") ||
    normalized.includes("network") ||
    normalized.includes("abort")
  );
}

async function startAnalysisWithRetry(
  input: VoiceAnalysisStartInput
): Promise<{ providerJobId: string }> {
  const maxAttempts = 2;
  let lastError = "Failed to start analysis.";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await modulateProvider.startAnalysis(input);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error.";
      lastError = message;

      if (!isRetryableProviderError(message) || attempt === maxAttempts) {
        break;
      }

      // Brief cool-down before one more full provider attempt.
      await sleep(900 * attempt);
    }
  }

  throw new Error(lastError);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

function canRetryWithTranscode(audioMimeType: string, errorMessage: string): boolean {
  const mime = audioMimeType.toLowerCase();
  const retryableMime =
    mime.includes("webm") || mime.includes("ogg") || mime.includes("opus");
  const retryableError =
    errorMessage.toLowerCase().includes("internal server error") ||
    errorMessage.toLowerCase().includes("status 5");
  return retryableMime && retryableError;
}

async function transcodeToWav(audioBuffer: ArrayBuffer, inputExtension: string) {
  const id = randomUUID();
  const inPath = join(tmpdir(), `voice-in-${id}.${inputExtension || "bin"}`);
  const outPath = join(tmpdir(), `voice-out-${id}.wav`);

  try {
    await writeFile(inPath, Buffer.from(audioBuffer));
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outPath,
    ]);

    const wav = await readFile(outPath);
    return toArrayBuffer(wav);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

function publishStatus(
  sessionId: string,
  attemptId: string,
  status: AnalysisStatus
): void {
  store.setAnalysisStatus(attemptId, status);
  publish(sessionId, {
    type: "status_change",
    sessionId,
    attemptId,
    payload: { status },
  });
}

function getDurationSec(transcript: Transcript | undefined): number {
  if (!transcript || transcript.segments.length === 0) return 0;
  const maxEndMs = transcript.segments.reduce(
    (max, segment) => Math.max(max, segment.tEndMs),
    0
  );
  return maxEndMs > 0 ? maxEndMs / 1000 : 0;
}

function mergeAudioChunks(chunks: ArrayBuffer[]): ArrayBuffer {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}

function inferExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mp3") || normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("opus")) return "opus";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("aac")) return "aac";
  if (normalized.includes("flac")) return "flac";
  if (normalized.includes("aiff")) return "aiff";
  if (normalized.includes("mov")) return "mov";
  return "bin";
}

function normalizeFileName(
  fileName: string | undefined,
  attemptId: string,
  fallbackExtension: string
): string {
  const trimmed = fileName?.trim();
  if (!trimmed) return `attempt-${attemptId}.${fallbackExtension}`;

  const base = trimmed.split(/[\\/]/).pop() ?? trimmed;
  if (base.includes(".") && !base.endsWith(".")) return base;

  return `${base}.${fallbackExtension}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, attemptId, audioMimeType, audioFileName } = body as {
    sessionId?: string;
    attemptId?: string;
    audioMimeType?: string;
    audioFileName?: string;
  };

  if (!sessionId || !attemptId) {
    return NextResponse.json(
      { error: "Missing sessionId or attemptId" },
      { status: 400 }
    );
  }

  const session = store.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // Create attempt if it doesn't exist (frontend generates the ID)
  let attempt = store.getAttempt(attemptId);
  if (!attempt) {
    const existingAttempts = store.getAttemptsBySession(sessionId);
    attempt = store.createAttempt({
      id: attemptId,
      sessionId,
      runNumber: existingAttempts.length + 1,
      analysisStatus: "processing",
      createdAt: new Date().toISOString(),
    });
  } else {
    store.updateAttempt(attemptId, { analysisStatus: "processing" });
  }

  const chunks = store.getAudioChunks(attemptId);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "No recorded audio chunks found for this attempt." },
      { status: 400 }
    );
  }

  publishStatus(sessionId, attemptId, "processing_audio");

  try {
    const mergedAudio = mergeAudioChunks(chunks);
    const safeMimeType =
      typeof audioMimeType === "string" && audioMimeType.trim()
        ? audioMimeType
        : "audio/webm;codecs=opus";
    const extension = inferExtension(safeMimeType);
    const fileName = normalizeFileName(audioFileName, attemptId, extension);
    const baseInput: VoiceAnalysisStartInput = {
      sessionId,
      attemptId,
      scenarioId: session.scenarioId,
      audioBuffer: mergedAudio,
      audioFileName: fileName,
      audioMimeType: safeMimeType,
      metadata: { targetDurationSec: session.targetDurationSec },
    };

    let providerJobId: string;
    try {
      providerJobId = (await startAnalysisWithRetry(baseInput)).providerJobId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error.";

      if (!canRetryWithTranscode(safeMimeType, message)) {
        throw error;
      }

      console.log("[api/audio/finalize] retrying with ffmpeg wav transcode", {
        sessionId,
        attemptId,
        originalMime: safeMimeType,
        reason: message,
      });

      const wavBuffer = await transcodeToWav(mergedAudio, extension);
      const wavFileName = normalizeFileName(audioFileName, attemptId, "wav");

      providerJobId = (
        await startAnalysisWithRetry({
          ...baseInput,
          audioBuffer: wavBuffer,
          audioMimeType: "audio/wav",
          audioFileName: wavFileName,
        })
      ).providerJobId;
    }

    store.updateAttempt(attemptId, { providerJobId, analysisStatus: "processing" });
    publishStatus(sessionId, attemptId, "extracting_voice_signals");

    const summary = await modulateProvider.getStatus(providerJobId);
    if (summary.status === "failed") {
      throw new Error("Modulate returned a failed analysis result.");
    }

    if (summary.events.length > 0) {
      for (const event of summary.events) {
        store.addVoiceEvent(event);
        publish(sessionId, {
          type: "voice_event",
          sessionId,
          attemptId,
          payload: event,
        });
      }
    }

    if (summary.transcript) {
      store.setTranscript(attemptId, summary.transcript);
      publish(sessionId, {
        type: "transcript",
        sessionId,
        attemptId,
        payload: summary.transcript,
      });
    }

    publishStatus(sessionId, attemptId, "scoring");

    const durationSec = getDurationSec(summary.transcript);
    const metrics = computeMetrics({
      events: summary.events,
      transcriptText: summary.transcript?.fullText ?? "",
      durationSec,
      targetSec: session.targetDurationSec,
    });
    store.setMetrics(attemptId, metrics);
    store.updateAttempt(attemptId, {
      durationSec: Number(durationSec.toFixed(2)),
      analysisStatus: "processing",
    });
    publish(sessionId, {
      type: "metrics",
      sessionId,
      attemptId,
      payload: metrics,
    });

    // Run comparison against previous attempt (self-improvement loop)
    const previousRun = store.getPreviousCompletedAttemptWithMetrics(
      sessionId,
      attemptId
    );
    if (previousRun) {
      const comparison = compareRuns({
        previousMetrics: previousRun.metrics,
        currentMetrics: metrics,
        previousAttemptId: previousRun.attempt.id,
        currentAttemptId: attemptId,
        runNumber: attempt.runNumber,
      });
      store.setComparison(attemptId, comparison);
      publish(sessionId, {
        type: "comparison",
        sessionId,
        attemptId,
        payload: comparison,
      });
    }

    publishStatus(sessionId, attemptId, "strategy_selection");

    const strategy = selectCoachingStrategy(metrics);
    store.setStrategy(attemptId, strategy);
    publish(sessionId, {
      type: "strategy",
      sessionId,
      attemptId,
      payload: strategy,
    });

    const coachingSentence = await generateCoachingSentence({
      scenarioId: session.scenarioId,
      targetDurationSec: session.targetDurationSec,
      transcriptText: summary.transcript?.fullText ?? "",
      metrics,
      strategy,
    });
    store.setCoachingSentence(attemptId, coachingSentence);
    publish(sessionId, {
      type: "coaching_sentence",
      sessionId,
      attemptId,
      payload: { sentence: coachingSentence },
    });

    publishStatus(sessionId, attemptId, "coaching_ready");
    store.updateAttempt(attemptId, { analysisStatus: "completed" });

    // Fire-and-forget: log to Supabase analytics pipeline (never blocks response)
    const latestAttempt = store.getAttempt(attemptId) ?? attempt;
    const comparison = store.getComparison(attemptId);
    void logCompletedAttempt({
      session,
      attempt: latestAttempt,
      metrics,
      events: summary.events,
      strategy,
      comparison,
    });

    return NextResponse.json({ providerJobId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze audio.";
    console.error("Finalize analysis failed:", error);
    console.log("[api/audio/finalize] failure", {
      sessionId,
      attemptId,
      message,
    });
    store.updateAttempt(attemptId, { analysisStatus: "failed" });
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    // Clear raw audio from memory (privacy)
    store.clearAudioChunks(attemptId);
  }
}
