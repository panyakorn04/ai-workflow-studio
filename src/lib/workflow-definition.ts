export type WorkflowNodeKind = "trigger" | "action" | "logic" | "output";
export type WorkflowNodeType =
  | "schedule"
  | "webhook"
  | "manual"
  | "search"
  | "analyze"
  | "generate"
  | "extract"
  | "transform"
  | "review"
  | "approve"
  | "condition"
  | "route"
  | "publish"
  | "notify"
  | "sync"
  | "export";

export type ScheduleTriggerConfig = {
  enabled: boolean;
  mode: "interval" | "daily" | "weekly" | "cron";
  timezone: string;
  intervalMinutes?: number;
  time?: string;
  daysOfWeek?: number[];
  cronExpression?: string;
  misfirePolicy: "skip" | "run-once";
};

export type WorkflowNodeDefinition = {
  id: string;
  type: WorkflowNodeType;
  kind: WorkflowNodeKind;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

export type WorkflowEdgeDefinition = { id: string; source: string; target: string };
export type WorkflowDefinitionV1 = { version: 1; nodes: WorkflowNodeDefinition[]; edges: WorkflowEdgeDefinition[] };

export const defaultScheduleConfig: ScheduleTriggerConfig = {
  enabled: true,
  mode: "daily",
  timezone: "Asia/Bangkok",
  time: "09:00",
  misfirePolicy: "skip",
};

export function defaultWorkflowDefinition(): WorkflowDefinitionV1 {
  const nodes: WorkflowNodeDefinition[] = [
    {
      id: "schedule-trigger",
      type: "schedule",
      kind: "trigger",
      label: "Schedule",
      position: { x: 0, y: 0 },
      config: {
        enabled: true,
        mode: "cron",
        timezone: "Asia/Bangkok",
        cronExpression: "0 12,20 * * *",
        misfirePolicy: "skip",
      },
    },
    {
      id: "manual-trigger",
      type: "manual",
      kind: "trigger",
      label: "Manual Trigger",
      position: { x: 0, y: 140 },
      config: { enabled: true },
    },
    {
      id: "read-source",
      type: "search",
      kind: "action",
      label: "Read Source",
      position: { x: 240, y: 70 },
      config: {},
    },
    {
      id: "transform",
      type: "transform",
      kind: "action",
      label: "Transform",
      position: { x: 480, y: 70 },
      config: {},
    },
    {
      id: "publish",
      type: "publish",
      kind: "output",
      label: "Publish",
      position: { x: 720, y: 70 },
      config: {},
    },
  ];
  return {
    version: 1,
    nodes,
    edges: [
      { id: "edge-schedule-trigger-read-source", source: "schedule-trigger", target: "read-source" },
      { id: "edge-manual-trigger-read-source", source: "manual-trigger", target: "read-source" },
      { id: "edge-read-source-transform", source: "read-source", target: "transform" },
      { id: "edge-transform-publish", source: "transform", target: "publish" },
    ],
  };
}

const nodeMeta: Record<WorkflowNodeType, { kind: WorkflowNodeKind; label: string }> = {
  schedule: { kind: "trigger", label: "Schedule" },
  webhook: { kind: "trigger", label: "Webhook" },
  manual: { kind: "trigger", label: "Manual" },
  search: { kind: "action", label: "Search" },
  analyze: { kind: "action", label: "Analyze" },
  generate: { kind: "action", label: "Generate" },
  extract: { kind: "action", label: "Extract" },
  transform: { kind: "action", label: "Transform" },
  review: { kind: "logic", label: "Review" },
  approve: { kind: "logic", label: "Approve" },
  condition: { kind: "logic", label: "Condition" },
  route: { kind: "logic", label: "Route" },
  publish: { kind: "output", label: "Publish" },
  notify: { kind: "output", label: "Notify" },
  sync: { kind: "output", label: "Sync" },
  export: { kind: "output", label: "Export" },
};

export const workflowNodeTypes = Object.keys(nodeMeta) as WorkflowNodeType[];
const nodeKinds: WorkflowNodeKind[] = ["trigger", "action", "logic", "output"];

export function nodeMetaForType(type: WorkflowNodeType) {
  return nodeMeta[type];
}

export function inferNodeType(label: string, index = 0): WorkflowNodeType {
  const normalized = label.trim().toLowerCase();
  const exact = workflowNodeTypes.find(
    (type) => type === normalized || nodeMeta[type].label.toLowerCase() === normalized,
  );
  if (exact) return exact;
  if (normalized.includes("schedule")) return "schedule";
  if (normalized.includes("webhook")) return "webhook";
  if (normalized.includes("trigger") || (index === 0 && normalized === "start")) return "manual";
  return index === 0 ? "manual" : "transform";
}

export function defaultConfigForType(type: WorkflowNodeType): Record<string, unknown> {
  if (type === "schedule") return { ...defaultScheduleConfig };
  if (type === "manual") return { enabled: true };
  if (type === "webhook") return { enabled: true, method: "POST", authMode: "none", responseMode: "immediate" };
  return {};
}

export function legacyLabelsToDefinition(labels: string[]): WorkflowDefinitionV1 {
  const nodes = labels.map((label, index): WorkflowNodeDefinition => {
    const type = inferNodeType(label, index);
    return {
      id: `node-${index}`,
      type,
      kind: nodeMeta[type].kind,
      label,
      position: { x: index * 200, y: 0 },
      config: defaultConfigForType(type),
    };
  });
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id,
  }));
  return { version: 1, nodes, edges };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkflowDefinition(value: unknown): WorkflowDefinitionV1 {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("Invalid workflow definition");
  }
  const ids = new Set<string>();
  const nodes = value.nodes.map((raw): WorkflowNodeDefinition => {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.type !== "string" || typeof raw.kind !== "string") {
      throw new Error("Invalid workflow node");
    }
    if (ids.has(raw.id)) throw new Error("Invalid workflow definition: duplicate node id");
    ids.add(raw.id);
    if (
      !workflowNodeTypes.includes(raw.type as WorkflowNodeType) ||
      !nodeKinds.includes(raw.kind as WorkflowNodeKind)
    ) {
      throw new Error("Invalid workflow node type");
    }
    const type = raw.type as WorkflowNodeType;
    if (
      nodeMeta[type].kind !== raw.kind ||
      typeof raw.label !== "string" ||
      raw.label.length < 1 ||
      raw.label.length > 80
    ) {
      throw new Error("Invalid workflow node metadata");
    }
    if (!isRecord(raw.position) || typeof raw.position.x !== "number" || typeof raw.position.y !== "number") {
      throw new Error("Invalid workflow node position");
    }
    if (!Number.isFinite(raw.position.x) || !Number.isFinite(raw.position.y) || !isRecord(raw.config)) {
      throw new Error("Invalid workflow node config");
    }
    return {
      id: raw.id,
      type,
      kind: raw.kind as WorkflowNodeKind,
      label: raw.label,
      position: { x: raw.position.x, y: raw.position.y },
      config: raw.config,
    };
  });
  const edgeIDs = new Set<string>();
  const edges = value.edges.map((raw): WorkflowEdgeDefinition => {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      typeof raw.source !== "string" ||
      typeof raw.target !== "string"
    ) {
      throw new Error("Invalid workflow edge");
    }
    if (!ids.has(raw.source) || !ids.has(raw.target)) throw new Error("Invalid workflow edge: unknown node");
    if (raw.source === raw.target || edgeIDs.has(raw.id)) throw new Error("Invalid workflow edge");
    edgeIDs.add(raw.id);
    return { id: raw.id, source: raw.source, target: raw.target };
  });
  return { version: 1, nodes, edges };
}

