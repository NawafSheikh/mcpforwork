/**
 * Places: the list in the left rail and the one piece of navigation the app has.
 *
 * A place is React state, never a URL change, so the site tools registered on this page
 * survive every move. Everything here is pure: a workspace goes in, rows come out.
 */
import { shareOfTotal } from "../../dsl";
import type { AuditEvent, Category, Workspace } from "../../types";
import { argValue } from "./format";

export type Place =
  | { readonly kind: "overview" }
  | { readonly kind: "category"; readonly name: string }
  | { readonly kind: "loops" }
  | { readonly kind: "monitors" }
  | { readonly kind: "datasets" }
  | { readonly kind: "requests" }
  | { readonly kind: "activity" }
  | { readonly kind: "about" };

export const OVERVIEW: Place = { kind: "overview" };
export const REQUESTS: Place = { kind: "requests" };

/** Stable key for React and for aria-current. */
export function placeId(place: Place): string {
  return place.kind === "category" ? `category:${place.name}` : place.kind;
}

export function samePlace(a: Place, b: Place): boolean {
  return placeId(a) === placeId(b);
}

const FIXED_LABELS: Readonly<Record<string, string>> = {
  overview: "Overview",
  loops: "Loops",
  monitors: "Monitors",
  datasets: "Datasets",
  requests: "Requests",
  activity: "Activity",
  about: "About",
};

export function placeLabel(place: Place): string {
  return place.kind === "category" ? place.name : (FIXED_LABELS[place.kind] ?? place.kind);
}

export interface PlaceRow {
  readonly place: Place;
  readonly id: string;
  readonly label: string;
  /** Record counts, share of the board, or what the page holds. */
  readonly meta: string;
  /** Open requests or held drafts, shown as a badge. */
  readonly badge?: number;
  readonly pinned?: boolean;
}

export function recordCount(category: Category): number {
  return category.summary?.rowCount ?? 0;
}

/** Records held and the share of the whole board they are, when both are known. */
export function describeCategory(category: Category, total: number): string {
  const count = recordCount(category);
  if (count === 0) return category.dashboard ? "dashboard only" : "nothing stored yet";
  const share = shareOfTotal(count, total);
  return share > 0 ? `${count} records \u00b7 ${share}% of board` : `${count} records`;
}

/** Pinned entries first, in pin order, then the rest alphabetically. */
export function orderedCategories(
  workspace: Workspace,
  pinned: readonly string[],
): readonly Category[] {
  const all = [...Object.values(workspace.categories)].sort((a, b) => a.name.localeCompare(b.name));
  const rank = (name: string): number => {
    const at = pinned.indexOf(name);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...all].sort((a, b) => rank(a.name) - rank(b.name));
}

export interface PlaceCounts {
  readonly openRequests: number;
  readonly heldDrafts: number;
  readonly datasets: number;
  /** Loops on the board, and how many of them want a person right now. */
  readonly loops: number;
  readonly loopsStuck: number;
}

function categoryRows(
  categories: readonly Category[],
  pinned: readonly string[],
): readonly PlaceRow[] {
  const total = categories.reduce((sum, category) => sum + recordCount(category), 0);
  return categories.map((category) => ({
    place: { kind: "category", name: category.name } as const,
    id: `category:${category.name}`,
    label: category.name,
    meta: describeCategory(category, total),
    pinned: pinned.includes(category.name),
  }));
}

/** The whole rail, in the order docs/UI.md asks for: overview, categories, then pages. */
export function placeRows(
  workspace: Workspace,
  pinned: readonly string[],
  counts: PlaceCounts,
): readonly PlaceRow[] {
  const categories = orderedCategories(workspace, pinned);
  const monitors = Object.keys(workspace.monitors).length;
  return [
    {
      place: OVERVIEW,
      id: "overview",
      label: "Overview",
      meta: `${categories.length} ${categories.length === 1 ? "category" : "categories"}`,
    },
    ...categoryRows(categories, pinned),
    {
      place: { kind: "loops" },
      id: "loops",
      label: "Loops",
      meta: counts.loops === 0 ? "nothing running" : `${counts.loops} running`,
      ...(counts.loopsStuck > 0 ? { badge: counts.loopsStuck } : {}),
    },
    {
      place: { kind: "monitors" },
      id: "monitors",
      label: "Monitors",
      meta: monitors === 0 ? "none registered" : `${monitors} registered`,
      ...(counts.heldDrafts > 0 ? { badge: counts.heldDrafts } : {}),
    },
    {
      place: { kind: "datasets" },
      id: "datasets",
      label: "Datasets",
      meta: counts.datasets === 0 ? "drop a file" : `${counts.datasets} in this tab`,
    },
    {
      place: REQUESTS,
      id: "requests",
      label: "Requests",
      meta: counts.openRequests === 0 ? "nothing open" : `${counts.openRequests} open`,
      ...(counts.openRequests > 0 ? { badge: counts.openRequests } : {}),
    },
    {
      place: { kind: "activity" },
      id: "activity",
      label: "Activity",
      meta: `${workspace.audit.length} events`,
    },
    { place: { kind: "about" }, id: "about", label: "About", meta: "what this is" },
  ];
}

const MONITORS: Place = { kind: "monitors" };
const DATASETS: Place = { kind: "datasets" };

const TOOL_PLACES: Readonly<Record<string, Place>> = {
  compose_overview: OVERVIEW,
  register_monitor: MONITORS,
  report_monitor_run: MONITORS,
  approve_draft: MONITORS,
  decline_draft: MONITORS,
  set_policy: MONITORS,
  attach_dataset: DATASETS,
  get_dataset_profile: DATASETS,
  aggregate_dataset: DATASETS,
  list_datasets: DATASETS,
  feedback: REQUESTS,
  list_feedback: REQUESTS,
  resolve_feedback: REQUESTS,
};

/**
 * Where clicking an event in the live feed lands. A tool that names a category goes to
 * that category page, everything else to the page that owns it, and anything unknown
 * stays where it is rather than guessing.
 */
export function placeForEvent(event: AuditEvent, workspace: Workspace): Place | null {
  const name = argValue(event.argsPreview, "category") ?? argValue(event.argsPreview, "name");
  if (name !== undefined && workspace.categories[name] !== undefined) {
    return { kind: "category", name };
  }
  return (event.tool === undefined ? undefined : TOOL_PLACES[event.tool]) ?? null;
}
