/**
 * The power user half of the editor: a Policy as JSON, validated with the same zod
 * schema the set_policy tool uses. Errors are returned as lines, never thrown, so a
 * half typed brace shows a message under the textarea instead of blanking the tab.
 */
import { policySchema } from "../../../webmcp/schemas";
import type { Policy } from "../../../types";

const MAX_SHOWN_ISSUES = 4;

export interface ParsedPolicy {
  readonly policy: Policy | null;
  readonly errors: readonly string[];
}

export function stringifyPolicy(policy: Policy): string {
  return JSON.stringify(policy, null, 2);
}

/** Untrusted text to a Policy. The only failure modes are "not JSON" and zod issues. */
export function parsePolicyJson(text: string): ParsedPolicy {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { policy: null, errors: ["That is not valid JSON yet."] };
  }
  const parsed = policySchema.safeParse(raw);
  if (parsed.success) {
    return { policy: parsed.data as Policy, errors: [] };
  }
  const issues = parsed.error.issues.slice(0, MAX_SHOWN_ISSUES).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "policy";
    return `${path}: ${issue.message}`;
  });
  const more = parsed.error.issues.length - issues.length;
  return { policy: null, errors: more > 0 ? [...issues, `and ${more} more`] : issues };
}
