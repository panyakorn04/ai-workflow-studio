"use client";
import { useMemo, useState } from "react";
import type { StudioOverview } from "@/lib/studio-api";
import { filterWorkflows, type WorkflowStatus } from "@/lib/workflows";

export function useWorkflowStudio(data: StudioOverview) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkflowStatus | "all">("all");
  const [selectedRun, setSelectedRun] = useState(data.executions[0]?.id ?? "");
  const filtered = useMemo(() => filterWorkflows(data.workflows, query, status), [data.workflows, query, status]);
  return { query, setQuery, status, setStatus, selectedRun, setSelectedRun, filtered };
}
