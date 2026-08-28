/** The drop zone paints the promise, the caps, and a profile card of masked values. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDatasetRegistry, type DatasetRegistry } from "../memory";
import { profileTable } from "../profile";
import { DropZone } from "../ui/DropZone";
import { ProfileCard } from "../ui/ProfileCard";
import type { CellValue, DatasetTable } from "../types";

const staff: DatasetTable = {
  columns: ["name", "email", "salary", "team"],
  rows: [
    ["Alice Smith", "alice@corp.com", "84217", "Ops"],
    ["Bo Chen", "bo@corp.com", "91004", "Ops"],
    ["Cato Rossi", "cato@corp.com", "77500", "Sales"],
    ["Dee Okafor", "dee@corp.com", "68000", "Sales"],
  ] as readonly (readonly CellValue[])[],
};

const profile = profileTable(staff, { id: "ds_staff", name: "staff.csv", bytes: 2048 });

const withFile = (): DatasetRegistry => {
  const registry = createDatasetRegistry();
  registry.put({ table: staff, profile });
  return registry;
};

const paint = (registry: DatasetRegistry): string =>
  renderToStaticMarkup(<DropZone registry={registry} />);

describe("empty drop zone", () => {
  const html = paint(createDatasetRegistry());

  it("invites a file and names both caps", () => {
    expect(html).toContain("Drop a CSV or XLSX here");
    expect(html).toContain("Choose a file");
    expect(html).toContain("up to 5 MB or 100,000 rows");
  });

  it("makes the promise in plain words", () => {
    expect(html).toContain("Rows stay in this browser");
    expect(html).toContain("gone when you close the tab");
  });

  it("shows no card, no progress bar and no error", () => {
    expect(html).not.toContain("mfw-ds__card");
    expect(html).not.toContain("mfw-ds__bar");
    expect(html).not.toContain("mfw-ds__error");
  });

  it("keeps the file input reachable by label for anyone not dragging", () => {
    expect(html).toContain("Choose a CSV or XLSX file");
    expect(html).toContain('type="file"');
  });
});

describe("drop zone with a file loaded", () => {
  const html = paint(withFile());

  it("names the file and its size without listing a row", () => {
    expect(html).toContain("staff.csv");
    expect(html).toContain("4 rows");
    expect(html).toContain("in memory only");
  });

  it("offers to forget it", () => {
    expect(html).toContain("Forget this file");
  });

  it("shows the columns and their inferred types", () => {
    expect(html).toContain("salary");
    expect(html).toContain("mfw-ds__type-number");
    expect(html).toContain("What the agent can see");
  });

  it("prints only masked examples", () => {
    expect(html).toContain("Example rows, masked");
    expect(html).toContain("abc…");
    expect(html).toContain("user@…");
    expect(html).toContain("~84k");
  });

  it("shows no name, address or exact salary anywhere on the page", () => {
    for (const secret of ["Alice", "alice@corp.com", "84217", "91004", "Okafor"]) {
      expect(html).not.toContain(secret);
    }
  });

  it("says which values it is withholding rather than hiding the fact", () => {
    expect(html).toContain("addresses withheld");
    expect(html).toContain("too many values to list");
  });
});

describe("forgetting a file", () => {
  it("empties the registry, so the next paint has no card", () => {
    const registry = withFile();
    expect(registry.size()).toBe(1);
    expect(registry.forget("staff.csv")).toBe(true);
    expect(registry.size()).toBe(0);
    expect(paint(registry)).not.toContain("staff.csv");
  });

  it("is a no-op for a file that was never loaded", () => {
    expect(createDatasetRegistry().forget("ghost.csv")).toBe(false);
  });
});

describe("profile card on its own", () => {
  it("renders the min, max and mean of a numeric column", () => {
    const html = renderToStaticMarkup(
      <ProfileCard profile={profile} onForget={() => undefined} />,
    );
    expect(html).toContain("min 68.0k · max 91.0k · mean 80.2k");
    expect(html).toContain("Ops (2) · Sales (2)");
  });
});
