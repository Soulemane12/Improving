import type {
  VoiceAnalysisStartInput,
  VoiceAnalysisSummary,
  VoiceSignalEvent,
} from "@/types";

export interface VoiceIntelligenceProvider {
  /** Kick off analysis for an audio upload or live stream. */
  startAnalysis(
    input: VoiceAnalysisStartInput
  ): Promise<{ providerJobId: string }>;

  /** Poll current status / results for a running job. */
  getStatus(providerJobId: string): Promise<VoiceAnalysisSummary>;

  /** Parse an inbound webhook payload into normalized events or a summary. */
  parseWebhook(
    body: unknown
  ): Promise<VoiceSignalEvent[] | VoiceAnalysisSummary | null>;
}
