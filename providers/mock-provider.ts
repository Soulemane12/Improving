import type { VoiceIntelligenceProvider } from "./types";
import type {
  VoiceAnalysisStartInput,
  VoiceAnalysisSummary,
  VoiceSignalEvent,
} from "@/types";
import {
  createMockVoiceEvents,
  createMockTranscript,
  createMockMetrics,
} from "@/lib/mock-data";
import { attachEventsToTranscript } from "@/lib/alignment";
import { selectCoachingStrategy } from "@/lib/strategy";
import { publish } from "@/lib/events";
import * as store from "@/lib/store";

/**
 * Mock implementation of VoiceIntelligenceProvider.
 * Simulates Modulate processing with realistic delays and incremental event delivery.
 */
export class MockVoiceProvider implements VoiceIntelligenceProvider {
  private jobs = new Map<
    string,
    { sessionId: string; attemptId: string; status: string }
  >();

  async startAnalysis(
    input: VoiceAnalysisStartInput
  ): Promise<{ providerJobId: string }> {
    const providerJobId = `mock-job-${crypto.randomUUID().slice(0, 8)}`;
    this.jobs.set(providerJobId, {
      sessionId: input.sessionId,
      attemptId: input.attemptId,
      status: "processing",
    });

    // Kick off simulated async processing
    this.simulateAnalysis(providerJobId, input.sessionId, input.attemptId);

    return { providerJobId };
  }

  async getStatus(providerJobId: string): Promise<VoiceAnalysisSummary> {
    const job = this.jobs.get(providerJobId);
    if (!job) {
      return {
        sessionId: "",
        attemptId: "",
        status: "failed",
        events: [],
      };
    }

    return {
      sessionId: job.sessionId,
      attemptId: job.attemptId,
      status: job.status as VoiceAnalysisSummary["status"],
      events: store.getVoiceEvents(job.attemptId),
      transcript: store.getTranscript(job.attemptId),
    };
  }

  async parseWebhook(
    _body: unknown
  ): Promise<VoiceSignalEvent[] | VoiceAnalysisSummary | null> {
    // Mock provider doesn't use webhooks
    return null;
  }

  private simulateAnalysis(
    providerJobId: string,
    sessionId: string,
    attemptId: string
  ): void {
    const events = createMockVoiceEvents(sessionId, attemptId);
    const transcript = createMockTranscript(sessionId, attemptId);
    const mockMetrics = createMockMetrics();
    // Step 1: processing_audio (immediate)
    store.setAnalysisStatus(attemptId, "processing_audio");
    publish(sessionId, {
      type: "status_change",
      sessionId,
      attemptId,
      payload: { status: "processing_audio" },
    });

    // Step 2: extracting_voice_signals (after 1s), then deliver events incrementally
    setTimeout(() => {
      store.setAnalysisStatus(attemptId, "extracting_voice_signals");
      publish(sessionId, {
        type: "status_change",
        sessionId,
        attemptId,
        payload: { status: "extracting_voice_signals" },
      });

      // Deliver events one by one every 400ms
      events.forEach((event, i) => {
        setTimeout(() => {
          store.addVoiceEvent(event);
          publish(sessionId, {
            type: "voice_event",
            sessionId,
            attemptId,
            payload: event,
          });
        }, (i + 1) * 400);
      });

      // Step 3: transcript arrives after all events
      const transcriptDelay = (events.length + 1) * 400 + 200;
      setTimeout(() => {
        const alignedTranscript = {
          ...transcript,
          segments: attachEventsToTranscript(transcript.segments, events),
        };
        store.setTranscript(attemptId, alignedTranscript);
        publish(sessionId, {
          type: "transcript",
          sessionId,
          attemptId,
          payload: alignedTranscript,
        });

        // Step 4: scoring
        store.setAnalysisStatus(attemptId, "scoring");
        publish(sessionId, {
          type: "status_change",
          sessionId,
          attemptId,
          payload: { status: "scoring" },
        });

        setTimeout(() => {
          store.setMetrics(attemptId, mockMetrics);
          store.updateAttempt(attemptId, { durationSec: 60 });
          publish(sessionId, {
            type: "metrics",
            sessionId,
            attemptId,
            payload: mockMetrics,
          });

          // Step 5: strategy_selection
          store.setAnalysisStatus(attemptId, "strategy_selection");
          publish(sessionId, {
            type: "status_change",
            sessionId,
            attemptId,
            payload: { status: "strategy_selection" },
          });

          setTimeout(() => {
            const strategy = selectCoachingStrategy(mockMetrics);
            store.setStrategy(attemptId, strategy);
            publish(sessionId, {
              type: "strategy",
              sessionId,
              attemptId,
              payload: strategy,
            });

            // Step 6: coaching_ready
            store.setAnalysisStatus(attemptId, "coaching_ready");
            this.jobs.set(providerJobId, {
              sessionId,
              attemptId,
              status: "completed",
            });
            publish(sessionId, {
              type: "status_change",
              sessionId,
              attemptId,
              payload: { status: "coaching_ready" },
            });
          }, 500);
        }, 600);
      }, transcriptDelay);
    }, 1000);
  }
}

/** Singleton instance */
export const mockProvider = new MockVoiceProvider();
