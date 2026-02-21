"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Summary = {
  attemptsTotal: number;
  completedAttempts: number;
  completionRate: number;
  attemptsWithMetrics: number;
  comparisonCoverageRate: number;
  avgOverallScore: number | null;
  avgPacingScore: number | null;
  avgConfidenceScore: number | null;
  avgClarityScore: number | null;
  avgTimingScore: number | null;
  avgHookScore: number | null;
  avgCtaScore: number | null;
  avgFillerRate: number | null;
  avgStressIndex: number | null;
  lastAttemptAt: string | null;
};

type RecentAttempt = {
  attemptId: string;
  sessionId: string;
  runNumber: number;
  createdAt: string;
  analysisStatus: string;
  durationSec: number | null;
  scenarioId: string;
  targetDurationSec: number;
  strategyId: string;
  strategyLabel: string;
  overallScore: number | null;
  pacingScore: number | null;
  confidenceScore: number | null;
  clarityScore: number | null;
  timingComplianceScore: number | null;
  hookStrengthScore: number | null;
  ctaStrengthScore: number | null;
  fillerRatePerMin: number | null;
  stressIndex: number | null;
  improvedCount: number | null;
  declinedCount: number | null;
  stableCount: number | null;
  comparisonOutcome: "improved" | "declined" | "stable" | "not_compared";
  overallDelta: number | null;
};

type StrategyPerformance = {
  strategyId: string;
  strategyLabel: string;
  attempts: number;
  attemptsWithComparison: number;
  strategyWinRate: number | null;
  avgOverallScore: number | null;
  avgPacingScore: number | null;
  avgConfidenceScore: number | null;
  avgClarityScore: number | null;
  avgNetImprovedCount: number | null;
  avgOverallDelta: number | null;
};

type TrendPoint = {
  label: string;
  createdAt: string;
  runNumber: number;
  overallScore: number | null;
  pacingScore: number | null;
  confidenceScore: number | null;
  clarityScore: number | null;
};

type SessionSummary = {
  sessionId: string;
  scenarioId: string;
  targetDurationSec: number;
  attemptsCount: number;
  completedAttempts: number;
  firstAttemptAt: string;
  latestAttemptAt: string;
  avgOverallScore: number | null;
  avgPacingScore: number | null;
  avgConfidenceScore: number | null;
  avgClarityScore: number | null;
  trend: TrendPoint[];
  attempts: RecentAttempt[];
};

type DashboardPayload = {
  generatedAt: string;
  summary: Summary;
  recentAttempts: RecentAttempt[];
  strategyPerformance: StrategyPerformance[];
  attemptTrend: TrendPoint[];
  sessions: SessionSummary[];
  newestSession: SessionSummary | null;
};

function formatMaybe(value: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  if (!id) return "-";
  return id.slice(0, 8);
}

