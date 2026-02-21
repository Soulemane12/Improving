import type { VoiceIntelligenceProvider } from "./types";
import type {
  VoiceAnalysisStartInput,
  VoiceAnalysisSummary,
  VoiceSignalEvent,
} from "@/types";

/**
 * Real Modulate provider — stub for Phase 3.
 *
 * Fill in the actual API calls once you have:
 * - MODULATE_API_KEY (env var)
 * - MODULATE_API_URL (env var)
 * - Modulate's API spec / SDK from your account rep
 *
 * The adapter interface keeps the rest of the app decoupled
 * from Modulate-specific details.
 */
export class ModulateProvider implements VoiceIntelligenceProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.MODULATE_API_KEY ?? "";
    this.apiUrl = process.env.MODULATE_API_URL ?? "https://api.modulate.ai";
  }

  async startAnalysis(
    _input: VoiceAnalysisStartInput
  ): Promise<{ providerJobId: string }> {
    // TODO: Replace with real Modulate API call using this.apiUrl and this.apiKey
    void this.apiKey;
    void this.apiUrl;

    throw new Error(
      "ModulateProvider.startAnalysis() is not yet implemented. " +
        "Configure MODULATE_API_KEY and MODULATE_API_URL, then implement the API call."
    );
  }

  async getStatus(
    _providerJobId: string
  ): Promise<VoiceAnalysisSummary> {
    // TODO: Replace with real Modulate status polling
    throw new Error(
      "ModulateProvider.getStatus() is not yet implemented."
    );
  }

  async parseWebhook(
    _body: unknown
  ): Promise<VoiceSignalEvent[] | VoiceAnalysisSummary | null> {
    // TODO: Parse the inbound Modulate webhook payload
    throw new Error(
      "ModulateProvider.parseWebhook() is not yet implemented."
    );
  }
}

export const modulateProvider = new ModulateProvider();
