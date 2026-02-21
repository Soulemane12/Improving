import type { SSEMessage } from "@/types";

type Listener = (message: SSEMessage) => void;

// Per-session listener sets
const listeners = new Map<string, Set<Listener>>();

/** Subscribe to events for a session. Returns an unsubscribe function. */
export function subscribe(
  sessionId: string,
  listener: Listener
): () => void {
  if (!listeners.has(sessionId)) {
    listeners.set(sessionId, new Set());
  }
  listeners.get(sessionId)!.add(listener);

  return () => {
    const set = listeners.get(sessionId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) listeners.delete(sessionId);
    }
  };
}

/** Publish an event to all listeners for a session. */
export function publish(sessionId: string, message: SSEMessage): void {
  const set = listeners.get(sessionId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(message);
    } catch {
      // Don't let one bad listener break others
    }
  }
}
