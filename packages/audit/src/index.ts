/**
 * Redacted, bounded audit events. Secrets never reach a sink.
 * Ported from mcpforwork-d365-control-plane, 28 Aug 2026: browser-safe. The
 * node:fs JSONL sink was dropped; the redaction rules are unchanged.
 */

import {
  assertOperationId,
  assertPrincipalId,
  assertTenantId,
} from "../../policy-engine/src/index";

export type AuditOutcome = "ALLOW" | "DENY" | "ERROR";

export interface AuditEvent {
  readonly schemaVersion: "1.0";
  readonly eventId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly requestId: string;
  readonly timestamp: string;
  readonly details: unknown;
}

export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "accesstoken",
  "refreshtoken",
  "token",
  "secret",
  "clientsecret",
  "password",
  "cookie",
  "setcookie",
  "apikey",
  "connectionstring",
  "credential",
  "jwt",
  "privatekey",
  "pwd",
  "sas",
  "sastoken",
  "xfunctionskey",
]);

const MAX_STRING_CHARS = 2_000;
const MAX_ENTRIES = 100;
const MAX_DEPTH = 8;

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function redactString(value: string): string {
  if (/(?:authorization\s*:\s*)?bearer\s+[a-z0-9._~+/-]+/i.test(value)) {
    return "[REDACTED_BEARER]";
  }
  if (/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(value)) {
    return "[REDACTED_JWT]";
  }
  return value.length > MAX_STRING_CHARS
    ? `${value.slice(0, MAX_STRING_CHARS)}[TRUNCATED]`
    : value;
}

export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "[MAX_DEPTH]";
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ENTRIES)
      .map((entry) => redactAuditValue(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_ENTRIES,
    );
    return Object.fromEntries(
      entries.map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.has(normalizeKey(key))
          ? "[REDACTED]"
          : redactAuditValue(entry, depth + 1),
      ]),
    );
  }
  return value;
}

/** One-line, human-readable preview of a redacted payload, hard-capped. */
export function auditPreview(value: unknown, maxChars = 160): string {
  const redacted = redactAuditValue(value);
  const text = typeof redacted === "string" ? redacted : JSON.stringify(redacted);
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > maxChars ? `${flat.slice(0, maxChars - 1)}\u2026` : flat;
}

export function createAuditEvent(input: {
  eventId: string;
  tenantId: string;
  principalId: string;
  action: string;
  outcome: AuditOutcome;
  requestId: string;
  timestamp?: string;
  details?: unknown;
}): AuditEvent {
  if (!/^[a-z0-9][a-z0-9_-]{2,127}$/i.test(input.eventId)) {
    throw new Error("Audit event identifier is invalid.");
  }
  if (!/^[a-z0-9][a-z0-9_-]{2,127}$/i.test(input.requestId)) {
    throw new Error("Audit request identifier is invalid.");
  }

  return Object.freeze({
    schemaVersion: "1.0",
    eventId: input.eventId,
    tenantId: assertTenantId(input.tenantId),
    principalId: assertPrincipalId(input.principalId),
    action: assertOperationId(input.action),
    outcome: input.outcome,
    requestId: input.requestId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    details: redactAuditValue(input.details ?? {}),
  });
}

export class InMemoryAuditSink implements AuditSink {
  #events: readonly AuditEvent[] = [];

  get events(): readonly AuditEvent[] {
    return this.#events;
  }

  async write(event: AuditEvent): Promise<void> {
    this.#events = [...this.#events, event];
  }
}
