/**
 * Size caps for anything read back out of a share fragment.
 * The board's own LIMITS govern what an agent may write; these govern what a stranger's
 * link may claim, so they are never larger than the LIMITS they mirror.
 */
import { LIMITS } from "../types";

export const CAP = {
  /** strings */
  name: 120,
  title: 120,
  label: 60,
  hint: 120,
  delta: 40,
  description: 300,
  provenance: 200,
  note: 200,
  text: LIMITS.maxFeedbackChars,
  schedule: 80,
  kind: 40,
  target: 120,
  summary: 300,
  clause: 120,

  /** collections */
  categories: LIMITS.maxCategories,
  kpis: LIMITS.maxKpis,
  overviewKpis: 6,
  charts: LIMITS.maxCharts,
  points: LIMITS.maxPointsPerChart,
  rows: LIMITS.maxTableRows,
  columns: 8,
  notes: 6,
  highlights: 6,
  summaryKeys: 24,
  topLists: 8,
  topItems: 12,
  policyList: 50,
  thresholds: 10,
  monitors: 24,
  runs: 20,
  findings: 20,
  draftIds: 20,
  drafts: 60,
  fields: 12,
  feedback: LIMITS.maxFeedbackItems,
} as const;
