import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Braces, Clock3, GitBranch, Globe2, MousePointerClick, Send, Sparkles } from "lucide-react";
import type { WorkflowNodeType as WorkflowNodeDefinitionType, WorkflowNodeKind } from "@/lib/workflow-definition";

export type WorkflowNodeData = {
  label: string;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  nodeType?: WorkflowNodeDefinitionType;
  nodeKind?: WorkflowNodeKind;
  config?: Record<string, unknown>;
};

export type WorkflowNodeType = Node<WorkflowNodeData, "workflow">;

const nodeLooks = [
  { keywords: ["schedule", "trigger", "webhook", "manual"], tone: "trigger", icon: Clock3 },
  { keywords: ["condition", "route", "review", "approve", "logic"], tone: "logic", icon: GitBranch },
  { keywords: ["publish", "notify", "sync", "export", "send"], tone: "output", icon: Send },
  { keywords: ["search", "sheet", "data", "read", "fetch", "http", "api"], tone: "data", icon: Globe2 },
  { keywords: ["analyze", "generate", "extract", "transform", "process"], tone: "action", icon: Braces },
] as const;

function getNodeLook(label: string, nodeType?: WorkflowNodeDefinitionType) {
  if (nodeType === "manual") return { tone: "trigger", icon: MousePointerClick };
  if (nodeType && ["schedule", "webhook"].includes(nodeType)) return { tone: "trigger", icon: Clock3 };
  if (nodeType && ["condition", "route", "review", "approve"].includes(nodeType))
    return { tone: "logic", icon: GitBranch };
  if (nodeType && ["publish", "notify", "sync", "export"].includes(nodeType)) return { tone: "output", icon: Send };
  if (nodeType === "search") return { tone: "data", icon: Globe2 };
  if (nodeType) return { tone: "action", icon: Braces };
  const normalized = label.toLowerCase();
  return (
    nodeLooks.find(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword))) ?? {
      tone: "default",
      icon: Sparkles,
    }
  );
}

export function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeType>) {
  const { tone, icon: Icon } = getNodeLook(data.label, data.nodeType);

  return (
    <div className={`workflow-canvas-node ${selected ? "selected" : ""}`} data-tone={tone}>
      {data.nodeKind !== "trigger" && <Handle type="target" position={Position.Left} className="canvas-handle" />}
      <div className="node-icon-shell" aria-hidden="true">
        <Icon size={25} strokeWidth={1.8} />
      </div>
      <input
        className="node-label-input nodrag"
        aria-label="Node name"
        value={data.label}
        onChange={(e) => data.onRename(id, e.target.value)}
        onFocus={(e) => e.target.select()}
        maxLength={80}
      />
      <button
        type="button"
        className="node-delete-btn nodrag"
        aria-label={`Delete ${data.label}`}
        onClick={() => data.onDelete(id)}
      >
        ×
      </button>
      <Handle type="source" position={Position.Right} className="canvas-handle" />
    </div>
  );
}
