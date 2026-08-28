/** Prompt storage: it persists, it caps, it resets, and it never throws at the caller. */
import { describe, expect, it } from "vitest";
import { STARTER_PROMPT } from "../../shell/lib/constants";
import { defaultPromptState, STARTER_ID } from "../defaults";
import {
  addPrompt,
  canAddPrompt,
  findPrompt,
  getPrompt,
  loadPromptState,
  removePrompt,
  resetAllPrompts,
  resetPrompt,
  savePromptState,
  updatePrompt,
  type PromptStorage,
} from "../store";
import { renderTemplate } from "../template";
import { PROMPTS_KEY, PROMPTS_VERSION, PROMPT_LIMITS, type PromptState } from "../types";

function fakeStorage(seed?: string): PromptStorage & { readonly dump: () => string | null } {
  let value: string | null = seed ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    dump: () => value,
  };
}

const brokenStorage: PromptStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
};

function fill(state: PromptState, count: number): PromptState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    next = addPrompt(next, `Prompt ${i}`, `Body ${i}`);
  }
  return next;
}

describe("loading", () => {
  it("returns the shipped prompts when nothing is saved", () => {
    const state = loadPromptState(fakeStorage());
    expect(state.v).toBe(PROMPTS_VERSION);
    expect(state.prompts.map((prompt) => prompt.id)).toEqual(["starter", "quick", "monitor", "approve-all"]);
    expect(state.prompts.every((prompt) => prompt.builtIn)).toBe(true);
  });

  it("returns the shipped prompts when there is no storage at all", () => {
    expect(loadPromptState(null)).toEqual(defaultPromptState());
  });

  it("falls back rather than throwing on junk, a bad version or a blocked read", () => {
    expect(loadPromptState(fakeStorage("not json"))).toEqual(defaultPromptState());
    expect(loadPromptState(fakeStorage(JSON.stringify({ v: 99, prompts: [] })))).toEqual(
      defaultPromptState(),
    );
    expect(loadPromptState(fakeStorage(JSON.stringify({ v: 1 })))).toEqual(defaultPromptState());
    expect(loadPromptState(brokenStorage)).toEqual(defaultPromptState());
  });

  it("puts a seeded prompt back when a hand edited file dropped it", () => {
    const saved = JSON.stringify({
      v: PROMPTS_VERSION,
      prompts: [{ id: "quick", name: "Quick", text: "mine", builtIn: true }],
    });
    const state = loadPromptState(fakeStorage(saved));
    expect(state.prompts.map((prompt) => prompt.id).sort()).toEqual([
      "approve-all",
      "monitor",
      "quick",
      "starter",
    ]);
    expect(findPrompt(state, "quick")?.text).toBe("mine");
  });

  it("caps text and drops entries it cannot read", () => {
    const saved = JSON.stringify({
      v: PROMPTS_VERSION,
      prompts: [
        { id: "mine", name: "Mine", text: "y".repeat(5000) },
        { id: "", name: "No id", text: "x" },
        "not an object",
        { id: "mine", name: "Duplicate", text: "second" },
      ],
    });
    const state = loadPromptState(fakeStorage(saved));
    expect(findPrompt(state, "mine")?.text.length).toBe(PROMPT_LIMITS.textChars);
    expect(findPrompt(state, "mine")?.builtIn).toBe(false);
    expect(state.prompts.filter((prompt) => prompt.id === "mine")).toHaveLength(1);
  });
});

describe("saving", () => {
  it("writes the state under mfw:prompts and reads it back", () => {
    const storage = fakeStorage();
    const state = addPrompt(defaultPromptState(), "Weekly", "Summarise the week");
    expect(savePromptState(state, storage)).toBe(true);
    expect(JSON.parse(storage.dump() as string).v).toBe(PROMPTS_VERSION);
    const back = loadPromptState(storage);
    expect(back.prompts).toHaveLength(5);
    expect(back.prompts[4]?.name).toBe("Weekly");
  });

  it("uses the documented key", () => {
    expect(PROMPTS_KEY).toBe("mfw:prompts");
  });

  it("says false instead of throwing when the browser refuses the write", () => {
    expect(savePromptState(defaultPromptState(), brokenStorage)).toBe(false);
    expect(savePromptState(defaultPromptState(), null)).toBe(false);
  });
});

describe("editing", () => {
  it("adds a user prompt and lets it be deleted", () => {
    const added = addPrompt(defaultPromptState(), "  Weekly  ", "Summarise the week");
    const mine = added.prompts[4];
    expect(mine?.name).toBe("Weekly");
    expect(mine?.builtIn).toBe(false);
    expect(removePrompt(added, mine?.id ?? "").prompts).toHaveLength(4);
  });

  it("names an unnamed prompt rather than leaving it blank", () => {
    expect(addPrompt(defaultPromptState(), "   ", "text").prompts[4]?.name).toBe("Untitled prompt");
  });

  it("stops at twenty prompts", () => {
    const full = fill(defaultPromptState(), 17);
    expect(full.prompts).toHaveLength(PROMPT_LIMITS.prompts);
    expect(canAddPrompt(full)).toBe(false);
    expect(addPrompt(full, "One more", "nope")).toBe(full);
  });

  it("caps an edit at a thousand characters and keeps the old name when blanked", () => {
    const edited = updatePrompt(defaultPromptState(), STARTER_ID, {
      name: "  ",
      text: "z".repeat(4000),
    });
    expect(findPrompt(edited, STARTER_ID)?.text.length).toBe(PROMPT_LIMITS.textChars);
    expect(findPrompt(edited, STARTER_ID)?.name).toBe("Starter prompt");
  });

  it("refuses to delete a seeded prompt", () => {
    const state = defaultPromptState();
    expect(removePrompt(state, STARTER_ID)).toBe(state);
  });

  it("resets one prompt back to the shipped wording", () => {
    const edited = updatePrompt(defaultPromptState(), STARTER_ID, { text: "mine now" });
    expect(findPrompt(edited, STARTER_ID)?.text).toBe("mine now");
    const reset = resetPrompt(edited, STARTER_ID);
    expect(findPrompt(reset, STARTER_ID)).toEqual(defaultPromptState().prompts[0]);
  });

  it("leaves a user prompt alone when asked to reset it", () => {
    const added = addPrompt(defaultPromptState(), "Weekly", "text");
    expect(resetPrompt(added, added.prompts[4]?.id ?? "")).toBe(added);
  });

  it("resets everything, dropping the user prompts with it", () => {
    const messy = updatePrompt(fill(defaultPromptState(), 4), STARTER_ID, { text: "mine" });
    expect(resetAllPrompts()).toEqual(defaultPromptState());
    expect(messy.prompts).toHaveLength(8);
  });
});

describe("getPrompt", () => {
  it("renders the starter prompt exactly as the constant when nothing is stored", () => {
    expect(getPrompt(STARTER_ID)).toBe(STARTER_PROMPT);
  });

  it("takes an override for the variables", () => {
    const text = getPrompt(STARTER_ID, { threads: 12 });
    expect(text).toContain("last 12 Gmail threads");
    expect(text).not.toContain("{{");
  });

  it("returns nothing for a prompt that does not exist", () => {
    expect(getPrompt("nope")).toBe("");
  });

  it("renders a template it was handed directly the same way", () => {
    expect(renderTemplate(getPrompt(STARTER_ID))).toBe(STARTER_PROMPT);
  });
});
