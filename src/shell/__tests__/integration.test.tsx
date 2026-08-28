import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../App";
import { ShellProvider } from "../context";
import { createWorkspaceStore } from "../../store";
import { sampleWorkspace } from "../../demo/sampleWorkspace";
import { AboutTab } from "../tabs/AboutTab";
import { chooseTransport } from "../../rooms";

const statusStore = {
  get: () => ({ available: true, registered: 24 }),
  subscribe: () => () => undefined,
};

function shell(node: JSX.Element, seeded = false): string {
  const store = createWorkspaceStore(
    seeded ? { mode: "demo", initial: sampleWorkspace(new Date()), persist: false } : { mode: "demo", persist: false },
  );
  return renderToStaticMarkup(
    <ShellProvider store={store} statusStore={statusStore}>
      {node}
    </ShellProvider>,
  );
}

describe("integration wiring", () => {
  it("shows the invite button and no chip outside a room", () => {
    const html = shell(<App />);
    expect(html).toContain("Invite to room");
    expect(html).not.toContain("people, ");
  });

  it("mounts the drop zone on the board and hides it in a snapshot", () => {
    expect(shell(<App />, true)).toContain("Drop a CSV or XLSX");
    expect(shell(<App snapshot />, true)).not.toContain("Drop a CSV or XLSX");
  });

  it("prints the transport note verbatim in About", () => {
    expect(shell(<AboutTab />)).toContain(chooseTransport().note);
  });
});
