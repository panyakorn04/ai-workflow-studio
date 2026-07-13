import { describe, expect, test } from "bun:test";
import type { Node } from "@xyflow/react";
import {
  appendFlowNode,
  buildLinearEdges,
  flowToNodes,
  nextNodeId,
  nodesToFlow,
  positionForNewNode,
  renameFlowNode,
  shouldPersistNodeChanges,
} from "./workflow-canvas-utils";

describe("nodesToFlow", () => {
  test("converts labels to nodes and edges", () => {
    const { nodes, edges } = nodesToFlow(["Search", "Analyze", "Publish"]);
    expect(nodes).toHaveLength(3);
    expect((nodes[0].data as { label: string }).label).toBe("Search");
    expect((nodes[2].data as { label: string }).label).toBe("Publish");
    expect(edges).toHaveLength(2);
    expect(edges[0].source).toBe("node-0");
    expect(edges[0].target).toBe("node-1");
  });

  test("returns empty arrays for empty input", () => {
    const { nodes, edges } = nodesToFlow([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  test("no edges for single node", () => {
    const { nodes, edges } = nodesToFlow(["Only"]);
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });
});

describe("flowToNodes", () => {
  test("serializes an empty canvas", () => {
    expect(flowToNodes([])).toEqual([]);
  });

  test("extracts labels sorted by x position", () => {
    const nodes: Node[] = [
      { id: "node-1", position: { x: 200, y: 0 }, data: { label: "B" } },
      { id: "node-0", position: { x: 0, y: 0 }, data: { label: "A" } },
    ];
    expect(flowToNodes(nodes)).toEqual(["A", "B"]);
  });

  test("filters empty labels", () => {
    const nodes: Node[] = [
      { id: "node-0", position: { x: 0, y: 0 }, data: { label: "" } },
      { id: "node-1", position: { x: 200, y: 0 }, data: { label: "Ok" } },
    ];
    expect(flowToNodes(nodes)).toEqual(["Ok"]);
  });
});

describe("nextNodeId", () => {
  test("returns node-0 for empty", () => {
    expect(nextNodeId([])).toBe("node-0");
  });

  test("returns next after max", () => {
    const nodes = [
      { id: "node-0", position: { x: 0, y: 0 }, data: {} },
      { id: "node-5", position: { x: 200, y: 0 }, data: {} },
    ];
    expect(nextNodeId(nodes as Node[])).toBe("node-6");
  });
});

describe("positionForNewNode", () => {
  test("returns origin for empty", () => {
    expect(positionForNewNode([])).toEqual({ x: 0, y: 0 });
  });

  test("returns offset from last node", () => {
    const nodes = [
      { id: "node-0", position: { x: 0, y: 0 }, data: {} },
      { id: "node-1", position: { x: 200, y: 0 }, data: {} },
    ];
    expect(positionForNewNode(nodes as Node[])).toEqual({ x: 400, y: 0 });
  });
});

describe("canvas persistence helpers", () => {
  test("appends a node after the right-most node with a unique id", () => {
    const existing = nodesToFlow(["Trigger", "Process"]).nodes;
    const updated = appendFlowNode(existing, "Publish");

    expect(updated).toHaveLength(3);
    expect(updated[2].id).toBe("node-2");
    expect(updated[2].position).toEqual({ x: 400, y: 0 });
    expect((updated[2].data as { label: string }).label).toBe("Publish");
  });

  test("builds edges from horizontal node order", () => {
    const nodes = [
      { id: "node-b", position: { x: 200, y: 0 }, data: {} },
      { id: "node-a", position: { x: 0, y: 0 }, data: {} },
    ] as Node[];

    expect(buildLinearEdges(nodes)).toEqual([
      expect.objectContaining({ source: "node-a", target: "node-b", type: "smoothstep" }),
    ]);
    expect(buildLinearEdges([])).toEqual([]);
    expect(buildLinearEdges(nodesToFlow(["Only"]).nodes)).toEqual([]);
  });

  test("renames a node without mutating the original collection", () => {
    const nodes = [{ id: "node-0", position: { x: 0, y: 0 }, data: { label: "Old" } }] as Node[];
    const updated = renameFlowNode(nodes, "node-0", "New");

    expect((updated[0].data as { label: string }).label).toBe("New");
    expect((nodes[0].data as { label: string }).label).toBe("Old");
  });

  test("persists position and removal changes, but not selection-only changes", () => {
    expect(shouldPersistNodeChanges([{ id: "node-0", type: "position", position: { x: 1, y: 2 } }])).toBe(true);
    expect(shouldPersistNodeChanges([{ id: "node-0", type: "remove" }])).toBe(true);
    expect(shouldPersistNodeChanges([{ id: "node-0", type: "select", selected: true }])).toBe(false);
  });
});
