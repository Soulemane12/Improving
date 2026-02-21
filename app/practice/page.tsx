"use client";

import { useState, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import Link from "next/link";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useWaveform } from "@/hooks/useWaveform";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { useRunHistory } from "@/lib/run-history";
import { RecordingPanel } from "@/components/RecordingPanel";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { SignalsTimeline } from "@/components/SignalsTimeline";
import { EventList } from "@/components/EventList";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { ComparisonDashboard } from "@/components/ComparisonDashboard";
import { CoachingStrategy } from "@/components/CoachingStrategy";

const TARGET_DURATION_SEC = 60;

type AppPhase = "pre-recording" | "recording" | "processing" | "results";

export default function PracticePage() {
  const [phase, setPhase] = useState<AppPhase>("pre-recording");
  const [hasConsented, setHasConsented] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadedAudioPreviewUrl, setUploadedAudioPreviewUrl] = useState<string | null>(null);
  const [uploadedAudioFileName, setUploadedAudioFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const savedAttemptRef = useRef<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const capture = useAudioCapture();
  const waveform = useWaveform(capture.stream);
  const analysis = useAnalysisStream(sessionId);
  const { runCount: totalRunCount, saveRun } = useRunHistory();

  useEffect(() => {
    return () => {
      if (uploadedAudioPreviewUrl) {
        URL.revokeObjectURL(uploadedAudioPreviewUrl);
      }
    };
  }, [uploadedAudioPreviewUrl]);

  const parseErrorMessage = useCallback(
    async (res: Response, fallback: string): Promise<string> => {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) return payload.error;
      } catch {
        const text = await res.text().catch(() => "");
        if (text) return text;
      }
      return fallback;
    },
    []
  );

  const createSessionAndAttempt = useCallback(async (existingSessionId?: string | null) => {
    let newSessionId: string;

    if (existingSessionId) {
      // Reuse the existing session for retry runs (enables comparison)
      newSessionId = existingSessionId;
    } else {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: "listing-opener",
          targetDurationSec: TARGET_DURATION_SEC,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to create session."));
      }
      const data = (await res.json()) as { sessionId: string };
      newSessionId = data.sessionId;
    }

    const newAttemptId = crypto.randomUUID();
    setSessionId(newSessionId);
    setAttemptId(newAttemptId);
    setSelectedEventId(null);
    setSelectedSegmentId(null);
    return { newSessionId, newAttemptId };
  }, [parseErrorMessage]);

  const handleConsent = useCallback(() => {
    setHasConsented(true);
  }, []);

  const handleStart = useCallback(async () => {
    try {
      analysis.reset();
      const { newSessionId, newAttemptId } = await createSessionAndAttempt(sessionId);

      // Start recording
      await capture.start(async (chunk) => {
        const formData = new FormData();
        formData.append("attemptId", newAttemptId);
        formData.append("sessionId", newSessionId);
        formData.append("chunk", chunk);
        await fetch("/api/audio/chunk", { method: "POST", body: formData }).catch(
          () => {}
        );
      });

      setPhase("recording");
    } catch (error) {
      console.error("Could not start recording session:", error);
      setPhase("pre-recording");
    }
  }, [analysis, capture, createSessionAndAttempt, sessionId]);

  const handleUploadAudio = useCallback(
    async (file: File) => {
      setIsUploadingAudio(true);
      setUploadError(null);
      setPhase("processing");
      try {
        analysis.reset();
        const { newSessionId, newAttemptId } = await createSessionAndAttempt(sessionId);

        const uploadFormData = new FormData();
        uploadFormData.append("attemptId", newAttemptId);
        uploadFormData.append("sessionId", newSessionId);
        uploadFormData.append("chunk", file, file.name || "upload-audio");

        const uploadRes = await fetch("/api/audio/chunk", {
          method: "POST",
          body: uploadFormData,
        });
        if (!uploadRes.ok) {
          throw new Error(
            await parseErrorMessage(uploadRes, "Failed to upload audio file.")
          );
        }

        const finalizeRes = await fetch("/api/audio/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: newSessionId,
            attemptId: newAttemptId,
            audioMimeType: file.type || "application/octet-stream",
            audioFileName: file.name,
          }),
        });
        if (!finalizeRes.ok) {
          throw new Error(
            await parseErrorMessage(finalizeRes, "Failed to analyze uploaded audio.")
          );
        }
      } catch (error) {
        console.error("Audio upload failed:", error);
        setUploadError(
          error instanceof Error
            ? error.message
            : "Failed to process uploaded audio."
        );
        setPhase("pre-recording");
      } finally {
        setIsUploadingAudio(false);
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      }
    },
    [analysis, createSessionAndAttempt, parseErrorMessage, sessionId]
  );

  const handleUploadInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (uploadedAudioPreviewUrl) {
        URL.revokeObjectURL(uploadedAudioPreviewUrl);
      }
      setUploadedAudioPreviewUrl(URL.createObjectURL(file));
      setUploadedAudioFileName(file.name);
      setUploadError(null);
      setPhase("processing");
      void handleUploadAudio(file);
    },
    [handleUploadAudio, uploadedAudioPreviewUrl]
  );

  const handleStop = useCallback(async () => {
    const blob = await capture.stop();
    if (!blob || !sessionId || !attemptId) return;

    setPhase("processing");

    // Finalize upload and start analysis
    const res = await fetch("/api/audio/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        attemptId,
        audioMimeType: blob.type,
      }),
    });

    if (!res.ok) {
      let errorMessage = "Failed to start analysis.";
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) errorMessage = payload.error;
      } catch {
        const text = await res.text().catch(() => "");
        if (text) errorMessage = text;
      }
      console.error("Finalize request failed:", errorMessage);
      setPhase("pre-recording");
    }
  }, [capture, sessionId, attemptId]);

  // Derive display phase: auto-transition to results when coaching is ready
  const displayPhase =
    phase === "processing" && analysis.status === "coaching_ready"
      ? "results"
      : phase;

  // Save completed run to localStorage (deferred to avoid setState during render)
  if (
    displayPhase === "results" &&
    analysis.metrics &&
    sessionId &&
    attemptId &&
    savedAttemptRef.current !== attemptId
  ) {
    savedAttemptRef.current = attemptId;
    const runToSave = {
      attemptId,
      sessionId,
      runNumber: totalRunCount + 1,
      metrics: analysis.metrics,
      strategy: analysis.strategy ?? undefined,
      comparison: analysis.comparison ?? undefined,
      completedAt: new Date().toISOString(),
    };
    queueMicrotask(() => saveRun(runToSave));
  }

  const durationMs = (analysis.metrics ? 60 : 0) * 1000;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Voice Coach</h1>
            <p className="text-xs text-neutral-500">
              Listing Opener Practice — {TARGET_DURATION_SEC}s target
            </p>
          </div>
          {sessionId && (
            <span className="text-[10px] font-mono text-neutral-600">
              {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {uploadedAudioPreviewUrl && (
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-2">
              Uploaded Audio Preview{uploadedAudioFileName ? `: ${uploadedAudioFileName}` : ""}
            </p>
            <audio
              controls
              preload="metadata"
              src={uploadedAudioPreviewUrl}
              className="w-full"
            >
              Your browser does not support audio playback.
            </audio>
            {uploadError && (
              <p className="text-xs text-red-400 mt-3">{uploadError}</p>
            )}
          </div>
        )}

        {/* Phase: Pre-recording / Recording */}
        {(displayPhase === "pre-recording" || displayPhase === "recording") && (
          <>
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold mb-2">
                {displayPhase === "pre-recording"
                  ? "Ready to Practice?"
                  : "Recording..."}
              </h2>
              <p className="text-sm text-neutral-400 max-w-lg mx-auto">
                {displayPhase === "pre-recording"
                  ? "Deliver your 60-second listing opener. Speak naturally — we'll analyze your delivery, pacing, confidence, and more."
                  : "Deliver your opening pitch now. The waveform shows your voice activity in real time."}
              </p>
            </div>

            {/* Waveform (only during recording) */}
            {displayPhase === "recording" && (
              <WaveformVisualizer
                dataArray={waveform.dataArray}
                isActive={waveform.isActive}
                isSpeaking={waveform.isSpeaking()}
              />
            )}

            <RecordingPanel
              state={capture.state}
              elapsedMs={capture.elapsedMs}
              targetSec={TARGET_DURATION_SEC}
              onStart={handleStart}
              onStop={handleStop}
              hasConsented={hasConsented}
              onConsent={handleConsent}
            />

            <div className="flex flex-col items-center gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                accept="audio/*,.wav,.webm,.mp3,.m4a,.aac,.ogg,.opus,.flac,.aiff,.mp4,.mov"
                className="hidden"
                onChange={handleUploadInputChange}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={capture.state === "recording" || isUploadingAudio}
                className={`px-5 py-2 rounded-lg border text-sm transition-colors ${
                  capture.state === "recording" || isUploadingAudio
                    ? "border-neutral-700 text-neutral-600 cursor-not-allowed"
                    : "border-neutral-600 text-neutral-300 hover:border-neutral-400 hover:text-white"
                }`}
              >
                {isUploadingAudio ? "Uploading Audio..." : "Upload Audio File"}
              </button>
              <p className="text-xs text-neutral-500">
                Skip mic recording and analyze a local audio file instead.
              </p>
            </div>
          </>
        )}

        {/* Phase: Processing */}
        {displayPhase === "processing" && (
          <>
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold mb-2">Analyzing Your Delivery</h2>
              <p className="text-sm text-neutral-400">
                Extracting voice signals and computing coaching metrics...
              </p>
            </div>

            <ProcessingStatus status={analysis.status} />

            {/* Show events as they arrive */}
            {analysis.events.length > 0 && (
              <SignalsTimeline
                events={analysis.events}
                durationMs={60000}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />
            )}

            {analysis.events.length > 0 && (
              <EventList
                events={analysis.events}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />
            )}
          </>
        )}

        {/* Phase: Results */}
        {displayPhase === "results" && (
          <>
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold mb-2">Your Coaching Report</h2>
              <p className="text-sm text-neutral-400">
                Review your delivery analysis and follow the recommended coaching strategy.
              </p>
            </div>

            {/* Metrics Dashboard */}
            <MetricsDashboard metrics={analysis.metrics} />

            {/* Run Comparison (shown on retry runs) */}
            <ComparisonDashboard comparison={analysis.comparison} />

            {analysis.coachingSentence && (
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
                  Claude Feedback
                </div>
                <p className="text-sm text-neutral-200 leading-relaxed">
                  {analysis.coachingSentence}
                </p>
              </div>
            )}

            {/* Coaching Strategy */}
            <CoachingStrategy strategy={analysis.strategy} />

            {/* Timeline */}
            <SignalsTimeline
              events={analysis.events}
              durationMs={durationMs}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />

            {/* Events + Transcript side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EventList
                events={analysis.events}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />
              {analysis.transcript && (
                <TranscriptViewer
                  segments={analysis.transcript.segments}
                  selectedSegmentId={selectedSegmentId}
                  onSelectSegment={setSelectedSegmentId}
                />
              )}
            </div>

            {/* Post-run prompt */}
            <div className="flex flex-col items-center gap-4 pt-6">
              {totalRunCount >= 2 && (
                <div className="text-center mb-2 p-4 rounded-xl bg-neutral-900 border border-neutral-800 max-w-md w-full">
                  <p className="text-sm text-neutral-300 mb-3">
                    You have <span className="text-white font-semibold">{totalRunCount} runs</span> recorded.
                    View your improvement trends over time.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    View Trends Dashboard
                  </Link>
                </div>
              )}

              <button
                onClick={() => {
                  // Keep sessionId so the next attempt compares against this one
                  setPhase("pre-recording");
                  setAttemptId(null);
                  setSelectedEventId(null);
                  setSelectedSegmentId(null);
                  analysis.reset();
                }}
                className={`px-8 py-3 font-medium rounded-full transition-colors ${
                  totalRunCount >= 2
                    ? "bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700"
                    : "bg-white text-black hover:bg-neutral-200"
                }`}
              >
                Practice Again (Run {totalRunCount + 1})
              </button>

              <button
                onClick={() => {
                  // Full reset — start a brand new session with no comparison history
                  setPhase("pre-recording");
                  setSessionId(null);
                  setAttemptId(null);
                  setSelectedEventId(null);
                  setSelectedSegmentId(null);
                  analysis.reset();
                }}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Start Fresh Session
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
