export type WorkflowStatus = "active" | "draft" | "paused";
export type ExecutionStatus = "completed" | "running" | "failed" | "waiting";
export type WorkflowSummary = { id: string; name: string; status: WorkflowStatus; category: string };
export type ExecutionSummary = { status: ExecutionStatus; durationMs: number; cost: number };

export function filterWorkflows<T extends WorkflowSummary>(items: T[], query: string, status: WorkflowStatus | "all") {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => (status === "all" || item.status === status) &&
    (!normalized || `${item.name} ${item.category}`.toLowerCase().includes(normalized)));
}

export function summarizeExecutions(items: ExecutionSummary[]) {
  if (!items.length) return { total: 0, successRate: 0, averageDurationMs: 0, totalCost: 0 };
  const completed = items.filter((item) => item.status === "completed").length;
  return {
    total: items.length,
    successRate: Math.round((completed / items.length) * 100),
    averageDurationMs: Math.round(items.reduce((sum, item) => sum + item.durationMs, 0) / items.length),
    totalCost: Number(items.reduce((sum, item) => sum + item.cost, 0).toFixed(2)),
  };
}
