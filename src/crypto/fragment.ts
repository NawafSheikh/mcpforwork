/**
 * The URL fragment as a small ordered map, so a room key and a share snapshot can live
 * in the same "#" without either one knowing about the other.
 *
 * A fragment is never sent to a server by any browser, which is the whole reason the room
 * key lives here and the room slug lives in the query string. src/share/url.ts already
 * reads "#share=<payload>" with URLSearchParams; this parser is compatible with that one
 * (same "&" separator, same split on the first "="), and it is order independent, so
 * "#k=...&share=..." and "#share=...&k=..." are the same fragment.
 *
 * Values are kept verbatim on the way through. URLSearchParams.toString() would re-encode
 * a share payload it never needed to touch, and a link that changes shape every time it is
 * rewritten is a link people stop trusting.
 */

export interface FragmentParam {
  readonly key: string;
  readonly value: string;
}

/** decodeURIComponent throws on a stray "%", and a malformed link must not blank the page. */
function decodePart(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** "=" is left alone: it is legal inside a fragment value and both parsers split on the first one. */
function encodePart(text: string): string {
  return encodeURIComponent(text).replace(/%3D/g, "=");
}

export function parseFragment(hash: string): readonly FragmentParam[] {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.length === 0) return [];
  const out: FragmentParam[] = [];
  for (const part of raw.split("&")) {
    if (part.length === 0) continue;
    const at = part.indexOf("=");
    if (at === -1) out.push({ key: decodePart(part), value: "" });
    else out.push({ key: decodePart(part.slice(0, at)), value: decodePart(part.slice(at + 1)) });
  }
  return out;
}

export function formatFragment(params: readonly FragmentParam[]): string {
  const body = params
    .filter((param) => param.key.length > 0)
    .map((param) => `${encodePart(param.key)}=${encodePart(param.value)}`)
    .join("&");
  return body.length === 0 ? "" : `#${body}`;
}

/** The first value for a name, or null. Order independent by construction. */
export function readFragmentParam(hash: string, name: string): string | null {
  const found = parseFragment(hash).find((param) => param.key === name);
  return found === undefined || found.value.length === 0 ? null : found.value;
}

/** Replaces in place when the name is already there, so a rewritten link keeps its order. */
export function writeFragmentParam(hash: string, name: string, value: string): string {
  const current = parseFragment(hash);
  const next = current.some((param) => param.key === name)
    ? current.map((param) => (param.key === name ? { key: name, value } : param))
    : [...current, { key: name, value }];
  return formatFragment(next);
}

export function dropFragmentParam(hash: string, name: string): string {
  return formatFragment(parseFragment(hash).filter((param) => param.key !== name));
}
