/**
 * Prompt templating. Two variables, substituted when a prompt is copied:
 * {{threads}} for how many threads to read and {{category}} for which board to name.
 * A variable nobody supplied is left in the text exactly as written, so a half filled
 * prompt still says what it is missing instead of pasting the word "undefined".
 */
import type { TemplateVars } from "./types";

const TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** The variable names this module knows how to fill. */
export const TEMPLATE_VAR_NAMES = ["threads", "category"] as const;
export type TemplateVarName = (typeof TEMPLATE_VAR_NAMES)[number];

function valueFor(name: string, vars: TemplateVars): string | undefined {
  if (name === "threads" && typeof vars.threads === "number" && Number.isFinite(vars.threads)) {
    return String(Math.trunc(vars.threads));
  }
  if (name === "category" && typeof vars.category === "string" && vars.category.trim() !== "") {
    return vars.category.trim();
  }
  return undefined;
}

/** Fill what we were given and leave the rest standing. Never throws. */
export function renderTemplate(text: string, vars: TemplateVars = {}): string {
  return text.replace(TOKEN, (whole, name: string) => valueFor(name, vars) ?? whole);
}

/** Which known variables a prompt actually uses, so the picker shows only those. */
export function usedVars(text: string): readonly TemplateVarName[] {
  const found = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1];
    if (name !== undefined) found.add(name);
  }
  return TEMPLATE_VAR_NAMES.filter((name) => found.has(name));
}

/** The first line of a prompt, for the collapsed row in the library. */
export function firstLine(text: string, max = 96): string {
  const line = (text.split("\n").find((part) => part.trim() !== "") ?? "").trim();
  return line.length <= max ? line : `${line.slice(0, max - 3)}...`;
}
