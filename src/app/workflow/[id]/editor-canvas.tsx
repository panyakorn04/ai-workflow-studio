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
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { WorkflowNode } from "@/app/_components/workflow-node";
import {
  appendFlowNode,
  buildLinearEdges,
  flowToNodes,
  nodesToFlow,
  renameFlowNode,
  shouldPersistNodeChanges,
} from "@/lib/workflow-canvas-utils";

type Props = {
  initial: string[];
  onChange: (nodes: string[]) => void;
};

export type WorkflowEditorCanvasHandle = {
  addNode: (label: string) => void;
};

const nodeTypes = { workflow: WorkflowNode };

export const WorkflowEditorCanvas = forwardRef<WorkflowEditorCanvasHandle, Props>(function WorkflowEditorCanvas(
  { initial, onChange },
  ref,
) {
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

  const addNode = useCallback(
    (label: string) => {
      const updated = appendFlowNode(nodesRef.current, label);
      replaceNodes(updated);
      rebuildEdges(updated);
      notify(updated);
    },
    [notify, rebuildEdges, replaceNodes],
  );

  useImperativeHandle(ref, () => ({ addNode }), [addNode]);

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
});
