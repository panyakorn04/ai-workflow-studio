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
import { WorkflowNode } from "@/app/_components/workflow-node";
import { flowToNodes, nodesToFlow } from "@/lib/workflow-canvas-utils";

type Props = {
  initial: string[];
  onChange: (nodes: string[]) => void;
};

const nodeTypes = { workflow: WorkflowNode };

export function WorkflowEditorCanvas({ initial, onChange }: Props) {
  const [nodes, setNodes] = useState<Node[]>(() => nodesToFlow(initial).nodes);
  const [edges, setEdges] = useState<Edge[]>(() => nodesToFlow(initial).edges);

  const notify = useCallback(
    (updated: Node[]) => {
      const labels = flowToNodes(updated);
      if (labels.length > 0) onChange(labels);
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

  const handleRename = useCallback((id: string, label: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
  }, []);

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

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (changes.some((c) => c.type === "position")) {
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
        data: { ...n.data, onRename: handleRename, onDelete: handleDelete },
      })),
    [nodes, handleRename, handleDelete],
  );

  return (
    <div className="editor-canvas">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
        style={{ background: "var(--bg)" }}
      >
        <Controls position="bottom-right" className="canvas-controls" showInteractive={false} />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.03)" />
      </ReactFlow>
    </div>
  );
}
