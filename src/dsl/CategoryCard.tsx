/**
 * Compact card for the categories list: name, description, provenance badge,
 * the two readiness pills, and a slot the shell fills with its own controls.
 */

import type { ReactNode } from "react";
import type { Category } from "../types";
import "./styles.css";

export interface CategoryCardProps {
  readonly category: Category;
  readonly selected?: boolean;
  readonly onSelect?: (name: string) => void;
  readonly children?: ReactNode;
}

export function CategoryCard({ category, selected = false, onSelect, children }: CategoryCardProps) {
  const className = selected ? "mfw-dsl mfw-card mfw-cat mfw-cat--selected" : "mfw-dsl mfw-card mfw-cat";
  return (
    <article className={className} aria-label={`Category ${category.name}`}>
      <div className="mfw-cat__top">
        {onSelect ? (
          <button type="button" className="mfw-cat__name" onClick={() => onSelect(category.name)}>
            {category.name}
          </button>
        ) : (
          <h3 className="mfw-cat__name">{category.name}</h3>
        )}
        {category.provenance ? (
          <span className="mfw-cat__badge" title={category.provenance}>
            {category.provenance}
          </span>
        ) : null}
      </div>

      {category.description ? <p className="mfw-cat__desc">{category.description}</p> : null}

      <div className="mfw-pills">
        <Pill on={Boolean(category.summary)} onLabel="summary stored" offLabel="summary pending" />
        <Pill on={Boolean(category.dashboard)} onLabel="dashboard ready" offLabel="dashboard pending" />
      </div>

      {children ? <div className="mfw-cat__slot">{children}</div> : null}
    </article>
  );
}

interface PillProps {
  readonly on: boolean;
  readonly onLabel: string;
  readonly offLabel: string;
}

function Pill({ on, onLabel, offLabel }: PillProps) {
  return <span className={on ? "mfw-pill mfw-pill--on" : "mfw-pill"}>{on ? onLabel : offLabel}</span>;
}
