/** Both popovers paint: the prompt list with its picker, and the backup pair. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspaceStore } from "../../store";
import { ShellProvider } from "../../shell/context";
import { Backup } from "../ui/Backup";
import { PromptLibrary } from "../ui/PromptLibrary";

const statusStore = {
  get: () => ({ available: false, registered: 0 }),
  subscribe: () => () => undefined,
};

function withShell(node: JSX.Element): string {
  const store = createWorkspaceStore({ mode: "local", persist: false });
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore}>
      {node}
    </ShellProvider>,
  );
}

describe("PromptLibrary", () => {
  it("is a closed button until somebody opens it", () => {
    const html = renderToStaticMarkup(<PromptLibrary />);
    expect(html).toContain("Prompts");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Prompt library");
  });

  it("lists the shipped prompts with copy, edit and reset", () => {
    const html = renderToStaticMarkup(<PromptLibrary defaultOpen />);
    expect(html).toContain("Prompt library");
    expect(html).toContain("Starter prompt");
    expect(html).toContain("Quick demo prompt");
    expect(html).toContain("Register a monitor");
    expect(html).toContain(">Copy<");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Reset<");
    expect(html).toContain("New prompt");
  });

  it("shows the variable picker only for the variables a prompt uses", () => {
    const html = renderToStaticMarkup(<PromptLibrary defaultOpen />);
    expect(html).toContain("prompt-mail-threads");
    expect(html).toContain("prompt-monitor-category");
    // The starter prompt takes no variables any more, so it gets no picker at all.
    expect(html).not.toContain("prompt-starter-threads");
    expect(html).not.toContain("prompt-starter-category");
  });

  it("says where prompts actually run", () => {
    expect(renderToStaticMarkup(<PromptLibrary defaultOpen />)).toContain(
      "Prompts run in YOUR ChatGPT, not on this page.",
    );
  });
});

describe("Backup", () => {
  it("is a closed button until somebody opens it", () => {
    const html = withShell(<Backup />);
    expect(html).toContain(">Backup<");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Download board");
  });

  it("offers a download and a restore, and says what the file leaves out", () => {
    const html = withShell(<Backup defaultOpen />);
    expect(html).toContain("Download board");
    expect(html).toContain("Restore from file");
    expect(html).toContain('accept=".json,application/json"');
    expect(html).toContain("The audit trail stays on this machine.");
  });
});
