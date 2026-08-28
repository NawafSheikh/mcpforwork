/**
 * Shared domain types for MCP for Work.
 * Every module builds against these. Change them only by agreement (docs/OWNERSHIP.md).
 * All state is immutable: never mutate, always return new objects.
 */

export type ISODate = string;

/* ---------- Dashboard DSL (what the agent sends through WebMCP) ---------- */

export interface KPI {
  readonly label: string;
  readonly value: string | number;
  readonly delta?: string;
  readonly hint?: string;
}

export type ChartKind = "bar" | "line" | "donut" | "table";

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
  readonly series?: string;
}

export interface Chart {
  readonly id?: string;
  readonly kind: ChartKind;
  readonly title: string;
  readonly points: readonly ChartPoint[];
  readonly columns?: readonly string[];
  readonly rows?: readonly (readonly (string | number)[])[];
  readonly note?: string;
}

export interface DashboardSpec {
  readonly category: string;
  readonly title?: string;
  readonly kpis: readonly KPI[];
  readonly charts: readonly Chart[];
  readonly notes?: readonly string[];
  readonly source?: string;
  readonly updatedAt: ISODate;
}

export interface OverviewSpec {
  readonly title: string;
  readonly kpis: readonly KPI[];
  readonly charts: readonly Chart[];
  readonly highlights?: readonly string[];
  readonly updatedAt: ISODate;
}

/* ---------- Categories and aggregated data (never raw records) ---------- */

export interface TopItem {
  readonly label: string;
  readonly value: number;
}

export interface DatasetSummary {
  readonly counts?: Readonly<Record<string, number>>;
  readonly sums?: Readonly<Record<string, number>>;
  readonly top?: Readonly<Record<string, readonly TopItem[]>>;
  readonly period?: string;
  readonly rowCount?: number;
  readonly updatedAt: ISODate;
}

export interface Category {
  readonly name: string;
  readonly description?: string;
  readonly provenance?: string;
  readonly createdAt: ISODate;
  readonly summary?: DatasetSummary;
  readonly dashboard?: DashboardSpec;
}

/* ---------- Monitors, policy, drafts, runs ---------- */

export type ThresholdOp = "gt" | "gte" | "lt" | "lte" | "eq";

export interface Threshold {
  readonly field: string;
  readonly op: ThresholdOp;
  readonly value: number;
  readonly label?: string;
}

export interface Policy {
  readonly maxAutoActionsPerRun: number;
  readonly thresholds?: readonly Threshold[];
  readonly allowlist?: readonly string[];
  readonly denylist?: readonly string[];
  readonly requireHumanFor?: readonly string[];
  readonly notes?: string;
}

export type Runner = "local" | "cloud" | "demo";

export interface Monitor {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly schedule: string;
  readonly policy: Policy;
  readonly runner: Runner;
  readonly status: "active" | "paused";
  readonly createdAt: ISODate;
  readonly lastRunAt?: ISODate;
  readonly nextRunAt?: ISODate;
}

export type DraftStatus = "pending" | "held" | "approved" | "declined" | "auto";
export type Decider = "human" | "agent" | "policy";

export interface DraftAction {
  readonly id: string;
  readonly monitorId: string;
  readonly runId: string;
  readonly kind: string;
  readonly target: string;
  readonly summary: string;
  readonly amount?: number;
  readonly fields?: Readonly<Record<string, string | number>>;
  readonly status: DraftStatus;
  readonly heldReason?: string;
  readonly decidedBy?: Decider;
  readonly decidedAt?: ISODate;
}

export interface MonitorRun {
  readonly id: string;
  readonly monitorId: string;
  readonly runner: Runner;
  readonly startedAt: ISODate;
  readonly finishedAt?: ISODate;
  readonly findings: readonly string[];
  readonly draftIds: readonly string[];
}

/* ---------- Policy decisions and audit ---------- */

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly clause?: string;
  readonly reason: string;
}

export type Actor = "agent" | "human" | "system";

export interface AuditEvent {
  readonly id: string;
  readonly at: ISODate;
  readonly actor: Actor;
  /** Optional self-reported label of the agent or sub-agent that made the call ("Classify 1-25"). */
  readonly caller?: string;
  readonly tool?: string;
  readonly argsHash?: string;
  readonly argsPreview?: string;
  readonly result?: string;
  readonly ok: boolean;
}

/* ---------- Feedback (humans and agents editing the same objects in turns) ---------- */

export type FeedbackTargetKind = "dashboard" | "overview" | "draft" | "monitor";

export interface FeedbackTarget {
  readonly kind: FeedbackTargetKind;
  /** category name for dashboards, "overview", draft id, or monitor id */
  readonly id: string;
}

export interface Feedback {
  readonly id: string;
  readonly target: FeedbackTarget;
  readonly text: string;
  readonly author: Actor;
  readonly createdAt: ISODate;
  readonly resolvedAt?: ISODate;
  readonly resolvedBy?: Actor;
  readonly resolution?: string;
}

/* ---------- Workspace (the whole board) ---------- */

export type WorkspaceMode = "demo" | "live";

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly mode: WorkspaceMode;
  readonly categories: Readonly<Record<string, Category>>;
  readonly overview?: OverviewSpec;
  readonly monitors: Readonly<Record<string, Monitor>>;
  readonly runs: readonly MonitorRun[];
  readonly drafts: Readonly<Record<string, DraftAction>>;
  readonly feedback: Readonly<Record<string, Feedback>>;
  readonly audit: readonly AuditEvent[];
  readonly updatedAt: ISODate;
}

export type Updater = (current: Workspace) => Workspace;

/** Store contract. src/store owns the implementation; every other module only uses this. */
export interface WorkspaceStore {
  get(): Workspace;
  update(fn: Updater): Promise<Workspace>;
  subscribe(listener: (ws: Workspace) => void): () => void;
  reset(next?: Workspace): Promise<Workspace>;
}

/* ---------- WebMCP tool contract ---------- */

export interface ToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

export interface ToolDefinition<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations?: ToolAnnotations;
  execute(input: TInput, ctx: { signal?: AbortSignal }): Promise<string>;
}

export const LIMITS = {
  toolDescriptionChars: 500,
  paramDescriptionChars: 150,
  toolOutputChars: 1500,
  maxKpis: 4,
  maxCharts: 4,
  maxPointsPerChart: 12,
  maxTableRows: 20,
  maxCategories: 24,
  maxAuditEvents: 500,
  maxToolCallsPerMinute: 60,
  maxFeedbackItems: 200,
  maxFeedbackChars: 500,
  maxCallerChars: 40,
  maxShareBytes: 60000,
} as const;
