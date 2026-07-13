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
import { useCallback, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import {
  appendFlowNode,
  buildLinearEdges,
  flowToNodes,
  nodesToFlow,
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
  const nodesRef = useRef(nodes);

  const notify = useCallback(
    (updated: Node[]) => {
      const labels = flowToNodes(updated);
      onChange(labels);
    },
    [onChange],
  );

  const rebuildEdges = useCallback((updatedNodes: Node[]) => {
    setEdges(buildLinearEdges(updatedNodes));
  }, []);

  const replaceNodes = useCallback((updatedNodes: Node[]) => {
    nodesRef.current = updatedNodes;
    setNodes(updatedNodes);
  }, []);

  const handleRename = useCallback(
    (id: string, label: string) => {
      const updated = renameFlowNode(nodesRef.current, id, label);
      replaceNodes(updated);
      notify(updated);
    },
    [notify, replaceNodes],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const filtered = nodesRef.current.filter((node) => node.id !== id);
      replaceNodes(filtered);
      rebuildEdges(filtered);
      notify(filtered);
    },
    [rebuildEdges, notify, replaceNodes],
  );

  const handleAddNode = useCallback(
    (label: string) => {
      const updated = appendFlowNode(nodesRef.current, label);
      replaceNodes(updated);
      rebuildEdges(updated);
      notify(updated);
    },
    [rebuildEdges, notify, replaceNodes],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, nodesRef.current);
      replaceNodes(updated);
      if (shouldPersistNodeChanges(changes)) {
        rebuildEdges(updated);
        notify(updated);
      }
    },
    [rebuildEdges, notify, replaceNodes],
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
