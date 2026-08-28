/**
 * Template rendering, and the guard that matters most: a seeded prompt rendered with
 * its own defaults has to come back as the constant the shell has always shipped.
 */
import { describe, expect, it } from "vitest";
import { MONITOR_PROMPT, QUICK_PROMPT, STARTER_PROMPT } from "../../shell/lib/constants";
import { defaultPrompt, MONITOR_ID, QUICK_ID, STARTER_ID } from "../defaults";
import { firstLine, renderTemplate, usedVars } from "../template";
import type { PromptRecord } from "../types";

const seed = (id: string): PromptRecord => defaultPrompt(id) as PromptRecord;

describe("renderTemplate", () => {
  it("fills threads as a whole number", () => {
    expect(renderTemplate("Read {{threads}} threads", { threads: 30 })).toBe("Read 30 threads");
    expect(renderTemplate("Read {{threads}} threads", { threads: 12.7 })).toBe("Read 12 threads");
  });

  it("fills category as trimmed text", () => {
    expect(renderTemplate("Watch {{category}}", { category: "  Invoices " })).toBe(
      "Watch Invoices",
    );
  });

  it("fills both, more than once, and tolerates inner spaces", () => {
    expect(
      renderTemplate("{{ threads }} threads in {{category}}, then {{category}} again", {
        threads: 5,
        category: "Ops",
      }),
    ).toBe("5 threads in Ops, then Ops again");
  });

  it("leaves a variable nobody supplied exactly as written", () => {
    expect(renderTemplate("Read {{threads}} in {{category}}", { threads: 8 })).toBe(
      "Read 8 in {{category}}",
    );
    expect(renderTemplate("Read {{threads}}")).toBe("Read {{threads}}");
    expect(renderTemplate("Read {{threads}}", { category: "Ops" })).toBe("Read {{threads}}");
  });

  it("leaves a variable it does not know alone", () => {
    expect(renderTemplate("Hello {{mailbox}}", { threads: 3 })).toBe("Hello {{mailbox}}");
  });

  it("ignores an empty or unusable value rather than pasting a blank", () => {
    expect(renderTemplate("Watch {{category}}", { category: "   " })).toBe("Watch {{category}}");
    expect(renderTemplate("Read {{threads}}", { threads: Number.NaN })).toBe("Read {{threads}}");
  });

  it("reports which known variables a prompt uses", () => {
    expect(usedVars("Read {{threads}} in {{category}}")).toEqual(["threads", "category"]);
    expect(usedVars("Nothing here")).toEqual([]);
    expect(usedVars("{{mailbox}}")).toEqual([]);
  });

  it("cuts a first line for the collapsed row", () => {
    expect(firstLine("\n\n  hello there \nsecond")).toBe("hello there");
    expect(firstLine("x".repeat(200)).length).toBe(96);
  });
});

describe("the seeded prompts", () => {
  it("render back to the shipped constants, character for character", () => {
    expect(renderTemplate(seed(STARTER_ID).text, seed(STARTER_ID).vars)).toBe(STARTER_PROMPT);
    expect(renderTemplate(seed(QUICK_ID).text, seed(QUICK_ID).vars)).toBe(QUICK_PROMPT);
    expect(renderTemplate(seed(MONITOR_ID).text, seed(MONITOR_ID).vars)).toBe(MONITOR_PROMPT);
  });

  it("actually carry the variables, so the picker has something to fill", () => {
    expect(usedVars(seed(STARTER_ID).text)).toEqual(["threads"]);
    expect(usedVars(seed(QUICK_ID).text)).toEqual(["threads"]);
    expect(usedVars(seed(MONITOR_ID).text)).toEqual(["category"]);
  });

  it("are handed out as copies, so nothing can edit the seeds in place", () => {
    const one = seed(STARTER_ID);
    const two = seed(STARTER_ID);
    expect(one).not.toBe(two);
    expect(one.vars).not.toBe(two.vars);
    expect(one).toEqual(two);
  });
});
