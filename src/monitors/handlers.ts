/**
 * Tool handlers for the monitor half of the WebMCP surface, matching the
 * registry signature `(input, ws) => { next?, result }`. Return strings follow
 * docs/TOOLS.md. Nothing here mutates: every handler returns a new workspace.
 */

import { buildArgumentDigest } from "../../packages/approval-contracts/src/index";
import { auditPreview } from "../../packages/audit/src/index";
import { describePolicy, diffPolicy, evaluateDraft } from "../policy/engine";
import type { DraftAction, Monitor, Workspace } from "../types";
import type { HandlerMap } from "../webmcp/registry";
import { readNumber, readString, readStrings } from "./handlerTypes";
import type { HandlerFn, HandlerResult } from "./handlerTypes";
import { readDrafts, readPolicy } from "./inputs";
import { capJsonArray,
  applyRun,
  autosInRun,
  capOutput,
  nextMonitorId,
  withAudit,
} from "./runCore";
import { isScheduleError, nextRunAt, parseSchedule } from "./schedule";

const SITE = "https://mcpforwork.com";
const MAX_PROMPT_CHARS = 300;

/** The scheduled-task prompt a visitor pastes into ChatGPT for a local runner. */
export function scheduledTaskPrompt(monitorId: string, category: string): string {
  const prompt = `Open ${SITE}, then call report_monitor_run for monitor ${monitorId} with what you found in ${category} since the last run`;
  return prompt.length > MAX_PROMPT_CHARS
    ? prompt.slice(0, MAX_PROMPT_CHARS)
    : prompt;
}

function fail(result: string): HandlerResult {
  return { result: capOutput(result) };
}

function findMonitor(ws: Workspace, id: string | undefined): Monitor | undefined {
  return id === undefined ? undefined : ws.monitors[id];
}

export const register_monitor: HandlerFn = (input, ws) => {
  const name = readString(input, "name");
  const category = readString(input, "category");
  const schedule = readString(input, "schedule");
  const policy = readPolicy(input);
  const runner = readString(input, "runner") === "cloud" ? "cloud" : "local";
  if (!name || !category || !schedule || !policy) {
    return fail("register_monitor needs name, category, schedule and policy.");
  }
  const parsed = parseSchedule(schedule);
  if (isScheduleError(parsed)) {
    return fail(parsed.error);
  }

  const now = new Date();
  const id = nextMonitorId(ws, name);
  const monitor: Monitor = {
    id,
    name,
    category,
    schedule: parsed.cron,
    policy,
    runner,
    status: "active",
    createdAt: now.toISOString(),
    nextRunAt: nextRunAt(parsed.cron, now).toISOString(),
  };
  const unknownCategory =
    ws.categories[category] === undefined
      ? ` Category "${category}" is not on the board yet, so call create_category next.`
      : "";

  return {
    next: { ...ws, monitors: { ...ws.monitors, [id]: monitor }, updatedAt: monitor.createdAt },
    result: capOutput(
      `Monitor ${name} registered as ${id}, runs ${parsed.human} as ${runner}. ` +
        `Policy: ${describePolicy(policy)}${unknownCategory} ` +
        `Create the matching ChatGPT scheduled task with this prompt: "${scheduledTaskPrompt(id, category)}"`,
    ),
  };
};

function heldLine(draft: DraftAction): string {
  return `${draft.id} ${draft.summary} [${draft.heldReason ?? "held"}]`;
}

export const report_monitor_run: HandlerFn = (input, ws) => {
  const monitor = findMonitor(ws, readString(input, "monitorId"));
  if (!monitor) {
    return fail(
      `No monitor with id "${readString(input, "monitorId") ?? ""}". Call list_monitors first.`,
    );
  }
  const findings = readStrings(input, "findings");
  const applied = applyRun(ws, monitor, findings, readDrafts(input), new Date());
  const { auto, pending, held } = applied.counts;
  const heldDrafts = applied.drafts.filter((draft) => draft.status === "held");
  const heldText =
    heldDrafts.length > 0
      ? ` Held: ${heldDrafts.map(heldLine).join("; ")}.`
      : "";
  const nextStep =
    pending > 0
      ? " Call approve_draft or decline_draft for the pending ones."
      : "";

  return {
    next: applied.next,
    result: capOutput(
      `${applied.run.id} for ${monitor.name}: ${findings.length} finding(s), ` +
        `${auto} auto, ${pending} pending, ${held} held.${heldText}${nextStep}` +
        (held > 0 ? " Held drafts need a human in the Monitors tab." : ""),
    ),
  };
};

export const list_monitors: HandlerFn = (_input, ws) => ({
  result: capJsonArray(
    Object.values(ws.monitors).map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      category: monitor.category,
      schedule: monitor.schedule,
      runner: monitor.runner,
      status: monitor.status,
      lastRunAt: monitor.lastRunAt ?? null,
      nextRunAt: monitor.nextRunAt ?? null,
      policy: describePolicy(monitor.policy),
    })),
  ),
});

