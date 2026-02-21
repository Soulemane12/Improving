import type { TranscriptSegment, VoiceSignalEvent, VoiceSignalType } from "@/types";

/**
 * Attach voice events to transcript segments based on time overlap.
 * For each segment, finds all events whose time range intersects the segment,
 * and adds unique event types as flags.
 */
export function attachEventsToTranscript(
  segments: TranscriptSegment[],
  events: VoiceSignalEvent[]
): TranscriptSegment[] {
  return segments.map((seg) => {
    const overlapping = events.filter((ev) => {
      const evStart = ev.tStartMs;
      const evEnd = ev.tEndMs ?? ev.tStartMs;
      return evStart <= seg.tEndMs && evEnd >= seg.tStartMs;
    });

    const flags: VoiceSignalType[] = Array.from(
      new Set(overlapping.map((e) => e.type))
    );

    return { ...seg, flags };
  });
}
