/**
 * Theme: light is the default, dark is opt in, the choice lives in localStorage.
 * Dark sets data-theme="dark" on <html>; light removes the attribute so :root wins.
 * Every switch fires a "themechange" event, because charts pick their palette once.
 */

export type Theme = "light" | "dark";

export const THEME_KEY = "mfw:theme";
export const THEME_EVENT = "themechange";

function root(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

/** Storage can throw in private mode, so every read and write is guarded. */
export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* a theme that cannot be remembered is not worth failing a render over */
  }
}

export function currentTheme(): Theme {
  return root()?.dataset.theme === "dark" ? "dark" : "light";
}

/** Apply without persisting. Used on boot, before the first paint. */
export function applyTheme(theme: Theme): void {
  const element = root();
  if (element === null) return;
  if (theme === "dark") element.dataset.theme = "dark";
  else delete element.dataset.theme;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

/** Apply and remember. Used by the header toggle. */
export function setTheme(theme: Theme): Theme {
  applyTheme(theme);
  storeTheme(theme);
  return theme;
}

/** Boot: adopt the stored choice, defaulting to light. */
export function initTheme(): Theme {
  const theme = readStoredTheme() ?? "light";
  applyTheme(theme);
  return theme;
}
