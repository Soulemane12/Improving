{{ config(materialized="view") }}

with attempts as (
  select * from {{ source("voice_raw", "attempts") }}
),
sessions as (
  select * from {{ source("voice_raw", "sessions") }}
),
metrics as (
  select * from {{ source("voice_raw", "attempt_metrics") }}
),
strategies as (
  select * from {{ source("voice_raw", "coaching_strategies") }}
),
comparisons as (
  select * from {{ source("voice_raw", "run_comparisons") }}
)

select
  a.id as attempt_id,
  a.session_id,
  s.user_id,
  s.scenario_id,
  s.target_duration_sec,
  case
    when s.target_duration_sec < 45 then 'short'
    when s.target_duration_sec <= 75 then 'standard'
    else 'long'
  end as duration_context,
  a.run_number,
  case
    when a.run_number = 1 then 'run_1'
    when a.run_number between 2 and 3 then 'run_2_3'
    else 'run_4_plus'
  end as run_context,
  a.analysis_status,
  a.created_at as attempt_created_at,
  date_trunc('day', a.created_at)::date as attempt_date,
  date_trunc('week', a.created_at)::date as attempt_week,
  a.duration_sec,

  (a.analysis_status = 'completed') as is_completed,
  case when a.analysis_status = 'completed' then 1 else 0 end as completed_flag,

  m.overall_score,
  m.pacing_score,
  m.confidence_score,
  m.clarity_score,
  m.timing_compliance_score,
  m.hook_strength_score,
  m.cta_strength_score,
  m.filler_rate_per_min,
  m.stress_index,

  coalesce(st.strategy_id, 'unassigned') as strategy_id,
  coalesce(st.label, 'Unassigned') as strategy_label,
  st.description as strategy_description,
  st.reason as strategy_reason,

  (rc.attempt_id is not null) as has_comparison,
  case when rc.attempt_id is not null then 1 else 0 end as compared_flag,
  rc.previous_attempt_id,
  rc.improved_count,
  rc.declined_count,
  rc.stable_count,
  coalesce(rc.improved_count, 0) - coalesce(rc.declined_count, 0) as net_improved_count,
  case
    when rc.improved_count > rc.declined_count then 'improved'
    when rc.declined_count > rc.improved_count then 'declined'
    when rc.attempt_id is not null then 'stable'
    else 'not_compared'
  end as comparison_outcome,
  case when rc.improved_count > rc.declined_count then 1 else 0 end as improved_outcome_flag,

  nullif(rc.overall_delta ->> 'delta', '')::double precision as overall_delta,
  nullif(rc.pace_delta ->> 'delta', '')::double precision as pacing_delta,
  nullif(rc.confidence_delta ->> 'delta', '')::double precision as confidence_delta,
  nullif(rc.clarity_delta ->> 'delta', '')::double precision as clarity_delta,
  nullif(rc.timing_compliance_delta ->> 'delta', '')::double precision as timing_delta,
  nullif(rc.filler_rate_delta ->> 'delta', '')::double precision as filler_rate_delta,
  nullif(rc.hook_strength_delta ->> 'delta', '')::double precision as hook_strength_delta,
  nullif(rc.cta_strength_delta ->> 'delta', '')::double precision as cta_strength_delta,
  nullif(rc.stress_index_delta ->> 'delta', '')::double precision as stress_index_delta
from attempts a
left join sessions s on s.id = a.session_id
left join metrics m on m.attempt_id = a.id
left join strategies st on st.attempt_id = a.id
left join comparisons rc on rc.attempt_id = a.id
