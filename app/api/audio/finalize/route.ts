import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import { mockProvider } from "@/providers/mock-provider";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, attemptId } = body as {
    sessionId?: string;
    attemptId?: string;
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

  // Use mock provider for now. Swap to modulateProvider for Phase 3.
  const { providerJobId } = await mockProvider.startAnalysis({
    sessionId,
    attemptId,
    scenarioId: session.scenarioId,
  });

  store.updateAttempt(attemptId, { providerJobId });

  // Clear raw audio from memory (privacy)
  store.clearAudioChunks(attemptId);

  return NextResponse.json({ providerJobId });
}
