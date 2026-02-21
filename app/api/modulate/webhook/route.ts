import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import { publish } from "@/lib/events";
import { mockProvider } from "@/providers/mock-provider";

export async function POST(req: NextRequest) {
  // Fast ACK — respond immediately, process async
  const body = await req.json();

  // TODO: Verify webhook signature when using real Modulate
  // const signature = req.headers.get("x-modulate-signature");
  // if (!verifySignature(body, signature)) {
  //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // }

  // Process asynchronously (don't block the response)
  processWebhook(body).catch((err) =>
    console.error("Webhook processing failed:", err)
  );

  return NextResponse.json({ ok: true });
}

async function processWebhook(body: unknown): Promise<void> {
  // Use mock provider for now. Swap to modulateProvider for Phase 3.
  const parsed = await mockProvider.parseWebhook(body);
  if (!parsed) return;

  if (Array.isArray(parsed)) {
    // Array of voice events
    for (const event of parsed) {
      store.addVoiceEvent(event);
      publish(event.sessionId, {
        type: "voice_event",
        sessionId: event.sessionId,
        attemptId: event.attemptId,
        payload: event,
      });
    }
  } else {
    // Full summary
    if (parsed.events.length > 0) {
      store.addVoiceEvents(parsed.events);
    }
    if (parsed.transcript) {
      store.setTranscript(parsed.attemptId, parsed.transcript);
    }
    publish(parsed.sessionId, {
      type: "transcript",
      sessionId: parsed.sessionId,
      attemptId: parsed.attemptId,
      payload: parsed,
    });
  }
}
