/**
 * One button, one panel under it. Escape closes it, a click outside closes it, and the
 * panel is plain markup so anything can be put inside, including another popover.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface PopoverProps {
  readonly label: string;
  readonly title?: string;
  /** Number on the button, for open requests and the like. */
  readonly badge?: number;
  readonly children: ReactNode;
  readonly panelClass?: string;
  readonly buttonClass?: string;
  /** Renders already open. Used by the tests and by nothing else. */
  readonly defaultOpen?: boolean;
}

export function Popover({
  label,
  title,
  badge,
  children,
  panelClass = "",
  buttonClass = "mfw-btn",
  defaultOpen = false,
}: PopoverProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent): void => {
      if (!wrap.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, close]);

  return (
    <span
      className="mfw-pop-wrap"
      ref={wrap}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <button
        type="button"
        className={buttonClass}
        aria-expanded={open}
        {...(title === undefined ? {} : { title })}
        {...(badge !== undefined && badge > 0 ? { "aria-label": `${label}, ${badge} open` } : {})}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        {badge !== undefined && badge > 0 ? <span className="mfw-req-badge">{badge}</span> : null}
      </button>
      {open ? <div className={`mfw-pop ${panelClass}`.trim()}>{children}</div> : null}
    </span>
  );
}
