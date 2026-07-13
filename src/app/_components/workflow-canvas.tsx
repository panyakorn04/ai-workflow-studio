"use client";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import {
  flowToNodes,
  nextNodeId,
  nodesToFlow,
  positionForNewNode,
  renameFlowNode,
  shouldPersistNodeChanges,
} from "@/lib/workflow-canvas-utils";
import { NodePalette } from "./node-palette";
import { WorkflowNode } from "./workflow-node";

type Props = {
  initial: string[];
  onChange: (nodes: string[]) => void;
};

const nodeTypes = { workflow: WorkflowNode };

export function WorkflowCanvas({ initial, onChange }: Props) {
  const [nodes, setNodes] = useState<Node[]>(() => nodesToFlow(initial).nodes);
  const [edges, setEdges] = useState<Edge[]>(() => nodesToFlow(initial).edges);

  const notify = useCallback(
    (updated: Node[]) => {
      const labels = flowToNodes(updated);
      onChange(labels);
    },
    [onChange],
  );

  const rebuildEdges = useCallback((updatedNodes: Node[]) => {
    const sorted = [...updatedNodes].sort((a, b) => a.position.x - b.position.x);
    const newEdges: Edge[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      newEdges.push({
        id: `edge-${sorted[i].id}-${sorted[i + 1].id}`,
        source: sorted[i].id,
        target: sorted[i + 1].id,
        type: "smoothstep",
        animated: false,
      });
    }
    setEdges(newEdges);
  }, []);

  const handleRename = useCallback(
    (id: string, label: string) => {
      setNodes((nds) => {
        const updated = renameFlowNode(nds, id, label);
        notify(updated);
        return updated;
      });
    },
    [notify],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setNodes((nds) => {
        const filtered = nds.filter((n) => n.id !== id);
        if (filtered.length === 0) return nds;
        rebuildEdges(filtered);
        notify(filtered);
        return filtered;
      });
    },
    [rebuildEdges, notify],
  );

  const handleAddNode = useCallback(
    (label: string) => {
      setNodes((nds) => {
        const id = nextNodeId(nds);
        const pos = positionForNewNode(nds);
        const newNode: Node = {
          id,
          type: "workflow",
          position: pos,
          data: { label },
        };
        const updated = [...nds, newNode];
        rebuildEdges(updated);
        notify(updated);
        return updated;
      });
    },
    [rebuildEdges, notify],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (shouldPersistNodeChanges(changes)) {
          rebuildEdges(updated);
          notify(updated);
        }
        return updated;
      });
    },
    [rebuildEdges, notify],
  );

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onRename: handleRename,
          onDelete: handleDelete,
        },
      })),
    [nodes, handleRename, handleDelete],
  );

  const hasNodes = nodes.length > 0;

  return (
    <div className="workflow-canvas-container">
      {!hasNodes && (
        <div className="canvas-empty">
          <p>No nodes yet. Add your first node below.</p>
        </div>
      )}
      <div className="canvas-flow" style={{ display: hasNodes ? "block" : "none" }}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={1.5}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode="Shift"
          proOptions={{ hideAttribution: true }}
        >
          <Controls position="top-right" className="canvas-controls" showInteractive={false} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.04)" />
        </ReactFlow>
      </div>
      <NodePalette onAddNode={handleAddNode} />
    </div>
  );
}
