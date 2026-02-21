import { NextRequest } from "next/server";
import { subscribe } from "@/lib/events";
import type { SSEMessage } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribe(sessionId, (message: SSEMessage) => {
        try {
          const data = JSON.stringify(message);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Client disconnected
        }
      });

      // Keepalive every 15s to prevent timeout
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          unsubscribe();
        }
      }, 15000);

      // Cleanup on abort
      _req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
