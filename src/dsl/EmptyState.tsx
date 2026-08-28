/** Shared empty state. Every empty slot in the DSL says what would fill it. */

import "./styles.css";

export interface EmptyStateProps {
  readonly title: string;
  readonly hint?: string;
  readonly inline?: boolean;
}

export function EmptyState({ title, hint, inline = false }: EmptyStateProps) {
  return (
    <div className={inline ? "mfw-empty mfw-empty--inline" : "mfw-empty"}>
      <p className="mfw-empty__title">{title}</p>
      {hint ? <p className="mfw-empty__hint">{hint}</p> : null}
    </div>
  );
}
