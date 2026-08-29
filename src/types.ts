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

/**
 * What a note is attached to. The first four are objects on the board; the last three
 * are people and agents, which is how one visitor's agent hands work to another's.
 */
export type FeedbackTargetKind =
  | "dashboard"
  | "overview"
  | "draft"
  | "monitor"
  | "agent"
  | "room"
  | "person";

export interface FeedbackTarget {
  readonly kind: FeedbackTargetKind;
  /**
   * Category name for dashboards, "overview", a draft or monitor id, the caller name of
   * the agent or the display name of the person it is addressed to ("*" for anyone),
   * or "room" for a request to everybody on this board.
   */
  readonly id: string;
}

export interface Feedback {
  readonly id: string;
  readonly target: FeedbackTarget;
  readonly text: string;
  readonly author: Actor;
  /** Who wrote it: a caller name for an agent, a display name for a person. */
  readonly from?: string;
  readonly createdAt: ISODate;
  readonly resolvedAt?: ISODate;
  readonly resolvedBy?: Actor;
  readonly resolution?: string;
}

/* ---------- Turns (claims and versions, docs/TURNS.md) ---------- */

/**
 * What a claim can be taken on. A turn belongs to an object, never to the room, so this
 * is deliberately shorter than FeedbackTargetKind: you claim a thing that gets edited.
 */
export type ClaimTargetKind = "dashboard" | "overview" | "monitor" | "note";

export interface ClaimTarget {
  readonly kind: ClaimTargetKind;
  /** Category name, "overview", a monitor id, or a feedback id. */
  readonly id: string;
}

/**
 * Somebody is working on this object. Taken automatically by any write, refreshed by the
 * holder's next write, released by the write that finishes the work, and expired after
 * LIMITS.claimMinutes of quiet. It is information, never a lock: nobody is ever blocked
 * by somebody else's claim, and `holder` is self-reported and authorises nothing.
 */
export interface Claim {
  readonly target: ClaimTarget;
  readonly holder: string;
  readonly holderKind: "agent" | "person";
  readonly since: ISODate;
  readonly expiresAt: ISODate;
}

/** Who last wrote one object, so a stale write can be refused by name and time. */
export interface WriteMark {
  readonly at: ISODate;
  /** Caller name of the agent, or display name of the person. */
  readonly by: string;
  readonly byKind: "agent" | "person";
}

/* ---------- Tool packs and capabilities (docs/PACKS.md) ---------- */

/**
 * What a pack can do at its worst, shown next to the switch in the Tools panel.
 * `move` is the level above `send`: it is the one that can knock something over.
 */
export type PackRisk = "read" | "write" | "send" | "move";

/**
 * One switch. Absent from the workspace means "never touched", which reads as the
 * built-in default rather than as off, so a fresh board needs no state at all.
 */
export interface PackState {
  readonly id: string;
  readonly enabled: boolean;
  /** Display name of the person, or caller name of the agent, that last flipped it. */
  readonly changedBy: string;
  readonly changedAt: ISODate;
}

export type CapabilityOwnerKind = "person" | "agent" | "robot";

export interface CapabilityOwner {
  readonly kind: CapabilityOwnerKind;
  readonly name: string;
}

/**
 * What one person, agent or robot can reach. `packs` is measured (the site packs on for
 * them), `local` and `knows` are free text they declare about themselves. None of it is
 * an identity claim and none of it authorises anything: it is a card to read before
 * asking somebody for access to a system.
 */
export interface Capability {
  readonly owner: CapabilityOwner;
  readonly packs: readonly string[];
  readonly local: readonly string[];
  readonly knows: readonly string[];
  readonly updatedAt: ISODate;
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
  /** Live turns, keyed "<kind>:<id>". Expired entries are ignored and swept on write. */
  readonly claims: Readonly<Record<string, Claim>>;
  /** Last writer per object, same key shape as claims. The version check reads this. */
  readonly lastWriter: Readonly<Record<string, WriteMark>>;
  /**
   * Tool packs that were switched by hand, keyed by pack id (docs/PACKS.md). Optional:
   * a pack with no entry is at its built-in default, so an untouched board carries none.
   */
  readonly packs?: Readonly<Record<string, PackState>>;
  /** Capability cards keyed by owner name. Optional for the same reason. */
  readonly capabilities?: Readonly<Record<string, Capability>>;
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
  /** A claim dies this many minutes after the holder's last write (docs/TURNS.md). */
  claimMinutes: 10,
  /** Inside this many seconds of somebody else's write, a write is merged, not blind. */
  conflictSeconds: 60,
  maxClaims: 40,
  maxWriteMarks: 80,
  /** Capability cards kept on one board, and the caps on what one card may declare. */
  maxCapabilities: 40,
  maxCapabilityLines: 12,
  maxCapabilityChars: 80,
} as const;
