/** Tabs are React state, never navigation, so the registered tools survive. */
import { TAB_IDS, TAB_LABELS } from "./lib/constants";
import type { TabId } from "./lib/constants";

export function TabBar({
  active,
  onSelect,
}: {
  readonly active: TabId;
  readonly onSelect: (tab: TabId) => void;
}): JSX.Element {
  return (
    <nav className="mfw-tabs" role="tablist" aria-label="Workspace sections">
      {TAB_IDS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`mfw-tab-${tab}`}
          aria-selected={tab === active}
          aria-controls={`mfw-panel-${tab}`}
          className={tab === active ? "mfw-tab mfw-tab-active" : "mfw-tab"}
          onClick={() => onSelect(tab)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
