/** Header and bullet list shared by the dashboard and overview renderers. */

import type { ReactNode } from "react";
import "./styles.css";

export interface SpecHeaderProps {
  readonly title: string;
  readonly meta: string;
  readonly source?: string;
  /** Replaces the plain heading, for example with a click-to-edit control. */
  readonly titleNode?: ReactNode;
  /** Controls pinned to the right of the header. */
  readonly actions?: ReactNode;
}

export function SpecHeader({ title, meta, source, titleNode, actions }: SpecHeaderProps) {
  return (
    <header className="mfw-head">
      <div className="mfw-head__main">
        {titleNode ?? <h2 className="mfw-head__title">{title}</h2>}
        <p className="mfw-head__meta">{meta}</p>
      </div>
      <div className="mfw-head__side">
        {source ? <span className="mfw-head__source">{source}</span> : null}
        {actions}
      </div>
    </header>
  );
}

export interface BulletListProps {
  readonly label: string;
  readonly items: readonly string[];
}

export function BulletList({ label, items }: BulletListProps) {
  return (
    <section className="mfw-card mfw-notes__card">
      <p className="mfw-notes__label">{label}</p>
      <ul className="mfw-notes">
        {items.map((item, index) => (
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
