"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";

export function useWaveform(stream: MediaStream | null) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [dataArray, setDataArray] = useState<Uint8Array<ArrayBuffer> | null>(null);

  const isActive = useMemo(() => !!stream && !!dataArray, [stream, dataArray]);

  useEffect(() => {
    if (!stream) return;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const buffer = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;
    bufferRef.current = buffer;

    let active = true;

    function tick() {
      if (!active || !analyserRef.current || !bufferRef.current) return;
      analyserRef.current.getByteTimeDomainData(bufferRef.current);
      setDataArray(new Uint8Array(bufferRef.current) as Uint8Array<ArrayBuffer>);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      analyserRef.current = null;
      bufferRef.current = null;
      audioCtx.close();
      // Clear data on cleanup so next render with null stream sees null dataArray
      setDataArray(null);
    };
  }, [stream]);

  const isSpeaking = useCallback((): boolean => {
    if (!dataArray) return false;
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return rms > 0.01;
  }, [dataArray]);

  return { analyserRef, dataArray, isActive, isSpeaking };
}
