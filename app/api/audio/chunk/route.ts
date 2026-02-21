import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const attemptId = formData.get("attemptId") as string | null;
  const sessionId = formData.get("sessionId") as string | null;
  const chunk = formData.get("chunk") as Blob | null;

  if (!attemptId || !chunk) {
    return NextResponse.json(
      { error: "Missing attemptId or chunk" },
      { status: 400 }
    );
  }

  let attempt = store.getAttempt(attemptId);
  if (!attempt) {
    if (!sessionId) {
      return NextResponse.json(
        { error: "Attempt not found and sessionId missing" },
        { status: 404 }
      );
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const existingAttempts = store.getAttemptsBySession(sessionId);
    attempt = store.createAttempt({
      id: attemptId,
      sessionId,
      runNumber: existingAttempts.length + 1,
      analysisStatus: "uploading",
      createdAt: new Date().toISOString(),
    });
  }

  const buffer = await chunk.arrayBuffer();
  store.addAudioChunk(attemptId, buffer);
  store.updateAttempt(attemptId, { analysisStatus: "uploading" });

  return NextResponse.json({ ok: true });
}
