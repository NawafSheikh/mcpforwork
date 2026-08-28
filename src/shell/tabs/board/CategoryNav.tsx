/**
 * Category navigation: a persistent sidebar on wide screens, a scrolling chip
 * strip on narrow ones, from the same list. Selecting a row swaps the main view
 * in React state, never by navigation, so the registered site tools stay alive.
 */

import { categoryIcon, shareOfTotal } from "../../../dsl";
import type { Category } from "../../../types";
import "./board.css";

export const OVERVIEW_ID = "overview";

export interface CategoryNavProps {
  readonly categories: readonly Category[];
  readonly selected: string;
  readonly onSelect: (id: string) => void;
  readonly pinned: readonly string[];
}

export function CategoryNav({ categories, selected, onSelect, pinned }: CategoryNavProps): JSX.Element {
  const total = categories.reduce((sum, category) => sum + recordCount(category), 0);

  return (
    <nav className="mfw-nav" aria-label="Categories">
      <ul className="mfw-nav__list">
        <li>
          <button
            type="button"
            className={rowClass(selected === OVERVIEW_ID)}
            aria-current={selected === OVERVIEW_ID ? "true" : undefined}
            onClick={() => onSelect(OVERVIEW_ID)}
          >
            <span className="mfw-nav__icon mfw-nav__icon--overview" aria-hidden="true">
              {"\u{1F3E2}"}
            </span>
            <span className="mfw-nav__body">
              <span className="mfw-nav__name">Overview</span>
              <span className="mfw-nav__meta">
                {categories.length} {categories.length === 1 ? "category" : "categories"}
              </span>
            </span>
          </button>
        </li>

        {categories.map((category) => (
          <li key={category.name}>
            <button
              type="button"
              className={rowClass(selected === category.name)}
              aria-current={selected === category.name ? "true" : undefined}
              onClick={() => onSelect(category.name)}
            >
              <span
                className={`mfw-nav__icon mfw-nav__icon--t${categoryIcon(category.name).tone}`}
                aria-hidden="true"
              >
                {categoryIcon(category.name).glyph}
              </span>
              <span className="mfw-nav__body">
                <span className="mfw-nav__name">
                  {pinned.includes(category.name) ? (
                    <span className="mfw-nav__pin" aria-label="pinned">
                      {"★"}
                    </span>
                  ) : null}
                  {category.name}
                </span>
                <span className="mfw-nav__meta">{describe(category, total)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Records held and the share of the whole board they are, when both are known. */
export function describe(category: Category, total: number): string {
  const count = recordCount(category);
  if (count === 0) return category.dashboard ? "dashboard only" : "nothing stored yet";
  const share = shareOfTotal(count, total);
  return share > 0 ? `${count} records · ${share}% of board` : `${count} records`;
}

export function recordCount(category: Category): number {
  return category.summary?.rowCount ?? 0;
}

function rowClass(active: boolean): string {
  return active ? "mfw-nav__row mfw-nav__row--on" : "mfw-nav__row";
}
