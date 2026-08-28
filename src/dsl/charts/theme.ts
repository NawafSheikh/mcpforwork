/**
 * Which chart palette to draw with. The theme lives on the document element as
 * data-theme; the shell dispatches a "themechange" event on window when it flips.
 * A MutationObserver backs that up, so a theme set without the event still lands.
 */

import { useSyncExternalStore } from "react";
import { chartTheme, type ChartTheme, type ThemeMode } from "./palette";

export const THEME_EVENT = "themechange";

/** Light unless the document explicitly asks for dark. */
export function readThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;
  window.addEventListener(THEME_EVENT, onChange);
  const observer =
    typeof MutationObserver === "undefined" ? null : new MutationObserver(() => onChange());
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    observer?.disconnect();
  };
}

function serverMode(): ThemeMode {
  return "light";
}

/** Live theme mode. Re-renders the caller when the document theme changes. */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, readThemeMode, serverMode);
}

/** Live chart theme: colours, grid, ticks and tooltip for the current mode. */
export function useChartTheme(): ChartTheme {
  return chartTheme(useThemeMode());
}
