/** Header and bullet list shared by the dashboard and overview renderers. */

import "./styles.css";

export interface SpecHeaderProps {
  readonly title: string;
  readonly meta: string;
  readonly source?: string;
}

export function SpecHeader({ title, meta, source }: SpecHeaderProps) {
  return (
    <header className="mfw-head">
      <div>
        <h2 className="mfw-head__title">{title}</h2>
        <p className="mfw-head__meta">{meta}</p>
      </div>
      {source ? <span className="mfw-head__source">{source}</span> : null}
    </header>
  );
}

export interface BulletListProps {
  readonly label: string;
  readonly items: readonly string[];
}

export function BulletList({ label, items }: BulletListProps) {
  return (
    <section className="mfw-card">
      <p className="mfw-notes__label">{label}</p>
      <ul className="mfw-notes">
        {items.map((item, index) => (
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
