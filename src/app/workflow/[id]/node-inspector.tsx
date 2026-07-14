"use client";
import { Braces, Clock3, Play, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [output, setOutput] = useState<unknown[]>(() => {
    const custom = node?.config?.outputPayload;
    if (typeof custom === "string" && custom.trim()) {
      try {
        const parsed = JSON.parse(custom);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (node?.config?.outputPayload) {
      const custom = node.config.outputPayload;
      if (typeof custom === "string" && custom.trim()) {
        try {
          const parsed = JSON.parse(custom);
          setOutput(Array.isArray(parsed) ? parsed : [parsed]);
          return;
        } catch {
          /* not valid JSON yet */
        }
      }
    }
    setOutput([]);
  }, [node?.config?.outputPayload]);

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
          <TriggerOutputForm config={node.config} onChange={onConfigChange} />
        </div>
      );
    }
    if (node.type === "webhook") {
      return (
        <div className="manual-popup-parameters">
          <div className="manual-trigger-note">
            Webhook parameters will be enabled after the secure endpoint contract is available.
          </div>
          <TriggerOutputForm config={node.config} onChange={onConfigChange} />
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
            ) : null}
            <button type="button" className="node-popup-close" onClick={onClose} aria-label="Close node parameters">
              <X size={17} />
            </button>
          </div>
        </header>
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
              <small>JSON</small>
            </div>
            {error ? (
              <div className="manual-output-error" role="alert">
                {error}
              </div>
            ) : null}
            <pre className="node-popup-json">{JSON.stringify(output, null, 2)}</pre>
            {output.length === 0 ? (
              <p className="node-popup-output-hint">
                {isTrigger
                  ? "Execute this trigger to emit JSON output."
                  : "This node receives JSON from its upstream node."}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function TriggerOutputForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const raw = (config.outputPayload as string) ?? "";
  const [jsonError, setJsonError] = useState("");
  return (
    <div className="inspector-form">
      <div className="inspector-section-title">
        <Braces size={14} /> Custom output payload
      </div>
      <p style={{ fontSize: 10, color: "var(--muted)", margin: 0 }}>
        Define the JSON this trigger emits. Leave empty to use the backend response.
      </p>
      <textarea
        className="trigger-output-editor"
        rows={8}
        value={raw}
        onChange={(event) => {
          const val = event.target.value;
          setJsonError("");
          try {
            if (val.trim()) JSON.parse(val);
          } catch {
            setJsonError("Invalid JSON");
          }
          onChange({ ...config, outputPayload: val });
        }}
        placeholder='[{"key": "value"}]'
      />
      {jsonError ? (
        <small style={{ color: "var(--red)" }} role="alert">
          {jsonError}
        </small>
      ) : null}
    </div>
  );
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
      <TriggerOutputForm config={config} onChange={onChange} />
    </div>
  );
}
