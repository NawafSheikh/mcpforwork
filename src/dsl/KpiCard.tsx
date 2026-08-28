/** KPI card and the KPI row. Values use tabular numerals so columns line up. */

import type { KPI } from "../types";
import { deltaTone, formatValue } from "./format";
import "./styles.css";

export interface KpiCardProps {
  readonly kpi: KPI;
}

export function KpiCard({ kpi }: KpiCardProps) {
  return (
    <article className="mfw-card mfw-kpi">
      <p className="mfw-kpi__label">{kpi.label}</p>
      <p className="mfw-kpi__value">{formatValue(kpi.value)}</p>
      <div className="mfw-kpi__foot">
        {kpi.delta ? <span className={`mfw-delta mfw-delta--${deltaTone(kpi.delta)}`}>{kpi.delta}</span> : null}
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
