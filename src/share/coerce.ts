/**
 * Primitive coercers for the share fragment.
 *
 * Nothing in here trusts its input. A shared link is a string a stranger can write,
 * so every value is type checked, capped, copied into a fresh object and dropped when
 * it does not fit. There is no eval, no Function, no reviver and no dynamic import.
 */

/** Keys that would touch the prototype chain when a record is built by assignment. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isSafeKey(key: string): boolean {
  return key.length > 0 && !UNSAFE_KEYS.has(key);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, max: number): readonly unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

/** A non empty string, trimmed and cut to `max` characters, or undefined. */
export function asString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.slice(0, max).trim();
  return text.length > 0 ? text : undefined;
}

export function asText(value: unknown, max: number, fallback: string): string {
  return asString(value, max) ?? fallback;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** An ISO timestamp, re-serialised from the parsed date so no odd string survives. */
export function asIso(value: unknown, fallback: string): string {
  const text = asString(value, 40);
  if (text === undefined) return fallback;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = typeof value === "string" ? value : "";
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

export function asOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  const text = typeof value === "string" ? value : "";
  return (allowed as readonly string[]).includes(text) ? (text as T) : undefined;
}

export function asStringList(
  value: unknown,
  maxItems: number,
  maxChars: number,
): readonly string[] {
  const out: string[] = [];
  for (const item of asArray(value, maxItems)) {
    const text = asString(item, maxChars);
    if (text !== undefined) out.push(text);
  }
  return out;
}

/** Record of finite numbers, built key by key so a hostile key cannot reach a prototype. */
export function asNumberMap(
  value: unknown,
  maxKeys: number,
  maxKeyChars: number,
): Readonly<Record<string, number>> | undefined {
  const record = asRecord(value);
  if (record === null) return undefined;
  const out: Record<string, number> = {};
  let kept = 0;
  for (const [rawKey, rawValue] of Object.entries(record)) {
    if (kept >= maxKeys) break;
    const key = asString(rawKey, maxKeyChars);
    const num = asNumber(rawValue);
    if (key === undefined || num === undefined || !isSafeKey(key)) continue;
    out[key] = num;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/** Record of strings or numbers, used for the free form `fields` on a draft. */
export function asFieldMap(
  value: unknown,
  maxKeys: number,
  maxChars: number,
): Readonly<Record<string, string | number>> | undefined {
  const record = asRecord(value);
  if (record === null) return undefined;
  const out: Record<string, string | number> = {};
  let kept = 0;
  for (const [rawKey, rawValue] of Object.entries(record)) {
    if (kept >= maxKeys) break;
    const key = asString(rawKey, maxChars);
    if (key === undefined || !isSafeKey(key)) continue;
    const num = asNumber(rawValue);
    const text = asString(rawValue, maxChars);
    if (num === undefined && text === undefined) continue;
    out[key] = num ?? (text as string);
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/** Build a keyed record from a list of already coerced items. */
export function indexBy<T>(items: readonly T[], key: (item: T) => string): Readonly<Record<string, T>> {
  const out: Record<string, T> = {};
  for (const item of items) {
    const id = key(item);
    if (isSafeKey(id)) out[id] = item;
  }
  return out;
}
