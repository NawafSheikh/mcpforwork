/** The editor opens on the form, not on JSON, and paints the saved policy into it. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspaceStore } from "../../../../store";
import { ShellProvider } from "../../../context";
import { ToastProvider } from "../../../Toasts";
import { PolicyEditor } from "../../PolicyEditor";
import type { Monitor } from "../../../../types";

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

const monitor: Monitor = {
  id: "mon_1",
  name: "Invoice watch",
  category: "Invoices",
  schedule: "every morning at 08:00",
  runner: "demo",
  status: "active",
  createdAt: "2026-08-28T06:00:00.000Z",
  policy: {
    maxAutoActionsPerRun: 2,
    thresholds: [{ field: "amount", op: "gt", value: 5000 }],
    requireHumanFor: ["pay"],
    denylist: ["wire"],
    notes: "Finance signed this off",
  },
};

function paint(): string {
  const store = createWorkspaceStore({ mode: "demo", persist: false });
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore}>
      <ToastProvider>
        <PolicyEditor monitor={monitor} />
      </ToastProvider>
    </ShellProvider>,
  );
}

describe("PolicyEditor", () => {
  const html = paint();

  it("shows the form by default, with the plain sentence under the stepper", () => {
    expect(html).toContain("Max automatic actions per run");
    expect(html).toContain(
      "After 2 automatic actions in one run, everything else waits for a person.",
    );
  });

  it("offers the JSON textarea as a toggle rather than as the editor", () => {
    expect(html).toContain("Edit as JSON");
    expect(html).not.toContain("Policy JSON");
  });

  it("paints the saved clauses as rows and chips", () => {
    expect(html).toContain("Always ask a human for");
    expect(html).toContain("Never run, always hold");
    expect(html).toContain("Rule 1 field");
    expect(html).toContain("Finance signed this off");
  });

  it("previews the policy sentence and an empty diff against the saved one", () => {
    expect(html).toContain("Holds anything that trips amount&gt;5000");
    expect(html).toContain("No changes yet.");
  });

  it("keeps the save button on the same set_policy path", () => {
    expect(html).toContain("Save policy");
  });
});
