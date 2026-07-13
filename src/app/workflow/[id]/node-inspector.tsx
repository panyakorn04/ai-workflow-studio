"use client";
import { Clock3, Settings2, X } from "lucide-react";
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
  onClose,
  onConfigChange,
}: {
  node: WorkflowNodeDefinition | null;
  onClose: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  if (!node) return null;
  return (
    <aside className="node-inspector" aria-label="Node parameters">
      <header>
        <div className="inspector-icon">
          <Settings2 size={16} />
        </div>
        <div>
          <small>{node.kind.toUpperCase()}</small>
          <strong>{node.label}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close node parameters">
          <X size={16} />
        </button>
      </header>
      {node.type === "schedule" ? (
        <ScheduleTriggerForm config={node.config} onChange={onConfigChange} />
      ) : node.type === "manual" ? (
        <div className="inspector-empty">
          <strong>Manual trigger</strong>
          <p>This workflow runs only when you click Run.</p>
        </div>
      ) : node.type === "webhook" ? (
        <div className="inspector-empty">
          <strong>Webhook trigger</strong>
          <p>Webhook parameters will be enabled after the secure endpoint contract is available.</p>
        </div>
      ) : (
        <div className="inspector-empty">
          <strong>{node.label} parameters</strong>
          <p>Parameters for this node type are not configured yet.</p>
        </div>
      )}
    </aside>
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
    const base: ScheduleTriggerConfig = {
      enabled: value.enabled,
      mode,
      timezone: value.timezone,
      misfirePolicy: value.misfirePolicy,
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
        {errors.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </div>
      <button type="button" className="inspector-reset" onClick={() => onChange({ ...defaultScheduleConfig })}>
        Reset to defaults
      </button>
    </div>
  );
}
