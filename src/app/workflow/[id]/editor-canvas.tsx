"use client";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { WorkflowNode } from "@/app/_components/workflow-node";
import {
  buildTriggerGraphEdges,
  nextNodeId,
  positionForNewNode,
  shouldPersistNodeChanges,
} from "@/lib/workflow-canvas-utils";
import {
  defaultConfigForType,
  nodeMetaForType,
  type WorkflowDefinitionV1,
  type WorkflowNodeDefinition,
  type WorkflowNodeType,
} from "@/lib/workflow-definition";

type CanvasNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  nodeKind: WorkflowNodeDefinition["kind"];
  config: Record<string, unknown>;
};

type Props = {
  initial: WorkflowDefinitionV1;
  onChange: (definition: WorkflowDefinitionV1) => void;
  onSelectedNodeChange: (id: string | null) => void;
};

export type WorkflowEditorCanvasHandle = {
  addNode: (type: WorkflowNodeType, label: string) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
};

const nodeTypes = { workflow: WorkflowNode };

function definitionToFlow(definition: WorkflowDefinitionV1): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: definition.nodes.map((node) => ({
      id: node.id,
      type: "workflow",
      position: node.position,
      data: { label: node.label, nodeType: node.type, nodeKind: node.kind, config: node.config },
    })),
    edges: definition.edges.map((edge) => ({
      ...edge,
      type: "smoothstep",
      animated: false,
      selectable: false,
      deletable: false,
      focusable: false,
    })),
  };
}

function parseNodeData(data: unknown): CanvasNodeData {
  if (typeof data !== "object" || data === null) {
    return { label: "", nodeType: "manual", nodeKind: "trigger", config: {} };
  }
  const record = data as Record<string, unknown>;
  return {
    label: typeof record.label === "string" ? record.label : "",
    nodeType: (typeof record.nodeType === "string" ? record.nodeType : "manual") as WorkflowNodeType,
    nodeKind: (typeof record.nodeKind === "string" ? record.nodeKind : "trigger") as WorkflowNodeDefinition["kind"],
    config:
      typeof record.config === "object" && record.config !== null ? (record.config as Record<string, unknown>) : {},
  };
}

function flowToDefinition(nodes: Node[], edges: Edge[]): WorkflowDefinitionV1 {
  return {
    version: 1,
    nodes: nodes.map((node) => {
      const data = parseNodeData(node.data);
      return {
        id: node.id,
        type: data.nodeType,
        kind: data.nodeKind,
        label: data.label,
        position: node.position,
        config: data.config,
      };
    }),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}

export const WorkflowEditorCanvas = forwardRef<WorkflowEditorCanvasHandle, Props>(function WorkflowEditorCanvas(
  { initial, onChange, onSelectedNodeChange },
  ref,
) {
  const initialFlow = useMemo(() => definitionToFlow(initial), [initial]);
  const [nodes, setNodes] = useState<Node[]>(initialFlow.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialFlow.edges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  const replaceNodes = useCallback((updated: Node[]) => {
    nodesRef.current = updated;
    setNodes(updated);
  }, []);
  const replaceEdges = useCallback((updated: Edge[]) => {
    edgesRef.current = updated;
    setEdges(updated);
  }, []);
  const notify = useCallback(
    (updatedNodes = nodesRef.current, updatedEdges = edgesRef.current) =>
      onChange(flowToDefinition(updatedNodes, updatedEdges)),
    [onChange],
  );
  const rebuildEdges = useCallback(
    (updatedNodes: Node[]) => {
      const updatedEdges = buildTriggerGraphEdges(updatedNodes);
      replaceEdges(updatedEdges);
      return updatedEdges;
    },
    [replaceEdges],
  );

  const addNode = useCallback(
    (type: WorkflowNodeType, label: string) => {
      const meta = nodeMetaForType(type);
      const triggerCount = nodesRef.current.filter((node) => parseNodeData(node.data).nodeKind === "trigger").length;
      const node: Node = {
        id: nextNodeId(nodesRef.current),
        type: "workflow",
        position: meta.kind === "trigger" ? { x: 0, y: triggerCount * 140 } : positionForNewNode(nodesRef.current),
        data: { label, nodeType: type, nodeKind: meta.kind, config: defaultConfigForType(type) },
      };
      const updated = [...nodesRef.current, node];
      replaceNodes(updated);
      const updatedEdges = rebuildEdges(updated);
      notify(updated, updatedEdges);
      onSelectedNodeChange(node.id);
    },
    [notify, onSelectedNodeChange, rebuildEdges, replaceNodes],
  );

  const updateNodeConfig = useCallback(
    (id: string, config: Record<string, unknown>) => {
      const updated = nodesRef.current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, config } } : node,
      );
      replaceNodes(updated);
      notify(updated);
    },
    [notify, replaceNodes],
  );

  useImperativeHandle(ref, () => ({ addNode, updateNodeConfig }), [addNode, updateNodeConfig]);

  const handleRename = useCallback(
    (id: string, label: string) => {
      const updated = nodesRef.current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node,
      );
      replaceNodes(updated);
      notify(updated);
    },
    [notify, replaceNodes],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const updated = nodesRef.current.filter((node) => node.id !== id);
      replaceNodes(updated);
      const updatedEdges = rebuildEdges(updated);
      notify(updated, updatedEdges);
      onSelectedNodeChange(null);
    },
    [notify, onSelectedNodeChange, rebuildEdges, replaceNodes],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, nodesRef.current);
      replaceNodes(updated);
      if (shouldPersistNodeChanges(changes)) {
        const updatedEdges = rebuildEdges(updated);
        notify(updated, updatedEdges);
      }
    },
    [notify, rebuildEdges, replaceNodes],
  );

  const nodesWithCallbacks = useMemo(
    () => nodes.map((node) => ({ ...node, data: { ...node.data, onRename: handleRename, onDelete: handleDelete } })),
    [nodes, handleRename, handleDelete],
  );

  return (
    <div className="editor-canvas">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={(_event, node) => onSelectedNodeChange(node.id)}
        onPaneClick={() => onSelectedNodeChange(null)}
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
