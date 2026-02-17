export type MissionStep = {
  title: string;
  challenge: string;
  action: string;
  outcome: string;
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
    title: "Mission: Field-Ready Delivery Pipeline",
    briefing:
      "Stabilize a fast-moving defense workflow where product requirements and operational constraints change weekly.",
    scenario:
      "A new operator workflow needs to move from concept to field trial quickly without compromising reliability.",
    steps: [
      {
        title: "Map Risk Boundaries",
        challenge:
          "The feature crosses frontend, backend, and integration layers with unclear failure ownership.",
        action:
          "Defined service boundaries and explicit failure envelopes before implementation began.",
        outcome:
          "Reduced downstream ambiguity and prevented duplicate fallback logic.",
      },
      {
        title: "Ship Thin Vertical Slice",
        challenge: "Long release cycles delayed feedback from domain experts.",
        action:
          "Delivered a minimal end-to-end path with instrumentation in the first sprint.",
        outcome:
          "Got real operator feedback early and redirected scope before expensive rework.",
      },
      {
        title: "Harden For Operations",
        challenge: "Prototype behavior under stress was inconsistent.",
        action:
          "Added deterministic retries, telemetry dashboards, and release checklists.",
        outcome:
          "Feature graduated to repeatable deployment with observability baked in.",
      },
    ],
    outcome:
      "Delivery became faster without sacrificing confidence: tighter loops, cleaner ownership, and lower operational risk.",
    copilotPrompt:
      "Focus on cross-functional ownership and reliability-first execution in startup defense contexts.",
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
          "Performance issues were spread across rendering, API calls, and query shape.",
        action:
          "Profiled user journeys and isolated the highest-impact query and hydration costs.",
        outcome:
          "Identified the top two bottlenecks responsible for the majority of latency.",
      },
      {
        title: "Type-Safe Query Contracts",
        challenge:
          "Query params drifted between pages and caused cache misses.",
        action:
          "Introduced TypeScript-enforced query parameter contracts and normalized URL state.",
        outcome:
          "Stabilized cache behavior and reduced expensive duplicate fetches.",
      },
      {
        title: "UI and Data Layer Optimization",
        challenge:
          "Large payloads and synchronous rendering blocked interactivity.",
        action:
          "Added selective prefetching, memoized transforms, and chunked rendering.",
        outcome:
          "Median interaction moved to sub-200ms and the tool became operationally usable.",
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
        title: "Workflow Decomposition",
        challenge:
          "Monolithic execution pipelines made retries and diagnostics painful.",
        action:
          "Split workflows into composable stages with explicit state transitions.",
        outcome:
          "Enabled selective retries and significantly faster troubleshooting.",
      },
      {
        title: "Cluster-Aware Scheduling",
        challenge:
          "Workload spikes created resource contention and unpredictable queue times.",
        action: "Added Kubernetes-aware queueing and capacity guardrails.",
        outcome:
          "Improved throughput consistency and lowered failure rates during peak load.",
      },
      {
        title: "Operational Visibility",
        challenge:
          "Teams lacked visibility into model job health and regression patterns.",
        action:
          "Rolled out Prometheus/Grafana dashboards and health probes per stage.",
        outcome:
          "Teams could detect and resolve production issues before user impact.",
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
        title: "Dual-Write Preparation",
        challenge:
          "Legacy and target schemas needed to stay consistent during migration.",
        action:
          "Implemented compatibility layer with dual-write and verification logs.",
        outcome:
          "Allowed both schemas to stay in sync while traffic remained live.",
      },
      {
        title: "Backfill and Validation",
        challenge:
          "Historical data quality issues risked corrupting the new model.",
        action:
          "Ran incremental backfill batches with automated reconciliation checks.",
        outcome:
          "Detected edge-case mismatches early and corrected them safely.",
      },
      {
        title: "Cutover Control",
        challenge: "Cutover window had to be short and reversible.",
        action:
          "Executed phased traffic switch with rollback gates and monitoring.",
        outcome: "Completed migration with no production downtime.",
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
