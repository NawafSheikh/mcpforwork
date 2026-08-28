/**
 * Targeted prompts a human can hand back to the agent.
 * Every one names the exact tools to call, in order, so the agent edits what is
 * already on the page instead of rebuilding it from nothing. Pure strings.
 */

export const SITE = "mcpforwork.com";

/** Ask for a change to one whole dashboard. */
export function dashboardPrompt(category: string): string {
  return (
    `On ${SITE}, call list_feedback for the dashboard '${category}', then get_dashboard for ` +
    `'${category}', then upsert_dashboard with the change I asked for. Keep every KPI and chart ` +
    `I did not mention, and call resolve_feedback when you are done.`
  );
}

/** Ask for a change to one chart, by its title, without losing the others. */
export function chartPrompt(category: string, chartTitle: string): string {
  return (
    `On ${SITE}, call get_dashboard for '${category}', then upsert_dashboard with the ` +
    `'${chartTitle}' chart split by a different field than it uses now. Keep the other charts ` +
    `and the KPIs exactly as they are.`
  );
}

/** Ask for a change to the cross-category overview. */
export function overviewPrompt(): string {
  return (
    `On ${SITE}, call list_feedback for the overview, then get_workspace, then compose_overview ` +
    `with up to six KPIs that span every category and the highlights that explain them. ` +
    `Keep the charts that are already there.`
  );
}

/** Ask for a change to one overview chart. */
export function overviewChartPrompt(chartTitle: string): string {
  return (
    `On ${SITE}, call get_workspace, then compose_overview with the '${chartTitle}' chart ` +
    `comparing the categories a different way. Keep the other charts and the KPIs.`
  );
}

/** Partial state: aggregates are stored but no dashboard was ever built. */
export function buildDashboardPrompt(category: string, facts: readonly string[]): string {
  const detail = facts.length > 0 ? ` The stored aggregates are: ${facts.join("; ")}.` : "";
  return (
    `On ${SITE}, call get_dashboard for '${category}' to see what is there, then ` +
    `upsert_dashboard for '${category}' with up to four KPIs and up to four charts built from ` +
    `the aggregates already on the page.${detail}`
  );
}

/** Empty category: nothing stored yet at all. */
export function firstDashboardPrompt(category: string): string {
  return (
    `On ${SITE}, call upsert_dataset_summary for '${category}' with the aggregates you counted, ` +
    `then upsert_dashboard for '${category}' with up to four KPIs and up to four charts. ` +
    `Send aggregates only, never raw records.`
  );
}
