"use client";

import { useState, useCallback } from "react";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useWaveform } from "@/hooks/useWaveform";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { RecordingPanel } from "@/components/RecordingPanel";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { SignalsTimeline } from "@/components/SignalsTimeline";
import { EventList } from "@/components/EventList";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { CoachingStrategy } from "@/components/CoachingStrategy";

const TARGET_DURATION_SEC = 60;

type AppPhase = "pre-recording" | "recording" | "processing" | "results";

export default function PracticePage() {
  const [phase, setPhase] = useState<AppPhase>("pre-recording");
  const [hasConsented, setHasConsented] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const capture = useAudioCapture();
  const waveform = useWaveform(capture.stream);
  const analysis = useAnalysisStream(sessionId);

  const handleConsent = useCallback(() => {
    setHasConsented(true);
  }, []);

  const handleStart = useCallback(async () => {
    // Create session on backend
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: "listing-opener",
        targetDurationSec: TARGET_DURATION_SEC,
      }),
    });
    const data = await res.json();
    const newSessionId = data.sessionId as string;
    setSessionId(newSessionId);

    // Create attempt
    const aid = crypto.randomUUID();
    setAttemptId(aid);

    // Start recording
    await capture.start(async (chunk) => {
      const formData = new FormData();
      formData.append("attemptId", aid);
      formData.append("chunk", chunk);
      await fetch("/api/audio/chunk", { method: "POST", body: formData }).catch(
        () => {}
      );
    });

    setPhase("recording");
  }, [capture]);

  const handleStop = useCallback(async () => {
    const blob = await capture.stop();
    if (!blob || !sessionId || !attemptId) return;

    setPhase("processing");

    // Finalize upload and start analysis
    await fetch("/api/audio/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, attemptId }),
    });
  }, [capture, sessionId, attemptId]);

  // Derive display phase: auto-transition to results when coaching is ready
  const displayPhase =
    phase === "processing" && analysis.status === "coaching_ready"
      ? "results"
      : phase;

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

            {/* Try Again */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => {
                  setPhase("pre-recording");
                  setSessionId(null);
                  setAttemptId(null);
                  setSelectedEventId(null);
                  setSelectedSegmentId(null);
                  analysis.reset();
                }}
                className="px-8 py-3 bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors"
              >
                Practice Again
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
