/**
 * The work-pack catalog (docs/PACKS.md).
 *
 * None of these are on the site. They arrive through a local bridge on the visitor's own
 * machine, which is why each one names what it needs there. Listed here so a visitor can
 * see what the shape is for before any of it exists: free packs first, one line each.
 */

import type { PackRisk } from "../types";

export type CatalogStatus = "site" | "bridge" | "coming";

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  /** One line: what it does, and what it needs on the machine. */
  readonly line: string;
  readonly risk: PackRisk;
  readonly status: CatalogStatus;
}

export const WORK_PACKS: readonly CatalogEntry[] = [
  {
    id: "teams",
    name: "Teams",
    line: "Read a channel and post a message, through the signed-in desktop client.",
    risk: "send",
    status: "coming",
  },
  {
    id: "powerapps",
    name: "Power Apps canvas",
    line: "Open an app, read its screens and edit a control, through the maker session in the browser.",
    risk: "write",
    status: "coming",
  },
  {
    id: "fabric",
    name: "Fabric",
    line: "Query a lakehouse and read a semantic model, with the workspace the person already has.",
    risk: "read",
    status: "coming",
  },
  {
    id: "d365",
    name: "Dynamics 365",
    line: "Read records and draft a change for approval, against the environment on this machine.",
    risk: "write",
    status: "coming",
  },
  {
    id: "zendesk",
    name: "Zendesk",
    line: "Read tickets and draft a reply a person sends, with the agent's own API token.",
    risk: "send",
    status: "coming",
  },
  {
    id: "word",
    name: "Word",
    line: "Read and write a local document, through the installed Office app.",
    risk: "write",
    status: "coming",
  },
  {
    id: "windows",
    name: "Windows",
    line: "List and open files in one folder the person picks. Nothing outside it.",
    risk: "read",
    status: "coming",
  },
  {
    id: "n8n",
    name: "n8n",
    line: "List workflows and start one, against a local n8n instance.",
    risk: "send",
    status: "coming",
  },
];

export function catalogStatusText(status: CatalogStatus): string {
  if (status === "site") return "on this site";
  if (status === "bridge") return "installed locally";
  return "coming";
}
