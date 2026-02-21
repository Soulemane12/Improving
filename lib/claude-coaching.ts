import type { AttemptMetrics, CoachingStrategyResult } from "@/types";

interface ClaudeCoachingInput {
  scenarioId: string;
  targetDurationSec: number;
  transcriptText: string;
  metrics: AttemptMetrics;
  strategy: CoachingStrategyResult;
}

interface ClaudeMessageResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fallbackSentence(input: ClaudeCoachingInput): string {
  const hook = input.metrics.hookStrengthScore;
  const clarity = input.metrics.clarityScore;
  const pacing = input.metrics.pacingScore;

  if (hook < 78) {
    return "Open with one specific number in the first five seconds to create urgency, then transition directly into your value plan.";
  }
  if (clarity < 82) {
    return "Tighten your structure into three short beats so your message lands clearly before your CTA.";
  }
  if (pacing < 84) {
    return "Slow transitions slightly and insert a brief pause after each key claim to keep your delivery controlled and confident.";
  }
  return "Strong baseline; now sharpen the first line and make the CTA more direct so the opener feels decisive end to end.";
}

function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;
}

export async function generateCoachingSentence(
  input: ClaudeCoachingInput
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return fallbackSentence(input);
  }

  const transcript = compactWhitespace(input.transcriptText).slice(0, 1800);
  const prompt = [
    "Return exactly one coaching sentence, max 28 words.",
    "No bullets, no preface, no labels.",
    `Scenario: ${input.scenarioId}`,
    `Target duration: ${input.targetDurationSec}s`,
    `Strategy label: ${input.strategy.label}`,
    `Strategy reason: ${input.strategy.reason}`,
    `Metrics: overall=${input.metrics.overallScore}, hook=${input.metrics.hookStrengthScore}, clarity=${input.metrics.clarityScore}, pacing=${input.metrics.pacingScore}, confidence=${input.metrics.confidenceScore}, cta=${input.metrics.ctaStrengthScore}, filler/min=${input.metrics.fillerRatePerMin}, stress=${input.metrics.stressIndex}`,
    `Transcript: ${transcript || "N/A"}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
        max_tokens: 80,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `Anthropic error ${response.status}`);
    }

    const data = (await response.json()) as ClaudeMessageResponse;
    const text = data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join(" ");
    const sentence = compactWhitespace(text ?? "");

    if (!sentence) {
      return fallbackSentence(input);
    }

    return sentence;
  } catch (error) {
    console.error("Claude coaching sentence failed:", error);
    return fallbackSentence(input);
  } finally {
    clearTimeout(timeout);
  }
}

