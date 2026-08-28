/**
 * ADAPTER: dashboard renderers. Wired to src/dsl (A1), which ships its own styles.css.
 * The shell imports the DSL through these three names only.
 */
export { CategoryCard as CategoryPanel, DashboardView as DashboardPanel, OverviewView as OverviewPanel } from "../../dsl";
