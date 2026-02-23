export type MissionChoice = {
  label: string;
  isCorrect: boolean;
  feedback: string;
};

export type MissionStep = {
  title: string;
  challenge: string;
  choices: MissionChoice[];
  correctAction: string;
  outcome: string;
  hint?: string;
};

export type Mission = {
  id: string;
  planetId: string;
  title: string;
  briefing: string;
  scenario: string;
  steps: MissionStep[];
  outcome: string;
  copilotPrompt: string;
};

export const MISSIONS: Mission[] = [
  {
    id: "obviant-mission",
    planetId: "obviant",
    title: "Mission: Contract Signal Fusion",
    briefing:
      "Connect fragmented government contracting and budget data so operators can make decisions from one reliable picture.",
    scenario:
      "Contract awards, modifications, and agency budget lines all exist in different systems with mismatched identifiers and reporting delays.",
    steps: [
      {
        title: "Create A Canonical Join Layer",
        challenge:
          "The same vendor and contract appear differently across procurement and budget datasets, making direct joins unreliable.",
        choices: [
          {
            label:
              "Build a canonical key model with normalized vendor, contract, and agency IDs plus confidence scoring.",
            isCorrect: true,
            feedback:
              "Correct. A canonical model plus confidence keeps links explainable while handling real-world identifier drift.",
          },
          {
            label:
              "Keep datasets separate and ask analysts to manually reconcile differences during reporting.",
            isCorrect: false,
            feedback:
              "Manual reconciliation does not scale and guarantees inconsistent answers under time pressure.",
          },
          {
            label:
              "Require exact contract-number matches and drop rows that do not align perfectly.",
            isCorrect: false,
            feedback:
              "Exact-only matching discards high-value records where format differences are the main issue.",
          },
        ],
        correctAction:
          "Implemented a canonical crosswalk service that maps source identifiers into a shared contract entity with provenance metadata.",
        outcome:
          "Cross-source joins became reliable enough for automation while still exposing confidence and source traceability.",
        hint: "Think about preserving imperfect matches safely instead of choosing manual review or strict drops.",
      },
      {
        title: "Flag Budget-Contract Drift",
        challenge:
          "Spending obligations and budget plans diverge over time, but the team needs early warning before it becomes a delivery risk.",
        choices: [
          {
            label:
              "Track obligation-to-plan deltas by fiscal period and alert on sustained variance with contextual tags.",
            isCorrect: true,
            feedback:
              "Correct. Drift over time is a stronger signal than one-off transactions and supports better operational response.",
          },
          {
            label:
              "Trigger alerts only when a single transaction exceeds a fixed dollar amount.",
            isCorrect: false,
            feedback:
              "Large one-off values are noisy and miss cumulative drift patterns across many smaller transactions.",
          },
          {
            label:
              "Skip anomaly detection and rely on quarterly reviews from procurement teams.",
            isCorrect: false,
            feedback:
              "Quarterly review cadence is too slow for active contract execution decisions.",
          },
        ],
        correctAction:
          "Built period-over-period variance scoring with mission tags, then surfaced alerts only when drift persisted beyond configurable thresholds.",
        outcome:
          "Teams could prioritize investigations earlier and avoid late-cycle surprises in contract execution.",
        hint: "A single threshold on transaction size is weaker than trend-aware variance detection.",
      },
      {
        title: "Deliver Explainable Operational Views",
        challenge:
          "Decision-makers need to inspect how a budget line ties back to a contract event without wading through raw tables.",
        choices: [
          {
            label:
              "Expose a cross-reference API with drill-through provenance from budget line to contract actions.",
            isCorrect: true,
            feedback:
              "Correct. Explainable drill-through builds trust and speeds up decision-making across mixed technical audiences.",
          },
          {
            label:
              "Ship nightly CSV exports and let each team build local pivot-table workflows.",
            isCorrect: false,
            feedback:
              "CSV handoffs fragment logic and quickly diverge from the source of truth.",
          },
          {
            label:
              "Hide uncertain links entirely so the dashboard only shows 100% confidence joins.",
            isCorrect: false,
            feedback:
              "Suppressing uncertainty makes the system look cleaner but removes crucial operational context.",
          },
        ],
        correctAction:
          "Delivered a mission-facing data layer that returns linked budget and contract entities with confidence and source lineage for every relationship.",
        outcome:
          "Stakeholders could move from static reporting to interactive investigation with traceable evidence.",
        hint: "The best answer gives transparency into both the link and the evidence behind it.",
      },
    ],
    outcome:
      "Obviant teams gained a unified, explainable data view across contracting and budget systems, enabling faster and more confident decisions.",
    copilotPrompt:
      "Focus on data integration strategy, explainability, and operational risk control in government contracting contexts.",
  },
  {
    id: "aws-mission",
    planetId: "aws",
    title: "Mission: Dashboard Performance Recovery",
    briefing:
      "Bring accessibility and reporting dashboards from multi-second latency to near-instant responses.",
    scenario:
      "Teams could not triage accessibility regressions quickly because dashboard queries were too slow.",
    steps: [
      {
        title: "Trace Critical Paths",
        challenge:
          "Latency came from multiple layers, and optimization efforts were scattered.",
        choices: [
          {
            label:
              "Profile real user flows first, then rank query and hydration bottlenecks by impact.",
            isCorrect: true,
            feedback:
              "Correct. Prioritizing by measured user-path impact prevents low-value tuning work.",
          },
          {
            label:
              "Rewrite all dashboard components before collecting performance traces.",
            isCorrect: false,
            feedback:
              "Rewrites without traces are expensive and often miss the dominant bottleneck.",
          },
          {
            label:
              "Scale backend instances immediately and revisit frontend performance later.",
            isCorrect: false,
            feedback:
              "Capacity increases can hide symptoms but do not solve inefficient data flow and rendering.",
          },
        ],
        correctAction:
          "Captured end-to-end traces for the highest-traffic flows and isolated query shape plus hydration costs as the top latency drivers.",
        outcome:
          "Optimization work was focused on a short list of high-impact bottlenecks.",
        hint: "Find where users actually wait before deciding where to optimize.",
      },
      {
        title: "Stabilize Query Contracts",
        challenge:
          "Parameter drift between pages caused poor cache reuse and redundant requests.",
        choices: [
          {
            label:
              "Enforce typed query contracts and normalize URL parameter ordering.",
            isCorrect: true,
            feedback:
              "Correct. Stable contracts improve cache hit rate and reduce duplicate fetches.",
          },
          {
            label:
              "Increase cache TTL only, even if request keys remain inconsistent.",
            isCorrect: false,
            feedback:
              "Longer TTL cannot fix key instability and can introduce stale-data issues.",
          },
          {
            label:
              "Disable caching for dynamic pages to avoid key mismatch edge cases.",
            isCorrect: false,
            feedback:
              "Disabling caching removes one of the strongest latency levers for dashboard workloads.",
          },
        ],
        correctAction:
          "Introduced TypeScript-validated query schemas and canonicalized URL state before hitting API boundaries.",
        outcome:
          "Request deduplication improved and cache behavior became predictable across entry points.",
        hint: "Caching only works well when request identity is deterministic.",
      },
      {
        title: "Improve Perceived Responsiveness",
        challenge:
          "Heavy synchronous transforms and large payload rendering still blocked interaction.",
        choices: [
          {
            label:
              "Use selective prefetching, memoized transforms, and chunked rendering for large views.",
            isCorrect: true,
            feedback:
              "Correct. This reduces blocking work and keeps interactions responsive during data-heavy updates.",
          },
          {
            label:
              "Render the entire payload immediately so users never see intermediate states.",
            isCorrect: false,
            feedback:
              "Rendering everything at once maximizes blocking time and hurts interactivity.",
          },
          {
            label:
              "Move all transforms to the backend and return one giant denormalized payload.",
            isCorrect: false,
            feedback:
              "Oversized payloads shift cost rather than reducing it and often worsen time-to-interact.",
          },
        ],
        correctAction:
          "Applied staged rendering and targeted prefetch windows while memoizing expensive transforms in the UI layer.",
        outcome:
          "Median interactions dropped to sub-200ms and dashboards became operationally reliable.",
        hint: "Responsiveness is often about reducing blocking work, not just reducing total work.",
      },
    ],
    outcome:
      "The portal became fast enough for routine usage across dozens of teams and supported broader AWS adoption.",
    copilotPrompt:
      "Focus on practical frontend performance strategy and measurable impact in enterprise systems.",
  },
  {
    id: "riskfuel-mission",
    planetId: "riskfuel",
    title: "Mission: Scale ML Workload Platform",
    briefing:
      "Scale an ML delivery platform to handle high concurrency while keeping deployment confidence high.",
    scenario:
      "Model teams needed to run more experiments and ship faster, but infrastructure orchestration was the bottleneck.",
    steps: [
      {
        title: "Decompose Workflow Stages",
        challenge:
          "Monolithic execution pipelines made failures hard to isolate and retries expensive.",
        choices: [
          {
            label:
              "Split pipelines into composable stages with explicit state transitions and retry points.",
            isCorrect: true,
            feedback:
              "Correct. Stage boundaries enable targeted retries and clearer diagnostics.",
          },
          {
            label:
              "Keep one large workflow and add more timeout/retry wrappers around it.",
            isCorrect: false,
            feedback:
              "Wrapping a monolith still leaves poor fault isolation and expensive retries.",
          },
          {
            label:
              "Run all models in serial order to reduce scheduler complexity.",
            isCorrect: false,
            feedback:
              "Serial execution avoids complexity but destroys throughput and responsiveness.",
          },
        ],
        correctAction:
          "Redesigned job orchestration into stage-level state machines with idempotent checkpoints.",
        outcome:
          "Recovery became faster and operational debugging moved from hours to minutes.",
        hint: "The strongest option improves both retry precision and observability.",
      },
      {
        title: "Handle Cluster Contention",
        challenge:
          "Burst traffic overwhelmed shared resources and queue times became unpredictable.",
        choices: [
          {
            label:
              "Add Kubernetes-aware scheduling with queue priorities and capacity guardrails.",
            isCorrect: true,
            feedback:
              "Correct. Cluster-aware controls smooth burst behavior and protect critical workloads.",
          },
          {
            label:
              "Use first-in-first-out scheduling only and trust workers to auto-balance.",
            isCorrect: false,
            feedback:
              "Pure FIFO ignores workload classes and amplifies tail latency during spikes.",
          },
          {
            label:
              "Disable workload limits so jobs can grab resources as needed.",
            isCorrect: false,
            feedback:
              "Removing limits causes noisy-neighbor failures and lowers platform reliability.",
          },
        ],
        correctAction:
          "Implemented queue stratification and resource quotas tied to workload criticality and cluster headroom.",
        outcome:
          "Throughput stabilized and failure rates dropped during peak usage windows.",
        hint: "Think in terms of fairness plus protection, not unrestricted resource grabs.",
      },
      {
        title: "Make Health Actionable",
        challenge:
          "Teams lacked a shared view of regressions across pipeline stages and environments.",
        choices: [
          {
            label:
              "Expose stage-level metrics and probes with dashboard drill-down and alert thresholds.",
            isCorrect: true,
            feedback:
              "Correct. Fine-grained telemetry turns incidents into fast, targeted remediation.",
          },
          {
            label:
              "Track only final job status to keep monitoring dashboards simple.",
            isCorrect: false,
            feedback:
              "End-state-only monitoring hides where failures emerge and slows response.",
          },
          {
            label:
              "Depend on ad-hoc log searches when users report failed experiments.",
            isCorrect: false,
            feedback:
              "Reactive log hunts create long MTTR and inconsistent incident handling.",
          },
        ],
        correctAction:
          "Rolled out per-stage health probes and Prometheus/Grafana views tied to operational SLO thresholds.",
        outcome:
          "Teams detected regressions earlier and resolved incidents before user-facing impact.",
        hint: "Actionable telemetry must show where degradation starts, not just that it happened.",
      },
    ],
    outcome:
      "The platform supported dramatically higher workload volume with stronger reliability and faster release cadence.",
    copilotPrompt:
      "Focus on distributed systems tradeoffs, Kubernetes operations, and ML platform delivery patterns.",
  },
  {
    id: "early-career-mission",
    planetId: "early-career",
    title: "Mission: Zero-Downtime Data Migration",
    briefing:
      "Migrate production data for an ERP workflow without interrupting field operations.",
    scenario:
      "A schema upgrade was required, but downtime would block dispatch and service management.",
    steps: [
      {
        title: "Prepare Dual-Write Safety",
        challenge:
          "Legacy and target schemas both needed to stay consistent while traffic remained live.",
        choices: [
          {
            label:
              "Introduce a compatibility layer with dual-write and verification logs.",
            isCorrect: true,
            feedback:
              "Correct. Dual-write with verification gives rollback flexibility and consistency checks.",
          },
          {
            label:
              "Freeze writes during migration windows and replay missed changes later.",
            isCorrect: false,
            feedback:
              "Write freezes conflict with zero-downtime requirements and increase operational risk.",
          },
          {
            label:
              "Switch all clients to the new schema immediately, then patch issues in production.",
            isCorrect: false,
            feedback:
              "Big-bang cutovers create a large blast radius and reduce recovery options.",
          },
        ],
        correctAction:
          "Built a compatibility layer that dual-wrote records and logged parity checks across old and new structures.",
        outcome:
          "Both schemas remained synchronized while the system continued serving live traffic.",
        hint: "You need reversibility and verification before any cutover decision.",
      },
      {
        title: "Backfill With Validation Gates",
        challenge:
          "Historical records contained edge-case quality issues that could corrupt the target model.",
        choices: [
          {
            label:
              "Run incremental backfills with reconciliation checks and halt-on-drift thresholds.",
            isCorrect: true,
            feedback:
              "Correct. Incremental gates reduce blast radius and catch anomalies early.",
          },
          {
            label:
              "Bulk migrate all history in one pass to shorten total migration duration.",
            isCorrect: false,
            feedback:
              "A one-shot backfill hides errors until late and makes rollback far harder.",
          },
          {
            label:
              "Skip historical data cleanup and focus only on new records after go-live.",
            isCorrect: false,
            feedback:
              "Ignoring legacy quality debt compromises downstream reporting and trust.",
          },
        ],
        correctAction:
          "Executed phased backfills with automated reconciliation reports and stop conditions for mismatch spikes.",
        outcome:
          "Data quality issues were isolated and corrected before they could impact production behavior.",
        hint: "Safer migration favors controlled batches plus explicit quality gates.",
      },
      {
        title: "Control Cutover And Rollback",
        challenge:
          "The final switch had to be short, measurable, and reversible if metrics degraded.",
        choices: [
          {
            label:
              "Use phased traffic shifting with rollback checkpoints and live health monitors.",
            isCorrect: true,
            feedback:
              "Correct. Progressive cutover keeps risk bounded and preserves fast rollback.",
          },
          {
            label:
              "Perform a full cutover overnight and rely on support escalation if issues appear.",
            isCorrect: false,
            feedback:
              "All-at-once switches trade speed for a much larger recovery burden.",
          },
          {
            label:
              "Keep both databases permanently active with no primary ownership.",
            isCorrect: false,
            feedback:
              "Long-term dual-primary operation increases complexity and consistency risk.",
          },
        ],
        correctAction:
          "Rolled traffic in stages with explicit rollback gates tied to replication lag, error rate, and dispatch throughput.",
        outcome:
          "Migration completed with no production downtime and clear confidence in the new data model.",
        hint: "Choose the path that limits blast radius and keeps rollback quick.",
      },
    ],
    outcome:
      "The migration delivered a cleaner foundation while operations stayed uninterrupted.",
    copilotPrompt:
      "Focus on migration safety patterns, rollback strategy, and pragmatic risk management.",
  },
];

export function getMissionById(missionId: string) {
  return MISSIONS.find((mission) => mission.id === missionId);
}

export function getMissionForPlanet(planetId: string) {
  return MISSIONS.find((mission) => mission.planetId === planetId);
}
