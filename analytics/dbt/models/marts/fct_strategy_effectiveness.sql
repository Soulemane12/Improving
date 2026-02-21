{{ config(materialized="view") }}

with base as (
  select * from {{ ref("fct_voice_attempts") }}
  where strategy_id is not null
),
aggregated as (
  select
    strategy_id,
    strategy_label,
    scenario_id,
    target_duration_sec,
    duration_context,
    run_context,
    attempt_week,
    count(*) as attempts_total,
    sum(completed_flag) as attempts_completed,
    sum(compared_flag) as attempts_with_comparison,
    avg(completed_flag::double precision) as completion_rate,
    avg(compared_flag::double precision) as comparison_coverage_rate,

    avg(overall_score) as avg_overall_score,
    avg(pacing_score) as avg_pacing_score,
    avg(confidence_score) as avg_confidence_score,
    avg(clarity_score) as avg_clarity_score,
    avg(timing_compliance_score) as avg_timing_score,
    avg(hook_strength_score) as avg_hook_strength_score,
    avg(cta_strength_score) as avg_cta_strength_score,
    avg(filler_rate_per_min) as avg_filler_rate_per_min,
    avg(stress_index) as avg_stress_index,

    avg(net_improved_count) filter (where has_comparison) as avg_net_improved_count,
    avg(overall_delta) as avg_overall_delta,
    avg(pacing_delta) as avg_pacing_delta,
    avg(confidence_delta) as avg_confidence_delta,
    avg(clarity_delta) as avg_clarity_delta,
    avg(timing_delta) as avg_timing_delta,
    avg(filler_rate_delta) as avg_filler_rate_delta,
    avg(hook_strength_delta) as avg_hook_strength_delta,
    avg(cta_strength_delta) as avg_cta_strength_delta,
    avg(stress_index_delta) as avg_stress_index_delta,
    avg(improved_outcome_flag::double precision) filter (where has_comparison) as strategy_win_rate
  from base
  group by
    strategy_id,
    strategy_label,
    scenario_id,
    target_duration_sec,
    duration_context,
    run_context,
    attempt_week
)

select
  *,
  (
    coalesce(avg_overall_delta, 0)
    + (2.0 * coalesce(avg_net_improved_count, 0))
    - (3.0 * coalesce(avg_filler_rate_delta, 0))
    - (8.0 * coalesce(avg_stress_index_delta, 0))
  ) as strategy_reward_score
from aggregated
