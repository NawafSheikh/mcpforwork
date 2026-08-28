/**
 * Tenant policy engine: role gates plus scoped, unexpired, single-use approvals
 * for every mutation. Reads are role-gated only.
 * Ported from mcpforwork-d365-control-plane, 28 Aug 2026: browser-safe, zero
 * dependencies. Only change is the argument-digest pattern, which now also
 * accepts the FNV-1a digests the browser build produces synchronously.
 */

export type TenantRole = "reader" | "operator" | "approver" | "admin";
export type Effect = "READ" | "MUTATE";

export interface PolicyContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly roles: readonly TenantRole[];
}

export interface OperationRequest {
  readonly operationId: string;
  readonly tenantId: string;
  readonly effect: Effect;
  readonly argumentDigest?: string;
}

export interface ApprovalGrant {
  readonly approvalId: string;
  readonly tenantId: string;
  readonly operationId: string;
  readonly argumentDigest: string;
  readonly approvedBy: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}

export interface PolicyDecision {
  readonly isAllowed: true;
  readonly reasonCode: "ALLOW_READ" | "ALLOW_APPROVED_MUTATION";
}

export class PolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/i;
const OPERATION_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/i;
export const ARGUMENT_DIGEST_PATTERN =
  /^(sha256:[a-f0-9]{64}|fnv1a64:[a-f0-9]{16})$/;

const KNOWN_ROLES = new Set<TenantRole>([
  "reader",
  "operator",
  "approver",
  "admin",
]);

export function assertTenantId(value: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new PolicyError("INVALID_TENANT", "Tenant identifier is invalid.");
  }
  return value;
}

export function assertPrincipalId(value: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new PolicyError(
      "INVALID_PRINCIPAL",
      "Principal identifier is invalid.",
    );
  }
  return value;
}

export function assertOperationId(value: string): string {
  if (!OPERATION_PATTERN.test(value)) {
    throw new PolicyError(
      "INVALID_OPERATION",
      "Operation identifier is invalid.",
    );
  }
  return value;
}

export function isArgumentDigest(value: unknown): value is string {
  return typeof value === "string" && ARGUMENT_DIGEST_PATTERN.test(value);
}

export function createPolicyContext(input: {
  tenantId: string;
  principalId: string;
  roles: readonly TenantRole[];
}): PolicyContext {
  const roles = [...new Set(input.roles)];
  if (roles.length === 0 || roles.some((role) => !KNOWN_ROLES.has(role))) {
    throw new PolicyError(
      "INVALID_ROLE",
      "At least one known role is required.",
    );
  }

  return Object.freeze({
    tenantId: assertTenantId(input.tenantId),
    principalId: assertPrincipalId(input.principalId),
    roles: Object.freeze(roles),
  });
}

function hasAnyRole(
  context: PolicyContext,
  allowed: readonly TenantRole[],
): boolean {
  return context.roles.some((role) => allowed.includes(role));
}

function assertApprovalScope(
  request: OperationRequest,
  approval: ApprovalGrant,
  now: Date,
): void {
  if (!isArgumentDigest(request.argumentDigest) ||
      !isArgumentDigest(approval.argumentDigest)) {
    throw new PolicyError(
      "ARGUMENT_DIGEST_REQUIRED",
      "Mutations require a valid argument digest.",
    );
  }
  if (
    approval.tenantId !== request.tenantId ||
    approval.operationId !== request.operationId ||
    approval.argumentDigest !== request.argumentDigest
  ) {
    throw new PolicyError(
      "APPROVAL_SCOPE_MISMATCH",
      "Approval does not match the tenant, operation, and arguments.",
    );
  }
  if (approval.consumedAt) {
    throw new PolicyError(
      "APPROVAL_CONSUMED",
      "Approval has already been consumed.",
    );
  }
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) {
    throw new PolicyError("APPROVAL_EXPIRED", "Approval has expired.");
  }
}

export function evaluateOperation(
  context: PolicyContext,
  request: OperationRequest,
  approval?: ApprovalGrant,
  now = new Date(),
): PolicyDecision {
  assertOperationId(request.operationId);
  assertTenantId(request.tenantId);

  if (context.tenantId !== request.tenantId) {
    throw new PolicyError(
      "TENANT_MISMATCH",
      "The operation tenant does not match the authenticated tenant.",
    );
  }

  if (request.effect === "READ") {
    if (!hasAnyRole(context, ["reader", "operator", "approver", "admin"])) {
      throw new PolicyError("ROLE_DENIED", "A read role is required.");
    }
    return { isAllowed: true, reasonCode: "ALLOW_READ" };
  }

  if (!hasAnyRole(context, ["operator", "admin"])) {
    throw new PolicyError("ROLE_DENIED", "An operator role is required.");
  }
  if (!approval) {
    throw new PolicyError(
      "APPROVAL_REQUIRED",
      "A current, scoped approval is required for every mutation.",
    );
  }
  assertApprovalScope(request, approval, now);

  return { isAllowed: true, reasonCode: "ALLOW_APPROVED_MUTATION" };
}
