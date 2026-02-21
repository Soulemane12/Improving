import { useSyncExternalStore, useCallback } from "react";
import type { SavedRun, RunHistory } from "@/types";

const STORAGE_KEY = "voice-coach-run-history";

// In-memory snapshot for useSyncExternalStore
let snapshot: RunHistory = { runs: [] };
let listeners: Array<() => void> = [];

function notify(): void {
  for (const listener of listeners) listener();
}

function readFromStorage(): RunHistory {
  if (typeof window === "undefined") return { runs: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { runs: [] };
    const parsed = JSON.parse(raw) as RunHistory;
    if (!Array.isArray(parsed.runs)) return { runs: [] };
    return parsed;
  } catch {
    return { runs: [] };
  }
}

function writeToStorage(history: RunHistory): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage full or blocked — silently ignore
  }
}

// Hydrate on load
if (typeof window !== "undefined") {
  snapshot = readFromStorage();
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): RunHistory {
  return snapshot;
}

const SERVER_SNAPSHOT: RunHistory = { runs: [] };

function getServerSnapshot(): RunHistory {
  return SERVER_SNAPSHOT;
}

export function saveRun(run: SavedRun): void {
  const current = readFromStorage();
  if (current.runs.some((r) => r.attemptId === run.attemptId)) return;
  current.runs.push(run);
  writeToStorage(current);
  snapshot = current;
  notify();
}

export function getRuns(): SavedRun[] {
  return readFromStorage().runs;
}

export function getRunCount(): number {
  return readFromStorage().runs.length;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  snapshot = { runs: [] };
  notify();
}

/**
 * React hook that subscribes to run history via useSyncExternalStore.
 * No setState-in-effect needed.
 */
export function useRunHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const save = useCallback((run: SavedRun) => {
    saveRun(run);
  }, []);

  const clear = useCallback(() => {
    clearHistory();
  }, []);

  return {
    runs: history.runs,
    runCount: history.runs.length,
    saveRun: save,
    clearHistory: clear,
  };
}