export function workflowLabels(definition: WorkflowDefinitionV1): string[] {
  return [...definition.nodes]
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((node) => node.label);
}

function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function isValidCronNumber(raw: string, min: number, max: number) {
  return /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= max;
}

function isValidCronField(field: string, min: number, max: number) {
  if (!field) return false;
  return field.split(",").every((item) => {
    const parts = item.split("/");
    if (parts.length > 2) return false;
    const [base, rawStep] = parts;
    if (rawStep !== undefined && (!/^\d+$/.test(rawStep) || Number(rawStep) < 1 || Number(rawStep) > max - min + 1)) {
      return false;
    }
    if (base === "*") return true;
    const range = base.split("-");
    if (range.length === 1) return isValidCronNumber(range[0], min, max);
    if (range.length !== 2 || !isValidCronNumber(range[0], min, max) || !isValidCronNumber(range[1], min, max))
      return false;
    return Number(range[0]) <= Number(range[1]);
  });
}

export function isValidCronExpression(expression: string) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const ranges = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ] as const;
  return fields.every((field, index) => isValidCronField(field, ranges[index][0], ranges[index][1]));
}

export function validateScheduleConfig(value: unknown): string[] {
  if (!isRecord(value)) return ["Schedule configuration is required."];
  const errors: string[] = [];
  if (typeof value.enabled !== "boolean") errors.push("Enabled must be true or false.");
  if (!["interval", "daily", "weekly", "cron"].includes(String(value.mode)))
    errors.push("Select a valid schedule mode.");
  if (typeof value.timezone !== "string" || !validTimezone(value.timezone))
    errors.push("Select a valid IANA timezone.");
  if (!["skip", "run-once"].includes(String(value.misfirePolicy))) errors.push("Select a valid misfire policy.");
  if (
    value.mode === "interval" &&
    (!Number.isInteger(value.intervalMinutes) ||
      Number(value.intervalMinutes) < 1 ||
      Number(value.intervalMinutes) > 43200)
  ) {
    errors.push("Interval must be between 1 and 43,200 minutes.");
  }
  if (
    (value.mode === "daily" || value.mode === "weekly") &&
    (typeof value.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
  ) {
    errors.push("Time must use HH:mm in 24-hour format.");
  }
  if (
    value.mode === "weekly" &&
    (!Array.isArray(value.daysOfWeek) ||
      value.daysOfWeek.length === 0 ||
      value.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
  ) {
    errors.push("Select at least one day.");
  }
  if (
    value.mode === "cron" &&
    (typeof value.cronExpression !== "string" || !isValidCronExpression(value.cronExpression))
  ) {
    errors.push("Cron expression must be a valid 5-field numeric expression.");
  }
  return errors;
}

export function describeSchedule(value: unknown): string {
  if (!isRecord(value)) return "Schedule is not configured";
  const timezone = typeof value.timezone === "string" ? value.timezone : "UTC";
  if (value.mode === "interval") return `Every ${value.intervalMinutes ?? "?"} minutes (${timezone})`;
  if (value.mode === "weekly") {
    const labels = Array.isArray(value.daysOfWeek)
      ? value.daysOfWeek
          .map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day])
          .filter(Boolean)
          .join(", ")
      : "?";
    return `Weekly on ${labels} at ${value.time ?? "?"} (${timezone})`;
  }
  if (value.mode === "cron") return `Cron ${value.cronExpression ?? "?"} (${timezone})`;
  return `Every day at ${value.time ?? "?"} (${timezone})`;
}
