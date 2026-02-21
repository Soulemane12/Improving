"use client";

import Link from "next/link";
import { useRunHistory } from "@/lib/run-history";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type MetricKey =
  | "overallScore"
  | "pacingScore"
  | "confidenceScore"
  | "clarityScore"
  | "timingComplianceScore"
  | "fillerRatePerMin"
  | "hookStrengthScore"
  | "ctaStrengthScore"
  | "stressIndex";

interface MetricConfig {
  key: MetricKey;
  label: string;
  format: "score" | "rate" | "index";
  invertBetter?: boolean; // true = lower is better
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: "overallScore", label: "Overall", format: "score" },
  { key: "pacingScore", label: "Pacing", format: "score" },
  { key: "confidenceScore", label: "Confidence", format: "score" },
  { key: "clarityScore", label: "Clarity", format: "score" },
  { key: "timingComplianceScore", label: "Timing", format: "score" },
  { key: "hookStrengthScore", label: "Hook Strength", format: "score" },
  { key: "ctaStrengthScore", label: "CTA Strength", format: "score" },
  {
    key: "fillerRatePerMin",
    label: "Filler Rate",
    format: "rate",
    invertBetter: true,
  },
  {
    key: "stressIndex",
    label: "Stress Index",
    format: "index",
    invertBetter: true,
  },
];

function formatValue(value: number, format: MetricConfig["format"]): string {
  if (format === "rate") return value.toFixed(1);
  if (format === "index") return value.toFixed(2);
  return String(Math.round(value));
}

function trendColor(
  first: number,
  last: number,
  invertBetter?: boolean
): string {
  const diff = last - first;
  if (Math.abs(diff) < 0.5) return "text-neutral-500";
  const improved = invertBetter ? diff < 0 : diff > 0;
  return improved ? "text-green-400" : "text-red-400";
}

function trendArrow(
  first: number,
  last: number,
  invertBetter?: boolean
): string {
  const diff = last - first;
  if (Math.abs(diff) < 0.5) return "\u2501"; // ━
  const improved = invertBetter ? diff < 0 : diff > 0;
  return improved ? "\u25B2" : "\u25BC"; // ▲ ▼
}

function SparkLine({
  values,
  invertBetter,
}: {
  values: number[];
  invertBetter?: boolean;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 120;
  const height = 32;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastValue = values[values.length - 1];
  const firstValue = values[0];
  const diff = lastValue - firstValue;
  const improved = invertBetter ? diff < 0 : diff > 0;
  const color =
    Math.abs(diff) < 0.5
      ? "rgb(115,115,115)"
      : improved
        ? "rgb(74,222,128)"
        : "rgb(248,113,113)";

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on last point */}
      {(() => {
        const lastX =
          padding +
          ((values.length - 1) / (values.length - 1)) * (width - padding * 2);
        const lastY =
          height -
          padding -
          ((lastValue - min) / range) * (height - padding * 2);
        return <circle cx={lastX} cy={lastY} r="3" fill={color} />;
      })()}
    </svg>
  );
}

export default function DashboardPage() {
  const { runs, clearHistory: handleClearHistory } = useRunHistory();

  const sorted = [...runs].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Trends Dashboard</h1>
            <p className="text-xs text-neutral-500">
              {runs.length} run{runs.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/practice"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Practice
            </Link>
            <Link
              href="/"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
        {runs.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2 text-neutral-300">
              No runs yet
            </h2>
            <p className="text-sm text-neutral-500 mb-6">
              Complete a practice session to see your trends here.
            </p>
            <Link
              href="/practice"
              className="px-6 py-2.5 bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors"
            >
              Start Practicing
            </Link>
          </div>
        ) : (
          <>
            {/* Metric trend cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {METRIC_CONFIGS.map((config) => {
                const values = sorted.map((r) => r.metrics[config.key]);
                const first = values[0];
                const last = values[values.length - 1];

                return (
                  <div
                    key={config.key}
                    className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                        {config.label}
                      </span>
                      {values.length >= 2 && (
                        <span
                          className={`text-xs font-semibold ${trendColor(first, last, config.invertBetter)}`}
                        >
                          {trendArrow(first, last, config.invertBetter)}{" "}
                          {formatValue(
                            Math.abs(last - first),
                            config.format
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <span className="text-2xl font-bold text-white">
                        {formatValue(last, config.format)}
                        {config.format === "score" && (
                          <span className="text-[10px] text-neutral-600 ml-0.5">
                            /100
                          </span>
                        )}
                        {config.format === "rate" && (
                          <span className="text-[10px] text-neutral-600 ml-0.5">
                            /min
                          </span>
                        )}
                      </span>
                      <SparkLine
                        values={values}
                        invertBetter={config.invertBetter}
                      />
                    </div>

                    {values.length >= 2 && (
                      <div className="text-[10px] text-neutral-600 mt-2">
                        Run 1: {formatValue(first, config.format)} → Run{" "}
                        {values.length}: {formatValue(last, config.format)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Run history table */}
            <div className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800">
                <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
                  Run History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left">Run</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-right">Overall</th>
                      <th className="px-4 py-2 text-right">Pace</th>
                      <th className="px-4 py-2 text-right">Confidence</th>
                      <th className="px-4 py-2 text-right">Clarity</th>
                      <th className="px-4 py-2 text-right">Timing</th>
                      <th className="px-4 py-2 text-right">Fillers</th>
                      <th className="px-4 py-2 text-right">Stress</th>
                      <th className="px-4 py-2 text-left">Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((run, idx) => (
                      <tr
                        key={run.attemptId}
                        className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-neutral-300">
                          #{idx + 1}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-400 text-xs">
                          {formatDate(run.completedAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {run.metrics.overallScore}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-300">
                          {run.metrics.pacingScore}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-300">
                          {run.metrics.confidenceScore}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-300">
                          {run.metrics.clarityScore}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-300">
                          {run.metrics.timingComplianceScore}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-300">
                          {run.metrics.fillerRatePerMin.toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-300">
                          {run.metrics.stressIndex.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-400 text-xs">
                          {run.strategy?.label ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Link
                href="/practice"
                className="px-6 py-2.5 bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors text-sm"
              >
                New Practice Run
              </Link>
              <button
                onClick={handleClearHistory}
                className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
              >
                Clear History
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
