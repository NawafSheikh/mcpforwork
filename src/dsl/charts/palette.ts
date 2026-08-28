/**
 * Chart palettes and the concrete colours recharts needs.
 * Recharts writes strokes and fills into SVG attributes, so a CSS variable
 * string is unreliable there: both themes ship as literal hex values and the
 * renderer picks one from the document theme (see ./theme.ts).
 * The hex values mirror the --mfw-* tokens in src/styles/app.css.
 */

export type ThemeMode = "light" | "dark";

/** Saturated categorical set, tuned to read on a white surface. */
export const LIGHT_CHART_COLORS = [
  "#2f6fed",
  "#e8710a",
  "#0f9d8c",
  "#8b5cf6",
  "#d6455e",
  "#0b7285",
] as const;

/** The same hues lifted for a dark surface. */
export const DARK_CHART_COLORS = [
  "#5aa9ff",
  "#f0a75a",
  "#4fd1c5",
  "#c792ea",
  "#ff8fa3",
  "#7dd3fc",
] as const;

/** Kept for callers that only ever draw the default (light) board. */
export const CHART_COLORS = LIGHT_CHART_COLORS;
export const FALLBACK_COLOR = "#2f6fed";

/** Every chart body is this tall, so a dashboard row lines up. */
export const CHART_HEIGHT = 220;

export interface TooltipTheme {
  readonly contentStyle: Record<string, string | number>;
  readonly labelStyle: Record<string, string | number>;
  readonly itemStyle: Record<string, string | number>;
}

export interface ChartTheme {
  readonly mode: ThemeMode;
  readonly colors: readonly string[];
  readonly grid: string;
  readonly cursor: string;
  readonly tick: { readonly fill: string; readonly fontSize: number };
  readonly axisLine: { readonly stroke: string };
  readonly legend: Record<string, string | number>;
  readonly tooltip: TooltipTheme;
}

const LIGHT: ChartTheme = {
  mode: "light",
  colors: LIGHT_CHART_COLORS,
  grid: "rgba(20, 38, 60, 0.1)",
  cursor: "rgba(47, 111, 237, 0.07)",
  tick: { fill: "#5b6b7e", fontSize: 11 },
  axisLine: { stroke: "rgba(20, 38, 60, 0.12)" },
  legend: { fontSize: 11, color: "#5b6b7e" },
  tooltip: tooltipTheme("#ffffff", "#d8e0ea", "#14263c", "#5b6b7e", "rgba(20, 38, 60, 0.14)"),
};

const DARK: ChartTheme = {
  mode: "dark",
  colors: DARK_CHART_COLORS,
  grid: "rgba(230, 237, 243, 0.12)",
  cursor: "rgba(90, 169, 255, 0.12)",
  tick: { fill: "#93a1b0", fontSize: 11 },
  axisLine: { stroke: "rgba(230, 237, 243, 0.14)" },
  legend: { fontSize: 11, color: "#93a1b0" },
  tooltip: tooltipTheme("#131a22", "#263141", "#e6edf3", "#93a1b0", "rgba(0, 0, 0, 0.45)"),
};

/** Frozen theme object for one mode. Stable identity, safe in render. */
export function chartTheme(mode: ThemeMode): ChartTheme {
  return mode === "dark" ? DARK : LIGHT;
}

/** Colour for the nth series, wrapping around the given palette. */
export function colorAt(index: number, colors: readonly string[] = LIGHT_CHART_COLORS): string {
  const safe = colors.length > 0 ? Math.abs(Math.trunc(index)) % colors.length : 0;
  return colors[safe] ?? FALLBACK_COLOR;
}

function tooltipTheme(
  background: string,
  border: string,
  ink: string,
  muted: string,
  shadow: string,
): TooltipTheme {
  return {
    contentStyle: {
      background,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: "8px 10px",
      fontSize: 12,
      color: ink,
      boxShadow: `0 12px 30px ${shadow}`,
    },
    labelStyle: { color: muted, marginBottom: 4 },
    itemStyle: { color: ink, padding: 0 },
  };
}