function Sparkline({ values }: { values: Array<number | null> }) {
  const series = values.filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (series.length === 0) return <span className="text-neutral-500">-</span>;

  const width = 140;
  const height = 36;
  const pad = 2;

  if (series.length === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <circle cx={width / 2} cy={height / 2} r="3" fill="rgb(255,255,255)" />
      </svg>
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const points = series
    .map((value, i) => {
      const x = pad + (i / (series.length - 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke="rgb(255,255,255)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Failed to load dashboard data.");
      }
      const payload = (await res.json()) as DashboardPayload;
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    const interval = setInterval(() => {
      void fetchDashboard();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const overallTrend = useMemo(
    () => data?.attemptTrend.map((point) => point.overallScore ?? null) ?? [],
    [data]
  );
  const pacingTrend = useMemo(
    () => data?.attemptTrend.map((point) => point.pacingScore ?? null) ?? [],
    [data]
  );
  const confidenceTrend = useMemo(
    () => data?.attemptTrend.map((point) => point.confidenceScore ?? null) ?? [],
    [data]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <p className="text-sm text-neutral-400">Loading dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Dashboard unavailable</h1>
          <p className="text-sm text-neutral-400 mb-4">
            {error || "No data available."}
          </p>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const newestSession = data.newestSession;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Live Dashboard (Localhost)</h1>
            <p className="text-xs text-neutral-500">
              Auto-refresh every 15s • Last sync {formatDateTime(data.generatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchDashboard()}
              className="px-3 py-1.5 rounded-md border border-neutral-700 text-xs hover:border-neutral-500"
            >
              Refresh now
            </button>
            <Link
              href="/practice"
              className="text-sm text-neutral-300 hover:text-white"
            >
              Practice
            </Link>
            <Link href="/" className="text-sm text-neutral-300 hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
        {error ? (
          <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Partial error: {error}
          </div>
        ) : null}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
              Attempts
            </p>
            <p className="text-2xl font-bold">{s.attemptsTotal}</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
              Completed
            </p>
            <p className="text-2xl font-bold">{s.completedAttempts}</p>
            <p className="text-xs text-neutral-500">
              {formatPercent(s.completionRate)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
              Avg Overall
            </p>
            <p className="text-2xl font-bold">{formatMaybe(s.avgOverallScore, 1)}</p>
            <p className="text-xs text-neutral-500">/100</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
              Comparison Coverage
            </p>
            <p className="text-2xl font-bold">
              {formatPercent(s.comparisonCoverageRate)}
            </p>
            <p className="text-xs text-neutral-500">
              {s.attemptsWithMetrics} attempts with metrics
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-2">Overall Trend (All Attempts)</p>
            <Sparkline values={overallTrend} />
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-2">Pacing Trend (All Attempts)</p>
            <Sparkline values={pacingTrend} />
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-2">
              Confidence Trend (All Attempts)
            </p>
            <Sparkline values={confidenceTrend} />
          </div>
        </section>

        <section className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="text-sm font-medium">Newest Session</h2>
          </div>
          {newestSession ? (
            <div className="p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Session
                  </p>
                  <p className="text-sm font-semibold">{shortId(newestSession.sessionId)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Scenario
                  </p>
                  <p className="text-sm">{newestSession.scenarioId}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Attempts
                  </p>
                  <p className="text-sm">{newestSession.attemptsCount}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Avg Overall
                  </p>
                  <p className="text-sm">{formatMaybe(newestSession.avgOverallScore, 1)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Last Run
                  </p>
                  <p className="text-sm">{formatDateTime(newestSession.latestAttemptAt)}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/70">
                <p className="text-xs text-neutral-400 mb-2">
                  Newest Session Trend (run-by-run overall)
                </p>
                <Sparkline
                  values={newestSession.trend.map((point) => point.overallScore)}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-950 text-neutral-400">
                    <tr>
                      <th className="text-left px-3 py-2">Run</th>
                      <th className="text-left px-3 py-2">Time</th>
                      <th className="text-left px-3 py-2">Overall</th>
                      <th className="text-left px-3 py-2">Pacing</th>
                      <th className="text-left px-3 py-2">Confidence</th>
                      <th className="text-left px-3 py-2">Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newestSession.attempts.map((attempt) => (
                      <tr key={attempt.attemptId} className="border-t border-neutral-800">
                        <td className="px-3 py-2">#{attempt.runNumber}</td>
                        <td className="px-3 py-2">{formatDateTime(attempt.createdAt)}</td>
                        <td className="px-3 py-2">{formatMaybe(attempt.overallScore, 1)}</td>
                        <td className="px-3 py-2">{formatMaybe(attempt.pacingScore, 1)}</td>
                        <td className="px-3 py-2">{formatMaybe(attempt.confidenceScore, 1)}</td>
                        <td className="px-3 py-2">{attempt.strategyLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-neutral-400">No sessions yet.</div>
          )}
        </section>

        <section className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="text-sm font-medium">All Sessions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950 text-neutral-400">
                <tr>
                  <th className="text-left px-4 py-2">Session</th>
                  <th className="text-left px-4 py-2">Scenario</th>
                  <th className="text-left px-4 py-2">Attempts</th>
                  <th className="text-left px-4 py-2">Avg Overall</th>
                  <th className="text-left px-4 py-2">First Attempt</th>
                  <th className="text-left px-4 py-2">Latest Attempt</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.sessionId} className="border-t border-neutral-800">
                    <td className="px-4 py-2">{shortId(session.sessionId)}</td>
                    <td className="px-4 py-2">{session.scenarioId}</td>
                    <td className="px-4 py-2">{session.attemptsCount}</td>
                    <td className="px-4 py-2">{formatMaybe(session.avgOverallScore, 1)}</td>
                    <td className="px-4 py-2">{formatDateTime(session.firstAttemptAt)}</td>
                    <td className="px-4 py-2">{formatDateTime(session.latestAttemptAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="text-sm font-medium">Recent Attempts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950 text-neutral-400">
                <tr>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Session</th>
                  <th className="text-left px-4 py-2">Run</th>
                  <th className="text-left px-4 py-2">Overall</th>
                  <th className="text-left px-4 py-2">Pacing</th>
                  <th className="text-left px-4 py-2">Confidence</th>
                  <th className="text-left px-4 py-2">Strategy</th>
                  <th className="text-left px-4 py-2">Comparison</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAttempts.slice(0, 20).map((row) => (
                  <tr key={row.attemptId} className="border-t border-neutral-800">
                    <td className="px-4 py-2">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-2">{shortId(row.sessionId)}</td>
                    <td className="px-4 py-2">#{row.runNumber}</td>
                    <td className="px-4 py-2">{formatMaybe(row.overallScore, 1)}</td>
                    <td className="px-4 py-2">{formatMaybe(row.pacingScore, 1)}</td>
                    <td className="px-4 py-2">{formatMaybe(row.confidenceScore, 1)}</td>
                    <td className="px-4 py-2">{row.strategyLabel}</td>
                    <td className="px-4 py-2 capitalize">{row.comparisonOutcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800">
            <h2 className="text-sm font-medium">Strategy Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950 text-neutral-400">
                <tr>
                  <th className="text-left px-4 py-2">Strategy</th>
                  <th className="text-left px-4 py-2">Attempts</th>
                  <th className="text-left px-4 py-2">Win Rate</th>
                  <th className="text-left px-4 py-2">Avg Overall</th>
                  <th className="text-left px-4 py-2">Avg Net Improved</th>
                  <th className="text-left px-4 py-2">Avg Overall Delta</th>
                </tr>
              </thead>
              <tbody>
                {data.strategyPerformance.map((row) => (
                  <tr key={row.strategyId} className="border-t border-neutral-800">
                    <td className="px-4 py-2">{row.strategyLabel}</td>
                    <td className="px-4 py-2">{row.attempts}</td>
                    <td className="px-4 py-2">{formatPercent(row.strategyWinRate)}</td>
                    <td className="px-4 py-2">{formatMaybe(row.avgOverallScore, 1)}</td>
                    <td className="px-4 py-2">{formatMaybe(row.avgNetImprovedCount, 2)}</td>
                    <td className="px-4 py-2">{formatMaybe(row.avgOverallDelta, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
