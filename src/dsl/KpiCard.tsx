/**
 * KPI card and the KPI row. Icon chip, label, big number, a qualifier line that
 * says what the number is measured against, and a signed delta coloured by tone.
 * Values use tabular numerals so a row of cards lines up.
 */

import type { KPI } from "../types";
import { deltaTone, formatValue, type DeltaTone } from "./format";
import { kpiIcon } from "./icons";
import "./styles.css";

const ARROWS: Readonly<Record<DeltaTone, string>> = {
  up: "\u2191",
  down: "\u2193",
  flat: "\u2192",
};

export interface KpiCardProps {
  readonly kpi: KPI;
}

export function KpiCard({ kpi }: KpiCardProps) {
  const tone = deltaTone(kpi.delta);
  return (
    <article className="mfw-card mfw-kpi">
      <div className="mfw-kpi__top">
        <span className="mfw-kpi__icon" aria-hidden="true">
          {kpiIcon(kpi.label)}
        </span>
        <p className="mfw-kpi__label">{kpi.label}</p>
      </div>
      <p className="mfw-kpi__value">{formatValue(kpi.value)}</p>
      <div className="mfw-kpi__foot">
        {kpi.delta ? (
          <span className={`mfw-delta mfw-delta--${tone}`}>
            <span aria-hidden="true">{ARROWS[tone]}</span> {kpi.delta}
          </span>
        ) : null}
        {kpi.hint ? <span className="mfw-kpi__hint">{kpi.hint}</span> : null}
      </div>
    </article>
  );
}

export interface KpiGridProps {
  readonly kpis: readonly KPI[];
}

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className="mfw-kpis">
      {kpis.map((kpi, index) => (
        <KpiCard key={`${kpi.label}-${index}`} kpi={kpi} />
      ))}
    </div>
  );
}
