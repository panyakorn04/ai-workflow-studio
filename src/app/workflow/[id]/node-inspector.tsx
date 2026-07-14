"use client";
import { Braces, Clock3, Globe2, Pencil, Play, Settings2, Table2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultScheduleConfig,
  describeSchedule,
  type ScheduleTriggerConfig,
  validateScheduleConfig,
  type WorkflowNodeDefinition,
} from "@/lib/workflow-definition";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function NodeInspector({
  node,
  workflowId,
  hasUnsavedChanges,
  onClose,
  onConfigChange,
}: {
  node: WorkflowNodeDefinition | null;
  workflowId?: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const [activeTab, setActiveTab] = useState<"parameters" | "settings">("parameters");
  const [output, setOutput] = useState<unknown[]>([]);
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"json" | "table" | "schema">("json");
  const [editingPayload, setEditingPayload] = useState(false);
  const [draftPayload, setDraftPayload] = useState("");

  const syncOutputFromPayload = useCallback((payload: string | undefined) => {
    if (typeof payload === "string" && payload.trim()) {
      try {
        const parsed = JSON.parse(payload);
        setOutput(Array.isArray(parsed) ? parsed : [parsed]);
        return;
      } catch {
        /* not valid */
      }
    }
    setOutput([]);
  }, []);

  useEffect(() => {
    syncOutputFromPayload(node?.config?.outputPayload as string | undefined);
  }, [node?.config?.outputPayload, syncOutputFromPayload]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!node) return null;

  const isTrigger = node.kind === "trigger";
  const blockedMessage = !workflowId
    ? "Save this workflow before executing the trigger."
    : hasUnsavedChanges
      ? "Save your workflow changes before executing this trigger."
      : "";

  const executeTrigger = async () => {
    if (!isTrigger || blockedMessage) return;
    const customOutput = node.config.outputPayload;
    if (typeof customOutput === "string" && customOutput.trim()) {
      try {
        const parsed = JSON.parse(customOutput);
        setOutput(Array.isArray(parsed) ? parsed : [parsed]);
        setError("");
      } catch {
        setError("Custom output payload is not valid JSON.");
      }
      return;
    }
    setExecuting(true);
    setError("");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute-node", workflowId, nodeId: node.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Execute step failed.");
      setOutput(Array.isArray(payload.data?.output) ? payload.data.output : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Execute step failed.");
    } finally {
      setExecuting(false);
    }
  };

  const executeHttpRequest = async () => {
    if (!workflowId || hasUnsavedChanges) {
      setError("Save your workflow changes before executing this node.");
      return;
    }
    setExecuting(true);
    setError("");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute-http-request", workflowId, nodeId: node.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "HTTP request failed.");
      setOutput(Array.isArray(payload.data?.output) ? payload.data.output : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HTTP request failed.");
    } finally {
      setExecuting(false);
    }
  };

  const parameterContent = (() => {
    if (activeTab === "settings") {
      return (
        <div className="node-popup-empty-copy">
          <strong>Node settings</strong>
          <p>Runtime retry and timeout settings will appear here when the workflow executor is enabled.</p>
        </div>
      );
    }
    if (node.type === "schedule") return <ScheduleTriggerForm config={node.config} onChange={onConfigChange} />;
    if (node.type === "manual") {
      return (
        <div className="manual-popup-parameters">
          <div className="manual-trigger-note">
            This node starts the workflow when you test it manually. Other trigger types can start the same workflow
            independently.
          </div>
          <p>This node does not have any parameters.</p>
        </div>
      );
    }
    if (node.type === "webhook") {
      return (
        <div className="node-popup-empty-copy">
          <strong>Webhook trigger</strong>
          <p>Webhook parameters will be enabled after the secure endpoint contract is available.</p>
        </div>
      );
    }
    return (
      <div className="node-popup-empty-copy">
        <strong>{node.label} parameters</strong>
        <p>Parameters for this node type are not configured yet.</p>
      </div>
    );
  })();

  return (
    <div className="node-popup-backdrop">
      <section className="node-popup" role="dialog" aria-modal="true" aria-label={`${node.label} node editor`}>
        <header className="node-popup-header">
          <div className="inspector-icon">
            <Settings2 size={16} />
          </div>
          <div className="node-popup-title">
            <small>{node.kind.toUpperCase()}</small>
            <strong>{node.label}</strong>
          </div>
          <div className="node-popup-actions">
            {isTrigger ? (
              <button
                type="button"
                className="manual-execute"
                onClick={executeTrigger}
                disabled={executing || Boolean(blockedMessage)}
              >
                <Play size={14} /> {executing ? "Executing…" : "Execute step"}
              </button>
            ) : node.type === "http-request" ? (
              <button
                type="button"
                className="manual-execute"
                onClick={executeHttpRequest}
                disabled={executing || !workflowId || hasUnsavedChanges}
              >
                <Play size={14} /> {executing ? "Sending…" : "Send request"}
              </button>
            ) : null}
            <button type="button" className="node-popup-close" onClick={onClose} aria-label="Close node parameters">
              <X size={17} />
            </button>
          </div>
        </header>
        {node.type === "http-request" ? (
          <div className="node-popup-body-http">
            <div className="http-body-panel">
              <div className="inspector-section-title">
                <Braces size={14} /> Payload
              </div>
              <textarea
                className="http-payload-editor"
                rows={14}
                value={(node.config.body as string) || ""}
                onChange={(e) => onConfigChange({ ...node.config, body: e.target.value })}
                placeholder='{"key": "value"}'
              />
            </div>
            <div className="http-config-panel">
              <div className="inspector-form">
                <div className="inspector-section-title">
                  <Globe2 size={14} /> Endpoint
                </div>
                <label>
                  Method
                  <select
                    value={(node.config.method as string) || "GET"}
                    onChange={(e) => onConfigChange({ ...node.config, method: e.target.value })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </label>
                <label>
                  URL
                  <input
                    type="url"
                    value={(node.config.url as string) || ""}
                    onChange={(e) => onConfigChange({ ...node.config, url: e.target.value })}
                    placeholder="https://api.example.com/data"
                  />
                </label>
                <label>
                  Headers (JSON)
                  <textarea
                    className="inspector-textarea"
                    rows={4}
                    value={
                      typeof node.config.headers === "string"
                        ? node.config.headers
                        : JSON.stringify(node.config.headers || {}, null, 2)
                    }
                    onChange={(e) => onConfigChange({ ...node.config, headers: e.target.value })}
                    placeholder='{"Content-Type": "application/json"}'
                  />
                </label>
              </div>
            </div>
            <div className="http-output-panel">
              <div className="node-popup-output-header">
                <span>
                  <Braces size={14} /> RESPONSE
                </span>
              </div>
              {error ? (
                <div className="manual-output-error" role="alert">
                  {error}
                </div>
              ) : null}
              {output.length > 0 ? (
                <pre className="node-popup-json">{JSON.stringify(output, null, 2)}</pre>
              ) : (
                <p className="node-popup-output-hint">Send the request to see the response.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="node-popup-body">
            <div className="node-popup-parameters">
              <div className="node-popup-tabs">
                <button
                  type="button"
                  className={activeTab === "parameters" ? "active" : ""}
                  onClick={() => setActiveTab("parameters")}
                >
                  Parameters
                </button>
                <button
                  type="button"
                  className={activeTab === "settings" ? "active" : ""}
                  onClick={() => setActiveTab("settings")}
                >
                  Settings
                </button>
              </div>
              <div className="node-popup-parameter-content">
                {parameterContent}
                {isTrigger && blockedMessage ? (
                  <div className="manual-output-error node-trigger-save-warning" role="alert">
                    {blockedMessage}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="node-popup-output">
              <div className="node-popup-output-header">
                <span>
                  <Braces size={14} /> OUTPUT
                </span>
                <div className="output-format-tabs">
                  <button
                    type="button"
                    className={outputFormat === "schema" ? "active" : ""}
                    onClick={() => setOutputFormat("schema")}
                  >
                    Schema
                  </button>
                  <button
                    type="button"
                    className={outputFormat === "table" ? "active" : ""}
                    onClick={() => setOutputFormat("table")}
                  >
                    <Table2 size={12} />
                    Table
                  </button>
                  <button
                    type="button"
                    className={outputFormat === "json" ? "active" : ""}
                    onClick={() => setOutputFormat("json")}
                  >
                    JSON
                  </button>
                </div>
                {isTrigger && (
                  <button
                    type="button"
                    className="output-edit-btn"
                    aria-label={editingPayload ? "Done editing" : "Edit output payload"}
                    onClick={() => {
                      if (editingPayload) {
                        try {
                          JSON.parse(draftPayload);
                          onConfigChange({ ...node.config, outputPayload: draftPayload });
                          setEditingPayload(false);
                        } catch {
                          setError("Invalid JSON payload — fix the syntax and try again.");
                        }
                      } else {
                        const current = node.config.outputPayload;
                        setDraftPayload(typeof current === "string" ? current : JSON.stringify(output, null, 2));
                        setEditingPayload(true);
                      }
                    }}
                  >
                    <Pencil size={13} />
                    {editingPayload ? "Done" : "Edit"}
                  </button>
                )}
              </div>
              {error ? (
                <div className="manual-output-error" role="alert">
                  {error}
                </div>
              ) : null}
              {editingPayload ? (
                <div className="output-edit-area">
                  <textarea
                    className="trigger-output-editor"
                    rows={14}
                    value={draftPayload}
                    onChange={(e) => setDraftPayload(e.target.value)}
                    placeholder='[{"key": "value"}]'
                  />
                  <p className="output-edit-hint">
                    Edit the JSON payload this trigger emits. Changes apply when you click Done.
                  </p>
                </div>
              ) : outputFormat === "json" ? (
                <pre className="node-popup-json">{JSON.stringify(output, null, 2)}</pre>
              ) : outputFormat === "table" ? (
                <OutputTableView data={output} />
              ) : (
                <OutputSchemaView data={output} />
              )}
              {!editingPayload && output.length === 0 ? (
                <p className="node-popup-output-hint">
                  {isTrigger
                    ? "Execute this trigger to emit JSON output."
                    : "This node receives JSON from its upstream node."}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OutputTableView({ data }: { data: unknown[] }) {
  const keys = useMemo(() => {
    const keySet = new Set<string>();
    for (const item of data) {
      if (typeof item === "object" && item !== null) {
        for (const k of Object.keys(item as Record<string, unknown>)) keySet.add(k);
      }
    }
    return [...keySet];
  }, [data]);

  if (data.length === 0 || keys.length === 0) {
    return <pre className="node-popup-json">{JSON.stringify(data, null, 2)}</pre>;
  }

  return (
    <div className="output-table-wrap">
      <table className="output-table">
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i}>
              {keys.map((key) => (
                <td key={key}>
                  {typeof (item as Record<string, unknown>)?.[key] === "object"
                    ? JSON.stringify((item as Record<string, unknown>)[key])
                    : String((item as Record<string, unknown>)?.[key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutputSchemaView({ data }: { data: unknown[] }) {
  const schema = useMemo(() => {
    if (data.length === 0) return "empty array";
    const types = new Set<string>();
    const props: Record<string, Set<string>> = {};
    for (const item of data) {
      types.add(typeof item);
      if (typeof item === "object" && item !== null) {
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (!props[k]) props[k] = new Set();
          props[k].add(Array.isArray(v) ? "array" : typeof v);
        }
      }
    }
    const lines: string[] = [`Array<${[...types].join(" | ")}>`];
    if (Object.keys(props).length > 0) {
      lines.push("{");
      for (const [key, typeSet] of Object.entries(props)) {
        lines.push(`  "${key}": ${[...typeSet].join(" | ")}`);
      }
      lines.push("}");
    }
    return lines.join("\n");
  }, [data]);

  return <pre className="node-popup-json">{schema}</pre>;
}

function ScheduleTriggerForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const value = { ...defaultScheduleConfig, ...config } as ScheduleTriggerConfig;
  const errors = validateScheduleConfig(value);
  const update = (patch: Partial<ScheduleTriggerConfig>) => onChange({ ...value, ...patch });
  const setMode = (mode: ScheduleTriggerConfig["mode"]) => {
    const base: Record<string, unknown> = {
      enabled: value.enabled,
      mode,
      timezone: value.timezone,
      misfirePolicy: value.misfirePolicy,
      outputPayload: config.outputPayload,
    };
    if (mode === "interval") base.intervalMinutes = 60;
    if (mode === "daily") base.time = "09:00";
    if (mode === "weekly") {
      base.time = "09:00";
      base.daysOfWeek = [1];
    }
    if (mode === "cron") base.cronExpression = "0 9 * * *";
    onChange(base);
  };
  return (
    <div className="inspector-form">
      <div className="inspector-section-title">
        <Clock3 size={14} /> Trigger rules
      </div>
      <label className="toggle-row">
        <span>
          <strong>Enabled</strong>
          <small>Allow this schedule to trigger runs</small>
        </span>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
      </label>
      <label>
        Run mode
        <select value={value.mode} onChange={(event) => setMode(event.target.value as ScheduleTriggerConfig["mode"])}>
          <option value="interval">Interval</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="cron">Cron</option>
        </select>
      </label>
      {value.mode === "interval" && (
        <label>
          Every (minutes)
          <input
            type="number"
            min={1}
            max={43200}
            value={value.intervalMinutes ?? 60}
            onChange={(event) => update({ intervalMinutes: Number(event.target.value) })}
          />
        </label>
      )}
      {(value.mode === "daily" || value.mode === "weekly") && (
        <label>
          Time
          <input type="time" value={value.time ?? "09:00"} onChange={(event) => update({ time: event.target.value })} />
        </label>
      )}
      {value.mode === "weekly" && (
        <fieldset>
          <legend>Days</legend>
          <div className="weekday-grid">
            {weekdays.map((day, index) => {
              const selected = value.daysOfWeek?.includes(index) ?? false;
              return (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      update({
                        daysOfWeek: selected
                          ? value.daysOfWeek?.filter((item) => item !== index)
                          : [...(value.daysOfWeek ?? []), index],
                      })
                    }
                  />
                  {day}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {value.mode === "cron" && (
        <label>
          Cron expression
          <input
            value={value.cronExpression ?? "0 9 * * *"}
            onChange={(event) => update({ cronExpression: event.target.value })}
          />
          <small>Five fields: minute hour day month weekday</small>
        </label>
      )}
      <label>
        Timezone
        <input
          value={value.timezone}
          onChange={(event) => update({ timezone: event.target.value })}
          list="workflow-timezones"
        />
        <datalist id="workflow-timezones">
          <option value="Asia/Bangkok" />
          <option value="UTC" />
          <option value="Asia/Tokyo" />
          <option value="America/New_York" />
          <option value="Europe/London" />
        </datalist>
      </label>
      <label>
        Missed run
        <select
          value={value.misfirePolicy}
          onChange={(event) => update({ misfirePolicy: event.target.value as ScheduleTriggerConfig["misfirePolicy"] })}
        >
          <option value="skip">Skip missed runs</option>
          <option value="run-once">Run once after recovery</option>
        </select>
      </label>
      <div className={`schedule-preview ${errors.length ? "invalid" : ""}`}>
        <small>SCHEDULE PREVIEW</small>
        <strong>{describeSchedule(value)}</strong>
        {errors.map((error, i) => (
          <p key={`${error}-${i}`}>{error}</p>
        ))}
      </div>
      <button
        type="button"
        className="inspector-reset"
        onClick={() => onChange({ ...defaultScheduleConfig, outputPayload: config.outputPayload })}
      >
        Reset to defaults
      </button>
    </div>
  );
}
