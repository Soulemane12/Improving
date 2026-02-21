import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";

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
  const attempts = store.getAttemptsBySession(sessionId);
  if (attempts.length === 0) {
    return NextResponse.json(
      { error: "No attempts found" },
      { status: 404 }
    );
  }

  const latestAttempt = attempts[attempts.length - 1];
  const response = store.getAnalysisResponse(sessionId, latestAttempt.id);

  return NextResponse.json(response);
}
