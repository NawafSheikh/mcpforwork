/**
 * The clickable category cards under the overview. Same list as the sidebar,
 * same state, second way in: a human can open a category from the nav or by
 * clicking its card. The footer row is the whole affordance, no extra button.
 */

import { categoryIcon } from "../../../dsl";
import { CategoryCard } from "../../../dsl";
import type { Category } from "../../../types";
import { describe, recordCount } from "./CategoryNav";
import "./board.css";

export interface DomainGridProps {
  readonly categories: readonly Category[];
  readonly onOpen: (name: string) => void;
  readonly pinned: readonly string[];
  readonly onPin?: (name: string) => void;
}

export function DomainGrid({ categories, onOpen, pinned, onPin }: DomainGridProps): JSX.Element | null {
  if (categories.length === 0) return null;
  const total = categories.reduce((sum, category) => sum + recordCount(category), 0);

  return (
    <div className="mfw-domains">
      {categories.map((category) => (
        <CategoryCard
          key={category.name}
          category={category}
          onSelect={onOpen}
          icon={
            <span className="mfw-cat__icon" aria-hidden="true">
              {categoryIcon(category.name).glyph}
            </span>
          }
        >
          <div className="mfw-domain__foot">
            <span className="mfw-domain__count">{describe(category, total)}</span>
            <span className="mfw-domain__spacer" />
            {onPin ? (
              <button
                type="button"
                className={pinned.includes(category.name) ? "mfw-pinbtn mfw-pinbtn--on" : "mfw-pinbtn"}
                onClick={() => onPin(category.name)}
                aria-pressed={pinned.includes(category.name)}
                title={pinned.includes(category.name) ? "Unpin category" : "Pin category"}
              >
                {"★"}
              </button>
            ) : null}
            <button type="button" className="mfw-domain__link" onClick={() => onOpen(category.name)}>
              View details {"→"}
            </button>
          </div>
        </CategoryCard>
      ))}
    </div>
  );
}
