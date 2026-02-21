"use client";

import type { CoachingStrategyResult } from "@/types";

interface CoachingStrategyProps {
  strategy: CoachingStrategyResult | null;
  loading?: boolean;
}

export function CoachingStrategy({ strategy, loading }: CoachingStrategyProps) {
  if (loading || !strategy) {
    return (
      <div className="p-6 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse">
        <div className="h-3 w-32 bg-neutral-700 rounded mb-4" />
        <div className="h-5 w-48 bg-neutral-700 rounded mb-3" />
        <div className="h-16 w-full bg-neutral-700 rounded mb-3" />
        <div className="h-12 w-full bg-neutral-700 rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl bg-neutral-900 border border-neutral-800">
      <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
        Recommended Next Step
      </div>

      <h3 className="text-lg font-semibold text-white mb-3">
        {strategy.label}
      </h3>

      <p className="text-sm text-neutral-300 leading-relaxed mb-4">
        {strategy.description}
      </p>

      <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
          Why this strategy
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {strategy.reason}
        </p>
      </div>
    </div>
  );
}
