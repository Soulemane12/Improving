import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { PracticeSession } from "@/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { scenarioId, targetDurationSec, userId } = body as {
    scenarioId?: string;
    targetDurationSec?: number;
    userId?: string;
  };

  const session: PracticeSession = {
    id: crypto.randomUUID(),
    userId,
    scenarioId: scenarioId ?? "default",
    targetDurationSec: targetDurationSec ?? 60,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  store.createSession(session);

  return NextResponse.json({ sessionId: session.id, session });
}
