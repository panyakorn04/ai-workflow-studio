import type { Edge, Node, NodeChange } from "@xyflow/react";

const NODE_SPACING = 200;

export function nodesToFlow(labels: string[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = labels.map((label, i) => ({
    id: `node-${i}`,
    type: "workflow",
    position: { x: i * NODE_SPACING, y: 0 },
    data: { label },
  }));

  return { nodes, edges: buildLinearEdges(nodes) };
}

function nodeLabel(node: Node): string | undefined {
  if (typeof node.data === "object" && node.data !== null && "label" in node.data) {
    const label = (node.data as Record<string, unknown>).label;
    return typeof label === "string" ? label : undefined;
  }
  return undefined;
}

function nodeKind(node: Node): string | undefined {
  if (typeof node.data === "object" && node.data !== null && "nodeKind" in node.data) {
    const kind = (node.data as Record<string, unknown>).nodeKind;
    return typeof kind === "string" ? kind : undefined;
  }
  return undefined;
}

export function flowToNodes(nodes: Node[]): string[] {
  return [...nodes]
    .sort((a, b) => a.position.x - b.position.x)
    .map((n) => nodeLabel(n) ?? "")
    .filter((l) => l.length > 0);
}

export function nextNodeId(existing: Node[]): string {
  const max = existing.reduce((max, n) => Math.max(max, parseInt(n.id.replace("node-", ""), 10) || 0), -1);
  return `node-${max + 1}`;
}

export function positionForNewNode(existing: Node[]): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 };
  const last = existing.reduce((a, b) => (a.position.x > b.position.x ? a : b));
  return { x: last.position.x + NODE_SPACING, y: 0 };
}

export function appendFlowNode(existing: Node[], label: string): Node[] {
  return [
    ...existing,
    {
      id: nextNodeId(existing),
      type: "workflow",
      position: positionForNewNode(existing),
      data: { label },
    },
  ];
}

export function buildLinearEdges(nodes: Node[]): Edge[] {
  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
  return sorted.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${sorted[index + 1].id}`,
    source: node.id,
    target: sorted[index + 1].id,
    type: "smoothstep",
    animated: false,
    selectable: false,
    deletable: false,
    focusable: false,
  }));
}

function graphEdge(source: Node, target: Node): Edge {
  return {
    id: `edge-${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    type: "smoothstep",
    animated: false,
    selectable: false,
    deletable: false,
    focusable: false,
  };
}

export function buildTriggerGraphEdges(nodes: Node[]): Edge[] {
  const triggers = nodes.filter((node) => nodeKind(node) === "trigger").sort((a, b) => a.position.y - b.position.y);
  const steps = nodes
    .filter((node) => nodeKind(node) !== "trigger")
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  if (steps.length === 0) return [];
  return [
    ...triggers.map((trigger) => graphEdge(trigger, steps[0])),
    ...steps.slice(0, -1).map((step, index) => graphEdge(step, steps[index + 1])),
  ];
}

export function renameFlowNode(nodes: Node[], id: string, label: string): Node[] {
  return nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node));
}

export function shouldPersistNodeChanges(changes: NodeChange[]): boolean {
  return changes.some((change) => change.type === "position" || change.type === "remove");
}
