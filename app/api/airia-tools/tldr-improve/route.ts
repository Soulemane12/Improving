import { NextRequest, NextResponse } from "next/server";

type Metrics = {
  overall_score?: number | null;
  pacing_score?: number | null;
  confidence_score?: number | null;
  clarity_score?: number | null;
  timing_compliance_score?: number | null;
  hook_strength_score?: number | null;
  cta_strength_score?: number | null;
  filler_rate_per_min?: number | null;
  stress_index?: number | null;
};

type Issue = {
  issue: string;
  why_it_hurts: string;
  fix: string;
  priority: number;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeMetrics(raw: unknown): Metrics {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    overall_score: asNumber(data.overall_score ?? data.overallScore),
    pacing_score: asNumber(data.pacing_score ?? data.pacingScore),
    confidence_score: asNumber(data.confidence_score ?? data.confidenceScore),
    clarity_score: asNumber(data.clarity_score ?? data.clarityScore),
    timing_compliance_score: asNumber(
      data.timing_compliance_score ?? data.timingComplianceScore
    ),
    hook_strength_score: asNumber(
      data.hook_strength_score ?? data.hookStrengthScore
    ),
    cta_strength_score: asNumber(data.cta_strength_score ?? data.ctaStrengthScore),
    filler_rate_per_min: asNumber(
      data.filler_rate_per_min ?? data.fillerRatePerMin
    ),
    stress_index: asNumber(data.stress_index ?? data.stressIndex),
  };
}

function buildIssues(metrics: Metrics): Issue[] {
  const issues: Issue[] = [];

  if ((metrics.hook_strength_score ?? 100) < 78) {
    const score = metrics.hook_strength_score ?? 0;
    issues.push({
      issue: "Hook is not punchy enough",
      why_it_hurts:
        "The first 5 seconds are not creating urgency or curiosity, so attention drops early.",
      fix: "Open with one concrete number/stat and one clear benefit in the first sentence.",
      priority: 100 - score,
    });
  }

  if ((metrics.clarity_score ?? 100) < 82) {
    const score = metrics.clarity_score ?? 0;
    issues.push({
      issue: "Message clarity is inconsistent",
      why_it_hurts: "Long or vague phrasing makes the value proposition harder to follow.",
      fix: "Use shorter sentences and a simple 3-part flow: market, plan, expected outcome.",
      priority: 95 - score,
    });
  }

  if ((metrics.pacing_score ?? 100) < 84) {
    const score = metrics.pacing_score ?? 0;
    issues.push({
      issue: "Pacing spikes too fast in places",
      why_it_hurts:
        "Fast bursts reduce comprehension and can lower perceived confidence.",
      fix: "Insert a micro-pause after each key claim and slow down transitions by 10-15%.",
      priority: 92 - score,
    });
  }

  if ((metrics.filler_rate_per_min ?? 0) > 3.2) {
    const filler = metrics.filler_rate_per_min ?? 0;
    issues.push({
      issue: "Too many filler words",
      why_it_hurts:
        "Filler words reduce authority and weaken client trust in key moments.",
      fix: "Replace filler moments with silent pauses; rehearse key transition phrases.",
      priority: Math.min(30, filler * 5),
    });
  }

  if ((metrics.confidence_score ?? 100) < 84) {
    const score = metrics.confidence_score ?? 0;
    issues.push({
      issue: "Confidence level is below target",
      why_it_hurts: "Hesitation lowers credibility and weakens your closing ask.",
      fix: "Emphasize outcomes with direct language and end each section with a decisive line.",
      priority: 90 - score,
    });
  }

  if ((metrics.timing_compliance_score ?? 100) < 95) {
    issues.push({
      issue: "Timing drift from target",
      why_it_hurts:
        "Running too short or long hurts delivery rhythm and structure balance.",
      fix: "Aim for 3 blocks of ~20 seconds each: hook, strategy, CTA.",
      priority: 8,
    });
  }

  if ((metrics.stress_index ?? 0) > 0.25) {
    issues.push({
      issue: "Stress signals are elevated",
      why_it_hurts:
        "Tension can flatten tone and make transitions feel rushed or uncertain.",
      fix: "Before speaking, do one breath cycle (4 in / 6 out) and start 5% slower.",
      priority: Math.round((metrics.stress_index ?? 0) * 20),
    });
  }

  return issues.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

function buildRevisedOpening(): string {
  return "In the last 30 days, homes like yours that launched with precision pricing and targeted marketing moved faster and with stronger offers. My plan is simple: we price to attract day-one demand, market aggressively across channels that produce qualified buyers, and create negotiation leverage before week one ends. If we execute this correctly, you keep control of terms while maximizing final value.";
}

function buildDrills(issues: Issue[]) {
  const drills = [
    {
      name: "Hook Repetition Drill",
      instruction:
        "Record 5 versions of your first sentence, each with one concrete number and one client benefit.",
      duration_sec: 120,
    },
    {
      name: "Pace + Pause Ladder",
      instruction:
        "Read your opener in 3 blocks and insert a 1-second pause after each key claim.",
      duration_sec: 180,
    },
  ];

  if (issues.some((issue) => issue.issue.toLowerCase().includes("filler"))) {
    drills[1] = {
      name: "Filler Elimination Drill",
      instruction:
        "Deliver the opener at 85% speed and replace every filler impulse with silence.",
      duration_sec: 180,
    };
  }

  return drills;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestId = (body.request_id as string | undefined) ?? null;
  const transcript = (body.transcript as Record<string, unknown> | undefined) ?? {};
  const fullText = (transcript.full_text as string | undefined)?.trim() ?? "";
  const metrics = normalizeMetrics(body.metrics);

  if (!fullText && metrics.overall_score == null) {
    return NextResponse.json(
      {
        request_id: requestId,
        status: "error",
        message:
          "Missing transcript.full_text or metrics. Provide at least one to generate coaching TLDR.",
      },
      { status: 400 }
    );
  }

  const issues = buildIssues(metrics);
  const drills = buildDrills(issues);
  const tldr =
    issues.length > 0
      ? `Focus on ${issues[0].issue.toLowerCase()} first, then tighten structure and delivery consistency.`
      : "Solid baseline. Focus on polishing hook specificity and maintaining consistent pace.";

  return NextResponse.json({
    request_id: requestId,
    status: "ok",
    tldr,
    top_issues: issues.map(({ issue, why_it_hurts, fix }) => ({
      issue,
      why_it_hurts,
      fix,
    })),
    revised_opening: buildRevisedOpening(),
    drills,
    next_focus:
      issues[0]?.issue ??
      "General refinement: sharper hook + cleaner transitions + stronger CTA",
    input_echo: {
      scenario_id: body.scenario_id ?? null,
      target_duration_sec: body.target_duration_sec ?? null,
      transcript_chars: fullText.length,
      metrics,
    },
  });
}
