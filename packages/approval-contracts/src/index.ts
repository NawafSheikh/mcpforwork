/**
 * Approval records: request, decide, then authorize-and-consume exactly once.
 * A mutation is only ever authorized against an approval scoped to the same
 * tenant, operation and argument digest.
 * Ported from mcpforwork-d365-control-plane, 28 Aug 2026: browser-safe. The
 * node:crypto SHA-256 and randomUUID calls became Web Crypto plus an FNV-1a
 * fallback, and stored records are now frozen and replaced rather than mutated.
 */

import { canonicalize, fnv1a64, sha256Hex } from "../../hash/src/index";
import {
  assertOperationId,
  assertPrincipalId,
  assertTenantId,
  evaluateOperation,
  type ApprovalGrant,
  type PolicyContext,
} from "../../policy-engine/src/index";

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "DENIED"
  | "CONSUMED"
  | "EXPIRED";

export interface ApprovalRecord {
  readonly approvalId: string;
  readonly tenantId: string;
  readonly operationId: string;
  readonly argumentDigest: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly status: ApprovalStatus;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly consumedAt: string | null;
}

export interface MutationExecutionPermit {
  readonly approvalId: string;
  readonly tenantId: string;
  readonly operationId: string;
  readonly argumentDigest: string;
  readonly approvedBy: string;
  readonly authorizedAt: string;
}

export class ApprovalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApprovalError";
    this.code = code;
  }
}

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 900;
const DEFAULT_TTL_SECONDS = 600;

/** Synchronous, browser-safe digest. Deterministic for equal argument objects. */
export function buildArgumentDigest(argumentsValue: unknown): string {
  const serialized = JSON.stringify(canonicalize(argumentsValue)) ?? "null";
  return `fnv1a64:${fnv1a64(serialized)}`;
}

/** Web Crypto equivalent, for callers that can await a real SHA-256. */
export async function buildArgumentDigestAsync(
  argumentsValue: unknown,
): Promise<string> {
  const serialized = JSON.stringify(canonicalize(argumentsValue)) ?? "null";
  return `sha256:${await sha256Hex(serialized)}`;
}

function newApprovalId(seed: string): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  return `ap-${fnv1a64(seed)}`;
}

function tenantKey(tenantId: string, approvalId: string): string {
  return `${tenantId}:${approvalId}`;
}

function expireIfDue(record: ApprovalRecord, now: Date): ApprovalRecord {
  const isOpen = record.status === "PENDING" || record.status === "APPROVED";
  if (isOpen && new Date(record.expiresAt).getTime() <= now.getTime()) {
    return Object.freeze({ ...record, status: "EXPIRED" as const });
  }
  return record;
}

function assertConsumable(
  record: ApprovalRecord,
  operationId: string,
  argumentDigest: string,
): void {
  if (record.status === "CONSUMED") {
    throw new ApprovalError(
      "ALREADY_CONSUMED",
      "Approval has already been consumed.",
    );
  }
  if (record.status !== "APPROVED") {
    throw new ApprovalError(
      "NOT_APPROVED",
      "Approval is not in the approved state.",
    );
  }
  if (
    record.operationId !== operationId ||
    record.argumentDigest !== argumentDigest
  ) {
    throw new ApprovalError(
      "SCOPE_MISMATCH",
      "Approval does not match the requested operation and arguments.",
    );
  }
}

function toGrant(record: ApprovalRecord): ApprovalGrant {
  return {
    approvalId: record.approvalId,
    tenantId: record.tenantId,
    operationId: record.operationId,
    argumentDigest: record.argumentDigest,
    approvedBy: record.decidedBy ?? "",
    expiresAt: record.expiresAt,
    consumedAt: null,
  };
}

export class InMemoryApprovalStore {
  readonly #records = new Map<string, ApprovalRecord>();

  request(input: {
    tenantId: string;
    operationId: string;
    arguments: unknown;
    requestedBy: string;
    now?: Date;
    ttlSeconds?: number;
  }): ApprovalRecord {
    const now = input.now ?? new Date();
    const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    if (ttlSeconds < MIN_TTL_SECONDS || ttlSeconds > MAX_TTL_SECONDS) {
      throw new ApprovalError(
        "INVALID_TTL",
        "Approval lifetime must be between 60 and 900 seconds.",
      );
    }

    const tenantId = assertTenantId(input.tenantId);
    const operationId = assertOperationId(input.operationId);
    const argumentDigest = buildArgumentDigest(input.arguments);
    const approvalId = newApprovalId(
      `${tenantId}|${operationId}|${argumentDigest}|${now.toISOString()}`,
    );
    return this.#put(
      Object.freeze({
        approvalId,
        tenantId,
        operationId,
        argumentDigest,
        requestedBy: assertPrincipalId(input.requestedBy),
        requestedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
        status: "PENDING" as const,
        decidedBy: null,
        decidedAt: null,
        consumedAt: null,
      }),
    );
  }

  decide(input: {
    approvalId: string;
    tenantId: string;
    decidedBy: string;
    decision: "APPROVE" | "DENY";
    now?: Date;
  }): ApprovalRecord {
    const now = input.now ?? new Date();
    const current = expireIfDue(this.#get(input.tenantId, input.approvalId), now);
    const decidedBy = assertPrincipalId(input.decidedBy);

    if (current.status !== "PENDING") {
      throw new ApprovalError(
        "NOT_PENDING",
        "Only a pending approval can be decided.",
      );
    }
    if (current.requestedBy === decidedBy) {
      throw new ApprovalError(
        "SELF_APPROVAL_DENIED",
        "The requester cannot approve their own mutation.",
      );
    }

    const status = input.decision === "APPROVE" ? "APPROVED" : "DENIED";
    return this.#put(
      Object.freeze({
        ...current,
        status: status as ApprovalStatus,
        decidedBy,
        decidedAt: now.toISOString(),
      }),
    );
  }

  authorizeAndConsume(input: {
    context: PolicyContext;
    approvalId: string;
    tenantId: string;
    operationId: string;
    arguments: unknown;
    now?: Date;
  }): MutationExecutionPermit {
    const now = input.now ?? new Date();
    const current = expireIfDue(this.#get(input.tenantId, input.approvalId), now);
    const operationId = assertOperationId(input.operationId);
    const argumentDigest = buildArgumentDigest(input.arguments);
    assertConsumable(current, operationId, argumentDigest);

    evaluateOperation(
      input.context,
      { tenantId: current.tenantId, operationId, effect: "MUTATE", argumentDigest },
      toGrant(current),
      now,
    );

    const authorizedAt = now.toISOString();
    this.#put(
      Object.freeze({
        ...current,
        status: "CONSUMED" as const,
        consumedAt: authorizedAt,
      }),
    );
    return Object.freeze({
      approvalId: current.approvalId,
      tenantId: current.tenantId,
      operationId: current.operationId,
      argumentDigest: current.argumentDigest,
      approvedBy: current.decidedBy ?? "",
      authorizedAt,
    });
  }

  #get(tenantIdValue: string, approvalId: string): ApprovalRecord {
    const tenantId = assertTenantId(tenantIdValue);
    const record = this.#records.get(tenantKey(tenantId, approvalId));
    if (!record) {
      throw new ApprovalError(
        "NOT_FOUND",
        "Approval was not found in the authenticated tenant.",
      );
    }
    return record;
  }

  #put(record: ApprovalRecord): ApprovalRecord {
    this.#records.set(tenantKey(record.tenantId, record.approvalId), record);
    return record;
  }
}
