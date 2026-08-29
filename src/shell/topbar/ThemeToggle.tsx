/** Light by default, dark on request, remembered in this browser. */
import { useCallback, useState } from "react";
import { currentTheme, setTheme, type Theme } from "../lib/theme";

export function ThemeToggle(): JSX.Element {
  const [theme, setLocal] = useState<Theme>(() => currentTheme());
  const onToggle = useCallback(() => {
    setLocal(setTheme(theme === "dark" ? "light" : "dark"));
  }, [theme]);
  return (
    <button
      type="button"
      className="mfw-btn mfw-theme-toggle"
      aria-label="Switch theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{theme === "dark" ? "\u2600" : "\u263D"}</span>
    </button>
  );
}
