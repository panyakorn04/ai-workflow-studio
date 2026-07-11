import { describe, expect, test } from "bun:test";
import { filterWorkflows, summarizeExecutions } from "./workflows";

const workflows = [
  { id: "1", name: "Content intelligence", status: "active" as const, category: "Content" },
  { id: "2", name: "Research brief", status: "draft" as const, category: "Research" },
];

describe("workflow queries", () => {
  test("filters workflows by text and status", () => {
    expect(filterWorkflows(workflows, "content", "active")).toHaveLength(1);
    expect(filterWorkflows(workflows, "brief", "active")).toHaveLength(0);
  });

  test("summarizes execution health", () => {
    expect(summarizeExecutions([
      { status: "completed" as const, durationMs: 1200, cost: 0.04 },
      { status: "failed" as const, durationMs: 800, cost: 0.02 },
    ])).toEqual({ total: 2, successRate: 50, averageDurationMs: 1000, totalCost: 0.06 });
  });
});