export const get_run_log: HandlerFn = (input, ws) => {
  const monitorId = readString(input, "monitorId");
  const limit = Math.min(Math.max(readNumber(input, "limit") ?? 10, 1), 20);
  const runs = ws.runs
    .filter((run) => monitorId === undefined || run.monitorId === monitorId)
    .slice(-limit)
    .reverse()
    .map((run) => ({
      id: run.id,
      monitorId: run.monitorId,
      startedAt: run.startedAt,
      findings: run.findings,
      drafts: run.draftIds.flatMap((id) => {
        const draft = ws.drafts[id];
        return draft
          ? [{
              id: draft.id,
              kind: draft.kind,
              target: draft.target,
              summary: draft.summary,
              status: draft.status,
              heldReason: draft.heldReason ?? null,
              decidedBy: draft.decidedBy ?? null,
            }]
          : [];
      }),
    }));
  return { result: capJsonArray(runs) };
};

function settleDraft(
  ws: Workspace,
  draft: DraftAction,
  patch: Partial<DraftAction>,
): Workspace {
  return {
    ...ws,
    drafts: { ...ws.drafts, [draft.id]: { ...draft, ...patch } },
    updatedAt: new Date().toISOString(),
  };
}

function alreadyDecided(draft: DraftAction): string | undefined {
  if (draft.status === "auto") {
    return `Draft ${draft.id} already ran automatically under the allowlist.`;
  }
  if (draft.status === "approved" || draft.status === "declined") {
    return `Draft ${draft.id} was already ${draft.status} by the ${draft.decidedBy ?? "system"}.`;
  }
  return undefined;
}

export const approve_draft: HandlerFn = (input, ws) => {
  const draftId = readString(input, "draftId");
  const draft = draftId === undefined ? undefined : ws.drafts[draftId];
  if (!draft) {
    return fail(`No draft with id "${draftId ?? ""}". Call get_run_log to list drafts.`);
  }
  const settled = alreadyDecided(draft);
  if (settled) {
    return fail(settled);
  }
  const monitor = ws.monitors[draft.monitorId];
  if (!monitor) {
    return fail(`Draft ${draft.id} has no monitor, so the policy cannot be re-checked.`);
  }

  const decision = evaluateDraft(monitor.policy, draft, {
    autoApprovedSoFar: autosInRun(ws, draft.runId),
  });
  if (decision.status === "held") {
    return fail(
      `Refused: clause ${decision.clause ?? "held"}: ${decision.reason} ` +
        "A human can approve it from the Monitors tab.",
    );
  }

  const note = readString(input, "note");
  return {
    next: settleDraft(ws, draft, {
      status: "approved",
      decidedBy: "agent",
      decidedAt: new Date().toISOString(),
    }),
    result: capOutput(
      `Approved ${draft.id}: ${draft.summary}.${note ? ` Note: ${note}` : ""}`,
    ),
  };
};

export const decline_draft: HandlerFn = (input, ws) => {
  const draftId = readString(input, "draftId");
  const draft = draftId === undefined ? undefined : ws.drafts[draftId];
  if (!draft) {
    return fail(`No draft with id "${draftId ?? ""}". Call get_run_log to list drafts.`);
  }
  const settled = alreadyDecided(draft);
  if (settled) {
    return fail(settled);
  }
  const reason = readString(input, "reason");
  return {
    next: settleDraft(ws, draft, {
      status: "declined",
      decidedBy: "agent",
      decidedAt: new Date().toISOString(),
    }),
    result: capOutput(
      `Declined ${draft.id}: ${draft.summary}.${reason ? ` Reason: ${reason}` : ""}`,
    ),
  };
};

export const set_policy: HandlerFn = (input, ws) => {
  const monitor = findMonitor(ws, readString(input, "monitorId"));
  const policy = readPolicy(input);
  if (!monitor || !policy) {
    return fail("set_policy needs a known monitorId and a policy object.");
  }
  const changes = diffPolicy(monitor.policy, policy);
  const at = new Date().toISOString();
  return {
    next: {
      ...ws,
      monitors: { ...ws.monitors, [monitor.id]: { ...monitor, policy } },
      updatedAt: at,
    },
    result: capOutput(
      `Policy for ${monitor.name} updated. ` +
        (changes.length > 0 ? `Changes: ${changes.join("; ")}. ` : "No clause changed. ") +
        describePolicy(policy),
    ),
  };
};

/**
 * The UI path. A human can decide anything, including held drafts, and the
 * decision is audited as actor "human".
 */
export function humanDecide(
  ws: Workspace,
  draftId: string,
  decision: "approved" | "declined",
  note?: string,
): HandlerResult {
  const draft = ws.drafts[draftId];
  if (!draft) {
    return fail(`No draft with id "${draftId}".`);
  }
  const at = new Date().toISOString();
  const result = `${decision === "approved" ? "Approved" : "Declined"} ${draft.id}: ${draft.summary}.${note ? ` Note: ${note}` : ""}`;
  const decided = settleDraft(ws, draft, {
    status: decision,
    decidedBy: "human",
    decidedAt: at,
  });
  return {
    next: withAudit(decided, {
      id: `audit-${draft.id}-${decision}`,
      at,
      actor: "human",
      tool: decision === "approved" ? "approve_draft" : "decline_draft",
      argsHash: buildArgumentDigest({ draftId, decision, note: note ?? null }),
      argsPreview: auditPreview({ draftId, summary: draft.summary, note: note ?? null }),
      result: capOutput(result),
      ok: true,
    }),
    result: capOutput(result),
  };
}

/** The seven tools A3 owns, ready to pass to createWebmcp as `handlers`. */
export const monitorHandlers: HandlerMap = {
  register_monitor,
  report_monitor_run,
  list_monitors,
  get_run_log,
  approve_draft,
  decline_draft,
  set_policy,
};
