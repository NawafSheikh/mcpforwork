/**
 * The film's design system. Colours are the product's own light-theme tokens
 * (src/styles/app.css) so the motion graphics and the real screenshots read as
 * one thing, composed in a premium, high-contrast, Apple-ish layout.
 */

export const COLORS = {
  // Surfaces, straight from --mfw-bg / --mfw-surface
  bg: "#F6F8FB",
  bgSubtle: "#EEF2F7",
  bgCard: "#FFFFFF",
  bgInk: "#0B0F14",
  bgInkSoft: "#131A22",

  // Type, from --mfw-text / --mfw-muted
  textPrimary: "#14263C",
  textSecondary: "#4A5C72",
  textTertiary: "#5B6B7E",
  textMuted: "#93A1B0",
  textOnInk: "#E6EDF3",

  // State, from --mfw-accent / ok / warn / danger
  accent: "#2F6FED",
  accentDeep: "#1B4FD0",
  accentSky: "#5AA9FF",
  ok: "#1F9D6B",
  warn: "#B47D0E",
  danger: "#D64545",
  violet: "#6C4BE0",

  // Gradients
  gradientBrand: "linear-gradient(135deg, #2F6FED 0%, #6C4BE0 100%)",
  gradientSky: "linear-gradient(135deg, #2F6FED, #5AA9FF)",
  gradientOk: "linear-gradient(135deg, #1F9D6B, #5AA9FF)",
  gradientHold: "linear-gradient(135deg, #B47D0E, #D64545)",
  gradientInk: "linear-gradient(135deg, #14263C, #2B3D56)",

  border: "rgba(20, 38, 60, 0.08)",
  borderSoft: "rgba(20, 38, 60, 0.05)",
  shadow: "0 1px 2px rgba(20, 38, 60, 0.06), 0 8px 24px rgba(20, 38, 60, 0.08)",
  shadowLg: "0 18px 60px rgba(20, 38, 60, 0.12)",
  shadowXl: "0 40px 110px rgba(20, 38, 60, 0.16), 0 8px 32px rgba(20, 38, 60, 0.08)",
} as const;

export const FONTS = {
  display:
    "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  text: "'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, 'Fira Code', monospace",
} as const;

/** One accent per tool pack, used by the tool grid and the pack rail. */
export const PACK_COLOR: Record<string, string> = {
  board: "#2F6FED",
  workspaces: "#5AA9FF",
  datasets: "#1F9D6B",
  notes: "#6C4BE0",
  turns: "#0E9BA8",
  monitors: "#B47D0E",
  rooms: "#D64545",
};
