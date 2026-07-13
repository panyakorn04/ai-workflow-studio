"use client";
import { ArrowLeft, Eye, MoreHorizontal, Play, Save, Settings, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { StudioWorkflow } from "@/lib/studio-api";
import { WorkflowEditorCanvas, type WorkflowEditorCanvasHandle } from "./editor-canvas";
import "../editor.css";

type Props = {
  workflow: StudioWorkflow | null;
};

const nodeGroups = [
  { label: "Triggers", tone: "trigger", nodes: ["Webhook", "Schedule", "Manual"] },
  { label: "Actions", tone: "action", nodes: ["Search", "Analyze", "Generate", "Extract", "Transform"] },
  { label: "Logic", tone: "logic", nodes: ["Review", "Approve", "Condition", "Route"] },
  { label: "Output", tone: "output", nodes: ["Publish", "Notify", "Sync", "Export"] },
] as const;

export function WorkflowEditorShell({ workflow }: Props) {
  const router = useRouter();
  const canvasRef = useRef<WorkflowEditorCanvasHandle>(null);
  const isNew = !workflow;

  const [name, setName] = useState(workflow?.name ?? "Untitled workflow");
  const [description, _setDescription] = useState(workflow?.description ?? "");
  const [status, setStatus] = useState(workflow?.status ?? "draft");
  const [nodes, setNodes] = useState<string[]>(() => workflow?.nodes ?? ["Trigger", "Process"]);
  const [saving, setSaving] = useState(false);

  const goBack = useCallback(() => router.push("/"), [router]);
  const addNode = useCallback((label: string) => canvasRef.current?.addNode(label), []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description, category: workflow?.category ?? "Operations", status, nodes };
      const endpoint = isNew ? "/api/studio/admin" : "/api/studio/admin";
      const command = isNew
        ? { action: "create-workflow" as const, payload }
        : { action: "update-workflow" as const, id: workflow.id, payload };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Save failed");
      if (isNew) router.push(`/workflow/${data.data.id}`);
      router.refresh();
    } catch {
      // toast would go here
    } finally {
      setSaving(false);
    }
  }, [name, status, nodes, isNew, workflow, router, description]);

  return (
    <div className="editor-shell">
      {/* Top bar */}
      <header className="editor-topbar">
        <button type="button" className="editor-back" onClick={goBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="editor-title-area">
          <input
            className="editor-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled workflow"
            maxLength={120}
          />
          <span className={`editor-badge ${status}`}>{status}</span>
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
          <button type="button" className="editor-btn editor-run" title="Execute workflow">
            <Play size={14} />
            <span>Run</span>
          </button>
          <button type="button" className="editor-btn editor-save" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            <span>{saving ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </header>

      {/* Body: left panel + canvas */}
      <div className="editor-body">
        <aside className="editor-node-panel">
          {nodeGroups.map((group) => (
            <div className="editor-panel-section" key={group.label}>
              <p className="editor-panel-label">{group.label}</p>
              {group.nodes.map((node) => (
                <button key={node} type="button" className="editor-node-chip" onClick={() => addNode(node)}>
                  <span className={`chip-dot ${group.tone}`} />
                  {node}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="editor-canvas-area">
          <select
            className="editor-description-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as StudioWorkflow["status"])}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 5 }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
          <WorkflowEditorCanvas ref={canvasRef} initial={nodes} onChange={setNodes} />
        </div>
      </div>
    </div>
  );
}
