"use client";

import { useRef, useState, useCallback } from "react";
import type { CaptureState } from "@/types";

export function useAudioCapture() {
  const [state, setState] = useState<CaptureState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const start = useCallback(
    async (onChunk?: (chunk: Blob) => Promise<void> | void) => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });

        setStream(mediaStream);

        // MIME fallback
        const mimeType = MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus"
        )
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(mediaStream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = async (e) => {
          if (!e.data || e.data.size === 0) return;
          chunksRef.current.push(e.data);
          if (onChunk) await onChunk(e.data);
        };

        recorder.onerror = () => setState("error");

        recorder.start(1000); // chunk every 1s
        startedAtRef.current = performance.now();
        setState("recording");

        timerRef.current = setInterval(() => {
          setElapsedMs(performance.now() - startedAtRef.current);
        }, 100);
      } catch (err) {
        console.error("Failed to start audio capture:", err);
        setState("error");
      }
    },
    []
  );

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setState("stopped");

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });

        // Stop mic tracks
        setStream((prev) => {
          prev?.getTracks().forEach((t) => t.stop());
          return null;
        });

        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  return {
    state,
    elapsedMs,
    start,
    stop,
    stream,
  };
}
