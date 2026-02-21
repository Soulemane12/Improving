"use client";

import { useEffect, useRef, useReducer, useCallback } from "react";
import type {
  AnalysisStatus,
  VoiceSignalEvent,
  Transcript,
  AttemptMetrics,
  CoachingStrategyResult,
  RunComparison,
  SSEMessage,
  OpeningCoachAnalysisResponse,
} from "@/types";

interface AnalysisState {
  status: AnalysisStatus;
  events: VoiceSignalEvent[];
  transcript: Transcript | null;
  metrics: AttemptMetrics | null;
  strategy: CoachingStrategyResult | null;
  comparison: RunComparison | null;
  coachingSentence: string | null;
  connected: boolean;
  error: string | null;
}

type Action =
  | { type: "STATUS_CHANGE"; status: AnalysisStatus }
  | { type: "VOICE_EVENT"; event: VoiceSignalEvent }
  | { type: "TRANSCRIPT"; transcript: Transcript }
  | { type: "METRICS"; metrics: AttemptMetrics }
  | { type: "STRATEGY"; strategy: CoachingStrategyResult }
  | { type: "COMPARISON"; comparison: RunComparison }
  | { type: "COACHING_SENTENCE"; coachingSentence: string }
  | { type: "HYDRATE"; snapshot: OpeningCoachAnalysisResponse }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "ERROR"; error: string }
  | { type: "CLEAR" }
  | { type: "RESET" };

const initialState: AnalysisState = {
  status: "recording",
  events: [],
  transcript: null,
  metrics: null,
  strategy: null,
  comparison: null,
  coachingSentence: null,
  connected: false,
  error: null,
};

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case "STATUS_CHANGE":
      return { ...state, status: action.status };
    case "VOICE_EVENT":
      // Idempotent: don't duplicate events
      if (state.events.some((e) => e.id === action.event.id)) return state;
      return {
        ...state,
        events: [...state.events, action.event].sort(
          (a, b) => a.tStartMs - b.tStartMs
        ),
      };
    case "TRANSCRIPT":
      return { ...state, transcript: action.transcript };
    case "METRICS":
      return { ...state, metrics: action.metrics };
    case "STRATEGY":
      return { ...state, strategy: action.strategy };
    case "COMPARISON":
      return { ...state, comparison: action.comparison };
    case "COACHING_SENTENCE":
      return { ...state, coachingSentence: action.coachingSentence };
    case "HYDRATE":
      return {
        ...state,
        status: action.snapshot.status,
        events: action.snapshot.voiceSignals.map((signal) => ({
          id: signal.id,
          provider: "modulate",
          sessionId: action.snapshot.sessionId,
          attemptId: action.snapshot.attemptId,
          tStartMs: signal.tStartMs,
          tEndMs: signal.tEndMs,
          type: signal.type,
          severity: signal.severity,
          score: signal.score,
          note: signal.note,
        })),
        transcript: action.snapshot.transcript
          ? {
              fullText: action.snapshot.transcript.fullText,
              segments: action.snapshot.transcript.segments.map((segment) => ({
                ...segment,
                speaker: undefined,
              })),
            }
          : null,
        metrics: action.snapshot.metrics ?? null,
        strategy: action.snapshot.strategy ?? null,
        comparison: action.snapshot.comparison ?? null,
        coachingSentence: action.snapshot.coachingSentence ?? null,
      };
    case "CONNECTED":
      return { ...state, connected: true, error: null };
    case "DISCONNECTED":
      return { ...state, connected: false };
    case "ERROR":
      return { ...state, error: action.error };
    case "CLEAR":
      return {
        ...state,
        status: "recording",
        events: [],
        transcript: null,
        metrics: null,
        strategy: null,
        comparison: null,
        coachingSentence: null,
        error: null,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function useAnalysisStream(sessionId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // Close existing connection
    eventSourceRef.current?.close();

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      dispatch({ type: "CONNECTED" });
      void (async () => {
        try {
          const snapshotRes = await fetch(`/api/sessions/${sessionId}/results`, {
            cache: "no-store",
          });
          if (!snapshotRes.ok) return;
          const snapshot =
            (await snapshotRes.json()) as OpeningCoachAnalysisResponse;
          dispatch({ type: "HYDRATE", snapshot });
        } catch {
          // Best-effort hydration, SSE remains primary transport.
        }
      })();
    };

    es.onmessage = (e) => {
      try {
        const message: SSEMessage = JSON.parse(e.data);

        switch (message.type) {
          case "status_change": {
            const payload = message.payload as { status: AnalysisStatus };
            dispatch({ type: "STATUS_CHANGE", status: payload.status });
            break;
          }
          case "voice_event":
            dispatch({
              type: "VOICE_EVENT",
              event: message.payload as VoiceSignalEvent,
            });
            break;
          case "transcript":
            dispatch({
              type: "TRANSCRIPT",
              transcript: message.payload as Transcript,
            });
            break;
          case "metrics":
            dispatch({
              type: "METRICS",
              metrics: message.payload as AttemptMetrics,
            });
            break;
          case "strategy":
            dispatch({
              type: "STRATEGY",
              strategy: message.payload as CoachingStrategyResult,
            });
            break;
          case "comparison":
            dispatch({
              type: "COMPARISON",
              comparison: message.payload as RunComparison,
            });
            break;
          case "coaching_sentence":
            dispatch({
              type: "COACHING_SENTENCE",
              coachingSentence: String(
                (message.payload as { sentence?: string })?.sentence ?? ""
              ),
            });
            break;
        }
      } catch (err) {
        console.error("Failed to parse SSE message:", err);
      }
    };

    es.onerror = () => {
      dispatch({ type: "DISCONNECTED" });
      // Auto-reconnect after 2s (EventSource reconnects automatically,
      // but we track the state)
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          dispatch({ type: "ERROR", error: "Connection lost, reconnecting..." });
        }
      }, 2000);
    };
  }, [sessionId]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    dispatch({ type: "DISCONNECTED" });
  }, []);

  const reset = useCallback(() => {
    // Clear analysis state between runs but keep the current SSE connection.
    // This is required when reusing the same session ID across attempts.
    dispatch({ type: "CLEAR" });
  }, []);

  // Auto-connect when sessionId changes
  useEffect(() => {
    if (sessionId) {
      connect();
    }
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, connect]);

  return {
    ...state,
    connect,
    disconnect,
    reset,
  };
}
