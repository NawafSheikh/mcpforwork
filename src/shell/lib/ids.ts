/** Id generation for shell-created records. Owner A4. */

function randomPart(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomPart().slice(0, 12)}`;
}
