"use client";
import { useState } from "react";
import type { StudioAdminCommand } from "@/lib/studio-admin";
import type { StudioWorkflow } from "@/lib/studio-api";
import { WorkflowCanvas } from "./workflow-canvas";

export function WorkflowForm({
  workflow,
  pending,
  onClose,
  onSubmit,
}: {
  workflow: StudioWorkflow | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (command: StudioAdminCommand) => Promise<boolean>;
}) {
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [category, setCategory] = useState(workflow?.category ?? "Operations");
  const [status, setStatus] = useState(workflow?.status ?? "draft");
  const [nodeLabels, setNodeLabels] = useState<string[]>(() => workflow?.nodes ?? ["Trigger", "Process", "Review"]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      status,
      nodes: nodeLabels,
    };
    const succeeded = workflow
      ? await onSubmit({ action: "update-workflow", id: workflow.id, payload })
      : await onSubmit({ action: "create-workflow", payload });
    if (succeeded) onClose();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop with role=presentation
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="workflow-modal wide" role="dialog" aria-modal="true" aria-labelledby="workflow-form-title">
        <header>
          <div>
            <h2 className="sr-only">WORKFLOW DEFINITION</h2>
            <h2 id="workflow-form-title">{workflow ? "Edit workflow" : "Create workflow"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Name
            <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Description
            <textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="form-row">
            <label>
              Category
              <input
                required
                minLength={2}
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as StudioWorkflow["status"])}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
          <div className="canvas-section">
            <div className="canvas-label">
              Nodes <small>Click a preset or type a custom name</small>
            </div>
            <WorkflowCanvas initial={nodeLabels} onChange={setNodeLabels} />
          </div>
          <footer>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={pending}>
              {pending ? "Saving…" : workflow ? "Save changes" : "Create workflow"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
