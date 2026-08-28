/**
 * Shared chart palette. The hex values mirror the CSS tokens in ../styles.css,
 * because recharts needs concrete colours rather than CSS variables.
 * Everything here is tuned for the dark surface (--mfw-bg #0b0e14).
 */

export const CHART_COLORS = [
  "#5eb0ff",
  "#4fd1c5",
  "#c792ea",
  "#f6c177",
  "#ff8fa3",
  "#8ee6a0",
] as const;

export const FALLBACK_COLOR = "#5eb0ff";
export const GRID_COLOR = "rgba(233, 237, 246, 0.1)";
export const AXIS_COLOR = "#8b93a7";
export const CURSOR_FILL = "rgba(233, 237, 246, 0.05)";

/** Every chart body is this tall, so a dashboard row lines up. */
export const CHART_HEIGHT = 220;

export const AXIS_TICK = { fill: AXIS_COLOR, fontSize: 11 };
export const AXIS_LINE = { stroke: GRID_COLOR };
export const LEGEND_STYLE = { fontSize: 11, color: AXIS_COLOR };

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#101725",
    border: "1px solid rgba(233, 237, 246, 0.12)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45)",
  },
  labelStyle: { color: AXIS_COLOR, marginBottom: 4 },
  itemStyle: { color: "#e9edf6", padding: 0 },
};

/** Colour for the nth series, wrapping around the palette. */
export function colorAt(index: number): string {
  const safe = Math.abs(Math.trunc(index)) % CHART_COLORS.length;
  return CHART_COLORS[safe] ?? FALLBACK_COLOR;
}
