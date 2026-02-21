-- Voice Coach Analytics Pipeline
-- Run this in Supabase SQL Editor or via `supabase db push`

-- ─── Sessions ────────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id TEXT,
  scenario_id TEXT NOT NULL,
  target_duration_sec INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Attempts ────────────────────────────────────────────────────────────────

CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id),
  run_number INTEGER NOT NULL,
  duration_sec REAL,
  analysis_status TEXT NOT NULL DEFAULT 'recording',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_session ON attempts(session_id);

-- ─── Attempt Metrics (flat columns for dbt) ─────────────────────────────────

CREATE TABLE attempt_metrics (
  attempt_id UUID PRIMARY KEY REFERENCES attempts(id),
  overall_score REAL NOT NULL,
  pacing_score REAL NOT NULL,
  confidence_score REAL NOT NULL,
  clarity_score REAL NOT NULL,
  timing_compliance_score REAL NOT NULL,
  hook_strength_score REAL NOT NULL,
  cta_strength_score REAL NOT NULL,
  filler_rate_per_min REAL NOT NULL,
  stress_index REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Voice Signal Events ────────────────────────────────────────────────────

CREATE TABLE voice_signal_events (
  id UUID PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES attempts(id),
  session_id UUID NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  t_start_ms INTEGER NOT NULL,
  t_end_ms INTEGER,
  score REAL,
  note TEXT,
  provider TEXT NOT NULL DEFAULT 'modulate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_events_attempt ON voice_signal_events(attempt_id);
CREATE INDEX idx_voice_events_type ON voice_signal_events(signal_type);

-- ─── Coaching Strategies ────────────────────────────────────────────────────

CREATE TABLE coaching_strategies (
  attempt_id UUID PRIMARY KEY REFERENCES attempts(id),
  strategy_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Run Comparisons ────────────────────────────────────────────────────────

CREATE TABLE run_comparisons (
  attempt_id UUID PRIMARY KEY REFERENCES attempts(id),
  previous_attempt_id UUID NOT NULL REFERENCES attempts(id),
  run_number INTEGER NOT NULL,
  summary TEXT NOT NULL,
  improved_count INTEGER NOT NULL,
  declined_count INTEGER NOT NULL,
  stable_count INTEGER NOT NULL,
  pace_delta JSONB NOT NULL,
  clarity_delta JSONB NOT NULL,
  confidence_delta JSONB NOT NULL,
  timing_compliance_delta JSONB NOT NULL,
  filler_rate_delta JSONB NOT NULL,
  hook_strength_delta JSONB NOT NULL,
  cta_strength_delta JSONB NOT NULL,
  stress_index_delta JSONB NOT NULL,
  overall_delta JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
