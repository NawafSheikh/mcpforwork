/**
 * The "AI Intelligence" block: the narrative the agent wrote, rendered as
 * severity-tagged callouts rather than a bullet list. The sparkles chip is the
 * trust cue that this text came from the agent, not from the page.
 */

import { insightSeverity } from "./insights";
import "./styles.css";

export interface InsightBlockProps {
  readonly label: string;
  readonly items: readonly string[];
  /** One grey line under the heading saying where the text came from. */
  readonly caption?: string;
  /** Numbers the callouts, the way an executive brief does. */
  readonly numbered?: boolean;
}

export function InsightBlock({ label, items, caption, numbered = false }: InsightBlockProps) {
  if (items.length === 0) return null;
  return (
    <section className="mfw-card mfw-insights" aria-label={label}>
      <header className="mfw-insights__head">
        <span className="mfw-sparkles" aria-hidden="true">
          {"\u2728"}
        </span>
        <div>
          <h4 className="mfw-insights__title">{label}</h4>
          {caption ? <p className="mfw-insights__caption">{caption}</p> : null}
        </div>
      </header>
      <ul className="mfw-insights__list">
        {items.map((item, index) => (
          <li key={`${label}-${index}`} className={`mfw-insight mfw-insight--${insightSeverity(item)}`}>
            {numbered ? <span className="mfw-insight__index">{index + 1}</span> : null}
            <span className="mfw-insight__text">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
