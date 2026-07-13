"use client";
import { ArrowLeft, Eye, MoreHorizontal, Play, Save, Settings, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StudioWorkflow } from "@/lib/studio-api";
import {
  inferNodeType,
  legacyLabelsToDefinition,
  parseWorkflowDefinition,
  validateScheduleConfig,
  type WorkflowDefinitionV1,
  type WorkflowNodeType,
  workflowLabels,
} from "@/lib/workflow-definition";
import { WorkflowEditorCanvas, type WorkflowEditorCanvasHandle } from "./editor-canvas";
import { NodeInspector } from "./node-inspector";
import "../editor.css";

type Props = { workflow: StudioWorkflow | null };

const nodeGroups: Array<{ label: string; tone: string; nodes: Array<{ label: string; type: WorkflowNodeType }> }> = [
  {
    label: "Triggers",
    tone: "trigger",
    nodes: [
      { label: "Webhook", type: "webhook" },
      { label: "Schedule", type: "schedule" },
      { label: "Manual", type: "manual" },
    ],
  },
  {
    label: "Actions",
    tone: "action",
    nodes: ["Search", "Analyze", "Generate", "Extract", "Transform"].map((label) => ({
      label,
      type: inferNodeType(label),
    })),
  },
  {
    label: "Logic",
    tone: "logic",
    nodes: ["Review", "Approve", "Condition", "Route"].map((label) => ({ label, type: inferNodeType(label) })),
  },
  {
    label: "Output",
    tone: "output",
    nodes: ["Publish", "Notify", "Sync", "Export"].map((label) => ({ label, type: inferNodeType(label) })),
  },
];

function definitionIssues(definition: WorkflowDefinitionV1) {
  const issues: string[] = [];
  if (definition.nodes.length === 0) issues.push("Add at least one node.");
  const triggers = definition.nodes.filter((node) => node.kind === "trigger");
  const steps = definition.nodes.filter((node) => node.kind !== "trigger");
  if (triggers.length === 0) issues.push("Workflow must contain at least one trigger.");
  if (steps.length > 0) {
    const firstStepX = Math.min(...steps.map((node) => node.position.x));
    if (triggers.some((node) => node.position.x >= firstStepX)) {
      issues.push("All triggers must be positioned before workflow steps.");
    }
  }
  for (const node of definition.nodes) {
    if (node.type === "schedule") issues.push(...validateScheduleConfig(node.config));
  }
  return [...new Set(issues)];
}

