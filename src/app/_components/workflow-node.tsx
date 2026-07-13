import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

export type WorkflowNodeData = {
  label: string;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
};

export type WorkflowNodeType = Node<WorkflowNodeData, "workflow">;

export function WorkflowNode({ id, data, selected }: NodeProps<WorkflowNodeType>) {
  return (
    <div className={`workflow-canvas-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="canvas-handle" />
      <input
        className="node-label-input"
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
        tabIndex={-1}
      >
        ×
      </button>
      <Handle type="source" position={Position.Right} className="canvas-handle" />
    </div>
  );
}
