import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Braces, Clock3, GitBranch, Globe2, Send, Sparkles } from "lucide-react";

export type WorkflowNodeData = {
  label: string;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
};

export type WorkflowNodeType = Node<WorkflowNodeData, "workflow">;

const nodeLooks = [
  { keywords: ["schedule", "trigger", "webhook", "manual"], tone: "trigger", icon: Clock3 },
  { keywords: ["condition", "route", "review", "approve", "logic"], tone: "logic", icon: GitBranch },
  { keywords: ["publish", "notify", "sync", "export", "send"], tone: "output", icon: Send },
  { keywords: ["search", "sheet", "data", "read", "fetch"], tone: "data", icon: Globe2 },
  { keywords: ["analyze", "generate", "extract", "transform", "process"], tone: "action", icon: Braces },
] as const;

function getNodeLook(label: string) {
  const normalized = label.toLowerCase();
  return (
    nodeLooks.find(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword))) ?? {
      tone: "default",
      icon: Sparkles,
    }
  );
}

export function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeType>) {
  const { tone, icon: Icon } = getNodeLook(data.label);

  return (
    <div className={`workflow-canvas-node ${selected ? "selected" : ""}`} data-tone={tone}>
      <Handle type="target" position={Position.Left} className="canvas-handle" />
      <div className="node-icon-shell" aria-hidden="true">
        <Icon size={25} strokeWidth={1.8} />
      </div>
      <input
        className="node-label-input"
        aria-label="Node name"
        value={data.label}
        onChange={(e) => data.onRename(id, e.target.value)}
        onFocus={(e) => e.target.select()}
        maxLength={80}
      />
      <button
        type="button"
        className="node-delete-btn"
        aria-label={`Delete ${data.label}`}
        onClick={() => data.onDelete(id)}
      >
        ×
      </button>
      <Handle type="source" position={Position.Right} className="canvas-handle" />
    </div>
  );
}
