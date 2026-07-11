import type { ExecutionStatus, WorkflowStatus } from "./workflows";

export const workflows = [
  { id: "wf-content", name: "Content intelligence pipeline", description: "Discover, analyze, generate, approve, and publish content.", category: "Content", status: "active" as WorkflowStatus, runs: 1284, success: 98.4, updated: "2 min ago", nodes: ["Discover", "Analyze", "Generate", "Approval", "Publish"] },
  { id: "wf-research", name: "Competitive research brief", description: "Turn multiple sources into a cited bilingual market brief.", category: "Research", status: "active" as WorkflowStatus, runs: 486, success: 96.8, updated: "18 min ago", nodes: ["Search", "Extract", "Synthesize", "Review"] },
  { id: "wf-meeting", name: "Meeting action center", description: "Summarize meetings, identify owners, and sync action items.", category: "Operations", status: "draft" as WorkflowStatus, runs: 72, success: 94.1, updated: "Yesterday", nodes: ["Transcript", "Summarize", "Assign", "Sync"] },
];

export const executions = [
  { id: "RUN-2841", workflow: "Content intelligence pipeline", status: "running" as ExecutionStatus, started: "Now", duration: "01:42", durationMs: 102000, cost: 0.18 },
  { id: "RUN-2840", workflow: "Competitive research brief", status: "completed" as ExecutionStatus, started: "12 min ago", duration: "02:18", durationMs: 138000, cost: 0.12 },
  { id: "RUN-2839", workflow: "Meeting action center", status: "waiting" as ExecutionStatus, started: "26 min ago", duration: "00:48", durationMs: 48000, cost: 0.06 },
  { id: "RUN-2838", workflow: "Content intelligence pipeline", status: "failed" as ExecutionStatus, started: "1 hr ago", duration: "00:34", durationMs: 34000, cost: 0.03 },
  { id: "RUN-2837", workflow: "Content intelligence pipeline", status: "completed" as ExecutionStatus, started: "2 hrs ago", duration: "02:06", durationMs: 126000, cost: 0.16 },
];

export const loopStages = [
  { name: "Discover", detail: "Found 12 rights-allowed sources", state: "done" as const },
  { name: "Analyze", detail: "Ranked 8 candidate moments", state: "done" as const },
  { name: "Generate", detail: "Creating bilingual captions", state: "running" as const },
  { name: "Approval", detail: "Human review required", state: "pending" as const },
  { name: "Publish", detail: "Destination: Social queue", state: "pending" as const },
];
