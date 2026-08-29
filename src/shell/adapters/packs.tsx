/**
 * ADAPTER: tool packs and capability cards (owner A20, src/packs and src/capabilities).
 *
 * The shell mounts the packs panel in the Tools popover and the capability cards in the
 * left rail. Both read the store through useShell(), so both must stay inside the
 * provider; neither takes props here on purpose, so this file is the only seam.
 */
export { PacksPanel } from "../../packs";
export { CapabilityCards } from "../../capabilities";
