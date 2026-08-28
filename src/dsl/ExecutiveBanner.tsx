/**
 * The executive summary banner: the one gradient surface on the board.
 * Overview KPIs become translucent stat tiles on it, and the agent's highlights
 * sit underneath as numbered lines, so the top of the page reads as a brief.
 */

import type { ReactNode } from "react";
import type { KPI } from "../types";
import { formatValue } from "./format";
import { kpiIcon } from "./icons";
import "./styles.css";

export interface ExecutiveBannerProps {
  readonly title: string;
  readonly meta: string;
  readonly kpis: readonly KPI[];
  readonly highlights?: readonly string[];
  readonly titleNode?: ReactNode;
  readonly actions?: ReactNode;
}

export function ExecutiveBanner({
  title,
  meta,
  kpis,
  highlights = [],
  titleNode,
  actions,
}: ExecutiveBannerProps) {
  return (
    <section className="mfw-banner" aria-label="Executive summary">
      <header className="mfw-banner__head">
        <div className="mfw-banner__main">
          {titleNode ?? <h2 className="mfw-banner__title">{title}</h2>}
          <p className="mfw-banner__meta">{meta}</p>
        </div>
        {actions ? <div className="mfw-banner__actions">{actions}</div> : null}
      </header>

      {kpis.length > 0 ? (
        <div className="mfw-banner__tiles">
          {kpis.map((kpi, index) => (
            <article className="mfw-tile" key={`${kpi.label}-${index}`}>
              <p className="mfw-tile__label">
                <span aria-hidden="true">{kpiIcon(kpi.label)}</span> {kpi.label}
              </p>
              <p className="mfw-tile__value">{formatValue(kpi.value)}</p>
              <p className="mfw-tile__qualifier">{qualifier(kpi)}</p>
            </article>
          ))}
        </div>
      ) : null}

      {highlights.length > 0 ? (
        <ol className="mfw-banner__highlights">
          {highlights.map((line, index) => (
            <li key={`highlight-${index}`}>
              <span className="mfw-banner__index">{index + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** Every big number gets a line answering "compared to what". */
function qualifier(kpi: KPI): string {
  const parts = [kpi.delta?.trim(), kpi.hint?.trim()].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" \u00b7 ") : "as reported by the agent";
}
