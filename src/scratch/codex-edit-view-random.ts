export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "in_progress" | "done";

export interface WorkItem {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  estimate: {
    optimistic: number;
    likely: number;
    pessimistic: number;
  };
  tags: string[];
  blockedBy?: string[];
  owner?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ScheduleSummary {
  totalItems: number;
  totalLikelyHours: number;
  riskAdjustedHours: number;
  averageLikelyHours: number;
  byPriority: Record<Priority, number>;
  byStatus: Record<Status, number>;
  blockedCount: number;
  owners: string[];
  criticalPath: string[];
}

export const sampleItems: WorkItem[] = [
  {
    id: "T-100",
    title: "Set up CI",
    priority: "high",
    status: "done",
    estimate: { optimistic: 3, likely: 5, pessimistic: 8 },
    tags: ["devops", "infra"],
    owner: "dana",
    metadata: { repo: "agents-hub", pipeline: true },
  },
  {
    id: "T-101",
    title: "Build onboarding flow",
    priority: "medium",
    status: "in_progress",
    estimate: { optimistic: 8, likely: 13, pessimistic: 21 },
    tags: ["frontend", "ux"],
    blockedBy: ["T-099"],
    owner: "mika",
  },
  {
    id: "T-102",
    title: "Audit data layer",
    priority: "low",
    status: "todo",
    estimate: { optimistic: 5, likely: 8, pessimistic: 13 },
    tags: ["backend", "db"],
    owner: "dana",
  },
];

const PRIORITY_WEIGHT: Record<Priority, number> = {
  low: 0.9,
  medium: 1,
  high: 1.25,
};
const DEFAULT_OWNER = "unassigned";

function effectiveLikelyEstimate(item: WorkItem): number {
  const modifier = typeof item.metadata?.effortMultiplier === "number"
    ? Number(item.metadata.effortMultiplier)
    : 1;
  return Number((item.estimate.likely * modifier).toFixed(2));
}

function listOwners(items: WorkItem[]): string[] {
  return [
    ...new Set(
      items
        .map((item) => item.owner?.trim().toLowerCase() || DEFAULT_OWNER)
        .filter((owner): owner is string => owner.length > 0),
    ),
  ].sort();
}

function computeCriticalPath(items: WorkItem[]): string[] {
  return [...items]
    .filter((item) => item.priority === "high" || (item.blockedBy?.length ?? 0) > 0)
    .sort((a, b) => b.estimate.likely - a.estimate.likely)
    .map((item) => item.id);
}

export function summarizeSchedule(
  items: WorkItem[],
  options: { includeDone?: boolean } = {},
): ScheduleSummary {
  const includeDone = options.includeDone ?? true;
  const relevantItems = includeDone ? items : items.filter((item) => item.status !== "done");
  const doneIds = new Set(
    relevantItems
      .filter((item) => item.status === "done")
      .map((item) => item.id),
  );

  const byPriority: Record<Priority, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };
  const byStatus: Record<Status, number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
  };

  let totalLikelyHours = 0;
  let riskAdjustedHours = 0;
  let blockedCount = 0;

  for (const item of relevantItems) {
    byPriority[item.priority] += 1;
    byStatus[item.status] += 1;
    totalLikelyHours += effectiveLikelyEstimate(item);
    riskAdjustedHours += item.estimate.pessimistic * PRIORITY_WEIGHT[item.priority];

    const blockers = item.blockedBy ?? [];
    if (blockers.length > 0) {
      const hasUnfinishedBlocker = blockers.some((blockerId) => !doneIds.has(blockerId));
      if (item.status !== "done" || hasUnfinishedBlocker) {
        blockedCount += 1;
      }
    }
  }

  return {
    totalItems: relevantItems.length,
    totalLikelyHours,
    riskAdjustedHours: Number(riskAdjustedHours.toFixed(2)),
    averageLikelyHours: relevantItems.length === 0 ? 0 : totalLikelyHours / relevantItems.length,
    byPriority,
    byStatus,
    blockedCount,
    owners: listOwners(relevantItems),
    criticalPath: computeCriticalPath(relevantItems),
  };
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

export function planByTag(items: WorkItem[]): Map<string, WorkItem[]> {
  const bucket = new Map<string, WorkItem[]>();

  for (const item of items) {
    const uniqueTags = new Set(
      item.tags
        .map((tag) => normalizeTag(tag))
        .filter((tag) => tag.length > 0),
    );
    for (const tag of uniqueTags) {
      const existing = bucket.get(tag);
      if (existing) {
        existing.push(item);
      } else {
        bucket.set(tag, [item]);
      }
    }
  }

  return bucket;
}

export function buildOwnerWorkload(items: WorkItem[]): Map<string, number> {
  const workload = new Map<string, number>();

  for (const item of items) {
    const owner = item.owner?.trim().toLowerCase() || DEFAULT_OWNER;
    const current = workload.get(owner) ?? 0;
    workload.set(owner, current + effectiveLikelyEstimate(item));
  }

  return new Map([...workload.entries()].sort((a, b) => b[1] - a[1]));
}

function formatTagCounts(plan: Map<string, WorkItem[]>): string {
  return [...plan.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, taggedItems]) => `${tag}(${taggedItems.length})`)
    .join(", ");
}

export async function applyStatusTransitions(
  items: WorkItem[],
  transitions: Partial<Record<WorkItem["id"], Status>>,
  latencyMs = 4,
): Promise<WorkItem[]> {
  await new Promise((resolve) => setTimeout(resolve, latencyMs));

  return items.map((item) => {
    const nextStatus = transitions[item.id];
    if (!nextStatus || nextStatus === item.status) {
      return item;
    }

    return {
      ...item,
      status: nextStatus,
      metadata: {
        ...item.metadata,
        transitionedAt: new Date().toISOString(),
      },
    };
  });
}

export function printScheduleReport(items: WorkItem[], includeDone = true): string {
  const summary = summarizeSchedule(items, { includeDone });
  const tags = planByTag(items);
  const ownerWorkload = buildOwnerWorkload(items);

  const lines: string[] = [
    `Items: ${summary.totalItems} (done included: ${includeDone})`,
    `Likely Hours: ${summary.totalLikelyHours}`,
    `Risk Adjusted Hours: ${summary.riskAdjustedHours.toFixed(1)}`,
    `Avg Likely: ${summary.averageLikelyHours.toFixed(1)}`,
    `Blocked: ${summary.blockedCount}`,
    `Priorities: H=${summary.byPriority.high}, M=${summary.byPriority.medium}, L=${summary.byPriority.low}`,
    `Status: todo=${summary.byStatus.todo}, in_progress=${summary.byStatus.in_progress}, done=${summary.byStatus.done}`,
    `Owners: ${summary.owners.join(", ") || "none"}`,
    `Owner Load: ${[...ownerWorkload.entries()].map(([owner, hours]) => `${owner}=${hours.toFixed(1)}h`).join(", ") || "none"}`,
    `Critical Path: ${summary.criticalPath.join(" -> ") || "none"}`,
    `Tags: ${formatTagCounts(tags) || "none"}`,
  ];

  return lines.join("\n");
}
