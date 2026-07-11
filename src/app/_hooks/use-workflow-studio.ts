"use client";
import { useMemo, useState } from "react";
import { executions, workflows } from "@/lib/demo-data";
import { filterWorkflows, type WorkflowStatus } from "@/lib/workflows";

export function useWorkflowStudio() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkflowStatus | "all">("all");
  const [selectedRun, setSelectedRun] = useState(executions[0].id);
  const filtered = useMemo(() => filterWorkflows(workflows, query, status), [query, status]);
  return { query, setQuery, status, setStatus, selectedRun, setSelectedRun, filtered };
}
