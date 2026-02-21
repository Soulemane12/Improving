"use client";

import { useRef, useEffect } from "react";

interface WaveformVisualizerProps {
  dataArray: Uint8Array | null;
  isActive: boolean;
  isSpeaking: boolean;
}

export function WaveformVisualizer({
  dataArray,
  isActive,
  isSpeaking,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataArray) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isActive
      ? isSpeaking
        ? "#4ade80" // green when speaking
        : "#a3a3a3" // neutral when silent
      : "#525252"; // dim when inactive

    ctx.beginPath();

    const sliceWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [dataArray, isActive, isSpeaking]);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full h-20 rounded-lg bg-neutral-950 border border-neutral-800"
      />
      {/* Speaking indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isActive && isSpeaking ? "bg-green-400" : "bg-neutral-600"
          }`}
        />
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
          {isActive ? (isSpeaking ? "speaking" : "listening") : "inactive"}
        </span>
      </div>
    </div>
  );
}