export function WorkflowEditorShell({ workflow }: Props) {
  const router = useRouter();
  const canvasRef = useRef<WorkflowEditorCanvasHandle>(null);
  const isNew = !workflow;
  const fallbackLabels = workflow?.nodes?.length ? workflow.nodes : ["Schedule", "Transform"];
  const [name, setName] = useState(workflow?.name ?? "Untitled workflow");
  const [description] = useState(workflow?.description ?? "");
  const [status, setStatus] = useState(workflow?.status ?? "draft");
  const [definition, setDefinition] = useState<WorkflowDefinitionV1>(() =>
    workflow?.definition ? parseWorkflowDefinition(workflow.definition) : legacyLabelsToDefinition(fallbackLabels),
  );
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const [canvasSeed, setCanvasSeed] = useState(0);
  const [selectedNodeID, setSelectedNodeID] = useState<string | null>(definition.nodes[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [detailState, setDetailState] = useState<"loading" | "ready" | "error">(isNew ? "ready" : "loading");

  useEffect(() => {
    if (!workflow?.id) return;
    let cancelled = false;
    fetch(`/api/studio/workflows/${encodeURIComponent(workflow.id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load private workflow definition.");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        if (payload?.data?.definition) {
          const loaded = parseWorkflowDefinition(payload.data.definition);
          setDefinition(loaded);
          setDefinitionDirty(false);
          setSelectedNodeID(loaded.nodes[0]?.id ?? null);
          setCanvasSeed((seed) => seed + 1);
        }
        setDetailState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setDetailState("error");
        setSaveError(
          "Unable to load the private workflow definition. Editing is disabled to protect saved node parameters.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [workflow?.id]);

  const issues = useMemo(() => definitionIssues(definition), [definition]);
  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeID) ?? null;
  const goBack = useCallback(() => router.push("/"), [router]);
  const addNode = useCallback((type: WorkflowNodeType, label: string) => canvasRef.current?.addNode(type, label), []);
  const updateSelectedConfig = useCallback(
    (config: Record<string, unknown>) => {
      if (selectedNodeID) canvasRef.current?.updateNodeConfig(selectedNodeID, config);
    },
    [selectedNodeID],
  );
  const handleDefinitionChange = useCallback((updated: WorkflowDefinitionV1) => {
    setDefinition(updated);
    setDefinitionDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (detailState !== "ready") {
      setSaveError("Wait for the workflow definition to finish loading before saving.");
      return;
    }
    if (!name.trim() || definition.nodes.length === 0) {
      setSaveError("Name and at least one node are required.");
      return;
    }
    if (status === "active" && issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        name: name.trim(),
        description,
        category: workflow?.category ?? "Operations",
        status,
        nodes: workflowLabels(definition),
        definition,
      };
      const command = isNew
        ? { action: "create-workflow" as const, payload }
        : { action: "update-workflow" as const, id: workflow.id, payload };
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error?.message ?? "Save failed");
      setDefinitionDirty(false);
      if (isNew) router.push(`/workflow/${data.data.id}`);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [name, definition, description, workflow, status, issues, isNew, router, detailState]);

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <button type="button" className="editor-back" onClick={goBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="editor-title-area">
          <input
            className="editor-name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Untitled workflow"
            maxLength={120}
          />
          <span className={`editor-badge ${status}`}>{status}</span>
          {issues.length > 0 && (
            <span className="editor-issues">
              {issues.length} issue{issues.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="editor-actions">
          <button type="button" className="editor-btn" title="Preview">
            <Eye size={14} />
          </button>
          <button type="button" className="editor-btn" title="Settings">
            <Settings size={14} />
          </button>
          <button type="button" className="editor-btn" title="Share">
            <Share2 size={14} />
          </button>
          <button type="button" className="editor-btn" title="More">
            <MoreHorizontal size={14} />
          </button>
          <div className="editor-divider" />
          <button type="button" className="editor-btn editor-run" title="Execute workflow" disabled={issues.length > 0}>
            <Play size={14} />
            <span>Run</span>
          </button>
          <button
            type="button"
            className="editor-btn editor-save"
            onClick={handleSave}
            disabled={saving || detailState !== "ready"}
          >
            <Save size={14} />
            <span>{saving ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </header>
      {saveError && (
        <div className="editor-error" role="alert">
          {saveError}
        </div>
      )}
      <div className="editor-body">
        <aside className="editor-node-panel">
          {nodeGroups.map((group) => (
            <div className="editor-panel-section" key={group.label}>
              <p className="editor-panel-label">{group.label}</p>
              {group.nodes.map((node) => (
                <button
                  key={node.type}
                  type="button"
                  className="editor-node-chip"
                  onClick={() => addNode(node.type, node.label)}
                >
                  <span className={`chip-dot ${group.tone}`} />
                  {node.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <div className="editor-canvas-area">
          <select
            className="editor-description-input"
            value={status}
            onChange={(event) => setStatus(event.target.value as StudioWorkflow["status"])}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
          {detailState === "ready" ? (
            <WorkflowEditorCanvas
              key={canvasSeed}
              ref={canvasRef}
              initial={definition}
              onChange={handleDefinitionChange}
              onSelectedNodeChange={setSelectedNodeID}
            />
          ) : (
            <div className="editor-definition-state">
              {detailState === "loading" ? "Loading node parameters…" : "Node parameters are unavailable."}
            </div>
          )}
        </div>
        {detailState === "ready" && (
          <NodeInspector
            node={selectedNode}
            workflowId={workflow?.id}
            hasUnsavedChanges={definitionDirty}
            onClose={() => setSelectedNodeID(null)}
            onConfigChange={updateSelectedConfig}
          />
        )}
      </div>
    </div>
  );
}
