import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { OpeningCoachAnalysisResponse } from "@/types";

function buildPendingResponse(sessionId: string): OpeningCoachAnalysisResponse {
  return {
    sessionId,
    attemptId: "",
    status: "recording",
    voiceSignals: [],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const session = store.getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // Get the latest attempt for this session
  const attempts = store
    .getAttemptsBySession(sessionId)
    .sort((a, b) => b.runNumber - a.runNumber);
  if (attempts.length === 0) {
    // Avoid noisy 404s during the brief window after session creation
    // and before the first attempt/chunk arrives.
    return NextResponse.json(buildPendingResponse(sessionId));
  }

  const latestAttempt = attempts[0];
  const response = store.getAnalysisResponse(sessionId, latestAttempt.id);

  return NextResponse.json(response);
}
