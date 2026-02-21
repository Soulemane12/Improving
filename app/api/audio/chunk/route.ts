import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const attemptId = formData.get("attemptId") as string | null;
  const chunk = formData.get("chunk") as Blob | null;

  if (!attemptId || !chunk) {
    return NextResponse.json(
      { error: "Missing attemptId or chunk" },
      { status: 400 }
    );
  }

  const attempt = store.getAttempt(attemptId);
  if (!attempt) {
    return NextResponse.json(
      { error: "Attempt not found" },
      { status: 404 }
    );
  }

  const buffer = await chunk.arrayBuffer();
  store.addAudioChunk(attemptId, buffer);

  return NextResponse.json({ ok: true });
}
