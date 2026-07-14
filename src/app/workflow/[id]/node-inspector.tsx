"use client";
import {
  ArrowRight,
  Braces,
  Clock3,
  ExternalLink,
  FlaskConical,
  Globe2,
  Pencil,
  Play,
  Plus,
  Settings2,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseStudioGraphExecutionDetail, type StudioCredential, type StudioCredentialType } from "@/lib/studio-admin";
import {
  defaultScheduleConfig,
  describeSchedule,
  type HTTPRequestConfig,
  type HTTPRequestQueryParameter,
  httpRequestConfigFromRecord,
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
  const [input, setInput] = useState<unknown[]>([]);
  const [executionStatus, setExecutionStatus] = useState("");
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"json" | "table" | "schema">("json");
  const [editingPayload, setEditingPayload] = useState(false);
  const [draftPayload, setDraftPayload] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

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
    if (node?.type === "http-request") {
      setInput([]);
      setOutput([]);
      setExecutionStatus("");
      return;
    }
    syncOutputFromPayload(node?.config?.outputPayload as string | undefined);
  }, [node?.config?.outputPayload, node?.type, syncOutputFromPayload]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleDialogKeys);
      previouslyFocused?.focus();
    };
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
    setExecutionStatus("Queuing previous nodes…");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute-previous",
          workflowId,
          nodeId: node.id,
          sourceKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok || typeof payload.data?.id !== "string")
        throw new Error(payload.error?.message ?? "Unable to start previous-node execution.");

      const executionId = payload.data.id as string;
      for (let attempt = 0; attempt < 140; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 500));
        const detailResponse = await fetch("/api/studio/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-execution", id: executionId }),
        });
        const detailPayload = await detailResponse.json();
        if (!detailResponse.ok || !detailPayload.ok)
          throw new Error(detailPayload.error?.message ?? "Unable to load execution progress.");
        const detail = parseStudioGraphExecutionDetail(detailPayload.data);
        const currentStage = detail.stages.find((stage) => stage.nodeId === node.id);
        if (currentStage) {
          setInput(Array.isArray(currentStage.input) ? currentStage.input : []);
          if (Array.isArray(currentStage.output)) setOutput(currentStage.output);
        }
        setExecutionStatus(
          detail.execution.status === "queued"
            ? "Queued…"
            : detail.execution.status === "running"
              ? `Running ${detail.stages.filter((stage) => stage.status === "completed").length}/${detail.stages.length} nodes…`
              : detail.execution.status,
        );
        if (detail.execution.status === "completed") return;
        if (detail.execution.status === "failed" || detail.execution.status === "cancelled")
          throw new Error(detail.execution.errorMessage || `Execution ${detail.execution.status}.`);
      }
      throw new Error("Execution is still running. Reopen this node to refresh its latest data.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Previous-node execution failed.");
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
      <section
        ref={dialogRef}
        className={`node-popup${node.type === "http-request" ? " node-popup-http" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${node.label} node editor`}
        tabIndex={-1}
      >
        <header className="node-popup-header">
          <div className="inspector-icon">
            {node.type === "http-request" ? <Globe2 size={16} /> : <Settings2 size={16} />}
          </div>
          <div className="node-popup-title">
            {node.type !== "http-request" ? <small>{node.kind.toUpperCase()}</small> : null}
            <strong>{node.label}</strong>
          </div>
          <div className="node-popup-actions">
            {node.type === "http-request" ? (
              <a
                className="node-popup-docs"
                href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/"
                target="_blank"
                rel="noreferrer"
              >
                Docs <ExternalLink size={12} />
              </a>
            ) : isTrigger ? (
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
        {node.type === "http-request" ? (
          <HttpRequestWorkspace
            node={node}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            output={output}
            setOutput={setOutput}
            input={input}
            executionStatus={executionStatus}
            outputFormat={outputFormat}
            setOutputFormat={setOutputFormat}
            editingPayload={editingPayload}
            setEditingPayload={setEditingPayload}
            draftPayload={draftPayload}
            setDraftPayload={setDraftPayload}
            error={error}
            setError={setError}
            executing={executing}
            canExecute={Boolean(workflowId) && !hasUnsavedChanges}
            onExecute={executeHttpRequest}
            onConfigChange={onConfigChange}
          />
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

function HttpRequestWorkspace({
  node,
  activeTab,
  setActiveTab,
  output,
  setOutput,
  input,
  executionStatus,
  outputFormat,
  setOutputFormat,
  editingPayload,
  setEditingPayload,
  draftPayload,
  setDraftPayload,
  error,
  setError,
  executing,
  canExecute,
  onExecute,
  onConfigChange,
}: {
  node: WorkflowNodeDefinition;
  activeTab: "parameters" | "settings";
  setActiveTab: (tab: "parameters" | "settings") => void;
  output: unknown[];
  setOutput: (output: unknown[]) => void;
  input: unknown[];
  executionStatus: string;
  outputFormat: "json" | "table" | "schema";
  setOutputFormat: (format: "json" | "table" | "schema") => void;
  editingPayload: boolean;
  setEditingPayload: (editing: boolean) => void;
  draftPayload: string;
  setDraftPayload: (value: string) => void;
  error: string;
  setError: (value: string) => void;
  executing: boolean;
  canExecute: boolean;
  onExecute: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
}) {
  const requestConfig = useMemo(() => httpRequestConfigFromRecord(node.config), [node.config]);
  const headerText =
    typeof requestConfig.headers === "string"
      ? requestConfig.headers
      : JSON.stringify(requestConfig.headers || {}, null, 2);
  const bodyText = requestConfig.body;
  const [showQueryParameters, setShowQueryParameters] = useState(requestConfig.queryParameters.length > 0);
  const [showHeaders, setShowHeaders] = useState(headerText !== "{}" && headerText.trim() !== "");
  const [showBody, setShowBody] = useState(bodyText.trim() !== "");
  const [inputFormat, setInputFormat] = useState<"json" | "table" | "schema">("json");
  const [credentials, setCredentials] = useState<StudioCredential[]>([]);
  const [credentialsError, setCredentialsError] = useState("");
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentialAction, setCredentialAction] = useState(false);
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlCommand, setCurlCommand] = useState("");
  const [curlWarnings, setCurlWarnings] = useState<string[]>([]);
  const [importingCurl, setImportingCurl] = useState(false);

  const saveRequestConfig = (patch: Partial<HTTPRequestConfig>) => {
    onConfigChange({ ...node.config, ...requestConfig, ...patch });
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/studio/credentials", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Unable to load credentials.");
        setCredentials(Array.isArray(payload.data) ? payload.data : []);
        setCredentialsError("");
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setCredentialsError(cause instanceof Error ? cause.message : "Unable to load credentials.");
      });
    return () => controller.abort();
  }, []);

  const executeLabel = executing ? "Executing…" : "Execute step";
  const emptyExecutionHint = canExecute ? "" : "Save your workflow changes before executing this node.";

  const saveMockOutput = () => {
    try {
      const parsed = JSON.parse(draftPayload);
      const nextOutput = Array.isArray(parsed) ? parsed : [parsed];
      setOutput(nextOutput);
      setEditingPayload(false);
      setError("");
      return true;
    } catch {
      setError("Invalid JSON payload — fix the syntax and try again.");
      return null;
    }
  };

  const importCurl = async () => {
    if (!curlCommand.trim()) return;
    setImportingCurl(true);
    setError("");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-curl", command: curlCommand }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Unable to import cURL command.");
      const imported = payload.data as {
        method: HTTPRequestConfig["method"];
        url: string;
        headers: Record<string, string>;
        body: string;
        queryParameters: HTTPRequestQueryParameter[];
        warnings?: string[];
      };
      saveRequestConfig({
        method: imported.method,
        url: imported.url,
        headers: imported.headers,
        body: imported.body,
        queryParameters: imported.queryParameters,
      });
      setShowHeaders(Object.keys(imported.headers || {}).length > 0);
      setShowBody(Boolean(imported.body));
      setShowQueryParameters((imported.queryParameters || []).length > 0);
      setCurlWarnings(imported.warnings || []);
      setCurlCommand("");
      setShowCurlImport(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to import cURL command.");
    } finally {
      setImportingCurl(false);
    }
  };

  const runCredentialAction = async (action: "test-credential" | "delete-credential") => {
    if (!requestConfig.credentialId) return;
    if (
      action === "delete-credential" &&
      !window.confirm("Delete this saved credential? Workflows using it will stop executing.")
    )
      return;
    setCredentialAction(true);
    setCredentialsError("");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: requestConfig.credentialId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Credential action failed.");
      if (action === "delete-credential") {
        setCredentials((items) => items.filter((item) => item.id !== requestConfig.credentialId));
        saveRequestConfig({ authMode: "none", credentialId: undefined });
        setCredentialsError("Credential deleted.");
      } else {
        setCredentialsError("Credential encryption and schema are valid.");
      }
    } catch (cause) {
      setCredentialsError(cause instanceof Error ? cause.message : "Credential action failed.");
    } finally {
      setCredentialAction(false);
    }
  };

  return (
    <div className="node-popup-body-http">
      <section className="http-workspace-input" aria-label="Input data">
        <div className="http-pane-header">
          <span>INPUT</span>
          <FormatTabs value={inputFormat} onChange={setInputFormat} />
        </div>
        <div className="http-input-source">
          <select aria-label="Input source" defaultValue="manual-trigger">
            <option value="manual-trigger">Manual Test Trigger</option>
          </select>
        </div>
        {input.length > 0 ? (
          <div className="http-input-data">
            <pre className="node-popup-json">{JSON.stringify(input, null, 2)}</pre>
          </div>
        ) : (
          <div className="http-empty-state">
            <ArrowRight size={22} />
            <strong>No input data</strong>
            <button
              type="button"
              className="manual-execute"
              onClick={onExecute}
              disabled={executing || !canExecute}
              title={emptyExecutionHint}
            >
              {executing ? "Executing previous nodes…" : "Execute previous nodes"}
            </button>
            <span>
              {canExecute ? "Run the trigger and every upstream node through this node." : emptyExecutionHint}
            </span>
          </div>
        )}
        {executionStatus ? (
          <div className="http-execution-status" role="status">
            {executionStatus}
          </div>
        ) : null}
      </section>

      <section className="http-workspace-parameters" aria-label="HTTP Request parameters">
        <div className="http-parameter-toolbar">
          <div className="node-popup-tabs">
            <button
              type="button"
              className={activeTab === "parameters" ? "active" : ""}
              aria-pressed={activeTab === "parameters"}
              onClick={() => setActiveTab("parameters")}
            >
              Parameters
            </button>
            <button
              type="button"
              className={activeTab === "settings" ? "active" : ""}
              aria-pressed={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </button>
          </div>
          <button
            type="button"
            className="manual-execute http-toolbar-execute"
            onClick={onExecute}
            disabled={executing || !canExecute}
            title={emptyExecutionHint}
          >
            <FlaskConical size={14} /> {executeLabel}
          </button>
        </div>
        <div className="http-parameter-content">
          {activeTab === "settings" ? (
            <div className="inspector-form http-request-form">
              <label>
                Timeout (milliseconds)
                <input
                  type="number"
                  min={1000}
                  max={30000}
                  step={500}
                  value={requestConfig.options.timeoutMs}
                  onChange={(event) =>
                    saveRequestConfig({
                      options: { ...requestConfig.options, timeoutMs: Number(event.target.value) },
                    })
                  }
                />
              </label>
              <HttpOptionToggle
                label="Follow redirects"
                checked={requestConfig.options.followRedirects}
                onChange={(checked) =>
                  saveRequestConfig({ options: { ...requestConfig.options, followRedirects: checked } })
                }
              />
              <label>
                Maximum redirects
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={requestConfig.options.maxRedirects}
                  disabled={!requestConfig.options.followRedirects}
                  onChange={(event) =>
                    saveRequestConfig({
                      options: { ...requestConfig.options, maxRedirects: Number(event.target.value) },
                    })
                  }
                />
              </label>
              <label>
                Response format
                <select
                  value={requestConfig.options.responseFormat}
                  onChange={(event) =>
                    saveRequestConfig({
                      options: {
                        ...requestConfig.options,
                        responseFormat: event.target.value as HTTPRequestConfig["options"]["responseFormat"],
                      },
                    })
                  }
                >
                  <option value="auto">Auto detect</option>
                  <option value="json">JSON</option>
                  <option value="text">Text</option>
                </select>
              </label>
              <HttpOptionToggle
                label="Include response headers"
                checked={requestConfig.options.includeResponseHeaders}
                onChange={(checked) =>
                  saveRequestConfig({ options: { ...requestConfig.options, includeResponseHeaders: checked } })
                }
              />
              <HttpOptionToggle
                label="Return non-2xx/3xx responses as output"
                checked={requestConfig.options.ignoreHttpStatusErrors}
                onChange={(checked) =>
                  saveRequestConfig({ options: { ...requestConfig.options, ignoreHttpStatusErrors: checked } })
                }
              />
            </div>
          ) : (
            <>
              <div className="http-import-row">
                <button
                  type="button"
                  className="http-secondary-button"
                  onClick={() => setShowCurlImport((open) => !open)}
                >
                  Import cURL
                </button>
              </div>
              {showCurlImport ? (
                <div className="http-curl-import">
                  <label>
                    cURL command
                    <textarea
                      className="inspector-textarea"
                      rows={5}
                      value={curlCommand}
                      onChange={(event) => setCurlCommand(event.target.value)}
                      placeholder="curl 'https://api.example.com/items'"
                    />
                  </label>
                  <button
                    type="button"
                    className="manual-execute"
                    onClick={importCurl}
                    disabled={importingCurl || !curlCommand.trim()}
                  >
                    {importingCurl ? "Importing…" : "Import request"}
                  </button>
                </div>
              ) : null}
              {curlWarnings.map((warning) => (
                <div key={warning} className="http-request-note" role="status">
                  {warning}
                </div>
              ))}
              <div className="inspector-form http-request-form">
                <label>
                  Method
                  <select
                    value={requestConfig.method}
                    onChange={(event) =>
                      saveRequestConfig({ method: event.target.value as HTTPRequestConfig["method"] })
                    }
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
                    value={requestConfig.url}
                    onChange={(event) => saveRequestConfig({ url: event.target.value })}
                    placeholder="https://api.example.com/data"
                  />
                </label>
                <label>
                  Authentication
                  <select
                    value={requestConfig.authMode}
                    onChange={(event) => {
                      const authMode = event.target.value as HTTPRequestConfig["authMode"];
                      saveRequestConfig({
                        authMode,
                        credentialId: authMode === "credential" ? requestConfig.credentialId : undefined,
                      });
                    }}
                  >
                    <option value="none">None</option>
                    <option value="credential">Saved credential</option>
                  </select>
                </label>
                {requestConfig.authMode === "credential" ? (
                  <label>
                    Credential
                    <select
                      value={requestConfig.credentialId || ""}
                      onChange={(event) => saveRequestConfig({ credentialId: event.target.value })}
                    >
                      <option value="">Select a credential</option>
                      {credentials.map((credential) => (
                        <option key={credential.id} value={credential.id}>
                          {credential.name} ({credential.type})
                        </option>
                      ))}
                    </select>
                    {credentialsError ? (
                      <span className="http-field-error" role="status">
                        {credentialsError}
                      </span>
                    ) : null}
                    <span className="http-inline-actions">
                      <button
                        type="button"
                        className="http-secondary-button"
                        onClick={() => setShowCredentialForm((open) => !open)}
                      >
                        <Plus size={12} /> New credential
                      </button>
                      <button
                        type="button"
                        className="http-secondary-button"
                        disabled={!requestConfig.credentialId || credentialAction}
                        onClick={() => runCredentialAction("test-credential")}
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        className="http-icon-button"
                        aria-label="Delete selected credential"
                        disabled={!requestConfig.credentialId || credentialAction}
                        onClick={() => runCredentialAction("delete-credential")}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </label>
                ) : null}
                {showCredentialForm ? (
                  <CredentialCreateForm
                    onCancel={() => setShowCredentialForm(false)}
                    onCreated={(credential) => {
                      setCredentials((items) => [credential, ...items]);
                      saveRequestConfig({ authMode: "credential", credentialId: credential.id });
                      setShowCredentialForm(false);
                    }}
                  />
                ) : null}

                <HttpOptionToggle
                  label="Send Query Parameters"
                  checked={showQueryParameters}
                  onChange={(checked) => {
                    setShowQueryParameters(checked);
                    if (!checked) saveRequestConfig({ queryParameters: [] });
                    if (checked && requestConfig.queryParameters.length === 0)
                      saveRequestConfig({ queryParameters: [{ name: "", value: "" }] });
                  }}
                />
                {showQueryParameters ? (
                  <div className="http-key-value-list">
                    {requestConfig.queryParameters.map((parameter, index) => (
                      <div className="http-key-value-row" key={`${index}-${parameter.name}`}>
                        <input
                          aria-label={`Query parameter ${index + 1} name`}
                          value={parameter.name}
                          placeholder="Name"
                          onChange={(event) => {
                            const queryParameters = requestConfig.queryParameters.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            );
                            saveRequestConfig({ queryParameters });
                          }}
                        />
                        <input
                          aria-label={`Query parameter ${index + 1} value`}
                          value={parameter.value}
                          placeholder="Value"
                          onChange={(event) => {
                            const queryParameters = requestConfig.queryParameters.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, value: event.target.value } : item,
                            );
                            saveRequestConfig({ queryParameters });
                          }}
                        />
                        <button
                          type="button"
                          className="http-icon-button"
                          aria-label={`Remove query parameter ${index + 1}`}
                          onClick={() =>
                            saveRequestConfig({
                              queryParameters: requestConfig.queryParameters.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="http-secondary-button"
                      onClick={() =>
                        saveRequestConfig({
                          queryParameters: [...requestConfig.queryParameters, { name: "", value: "" }],
                        })
                      }
                    >
                      <Plus size={13} /> Add parameter
                    </button>
                  </div>
                ) : null}

                <HttpOptionToggle
                  label="Send Headers"
                  checked={showHeaders}
                  onChange={(checked) => {
                    setShowHeaders(checked);
                    if (!checked) saveRequestConfig({ headers: {} });
                  }}
                />
                {showHeaders ? (
                  <label>
                    Headers (JSON)
                    <textarea
                      className="inspector-textarea"
                      rows={4}
                      value={headerText}
                      onChange={(event) => saveRequestConfig({ headers: event.target.value })}
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </label>
                ) : null}

                <HttpOptionToggle
                  label="Send Body"
                  checked={showBody}
                  onChange={(checked) => {
                    setShowBody(checked);
                    if (!checked) saveRequestConfig({ body: "" });
                  }}
                />
                {showBody ? (
                  <label>
                    Body (JSON)
                    <textarea
                      className="inspector-textarea"
                      rows={6}
                      value={bodyText}
                      onChange={(event) => saveRequestConfig({ body: event.target.value })}
                      placeholder='{"key": "value"}'
                    />
                  </label>
                ) : null}

                <div className="http-request-note">
                  Configure timeout, redirects, response format, and status handling in the Settings tab.
                </div>
                {!canExecute ? (
                  <div className="manual-output-error" role="alert">
                    {emptyExecutionHint}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
        <span className="http-feedback-link">♧ I wish this node would…</span>
      </section>

      <section className="http-workspace-output" aria-label="Output data">
        <div className="http-pane-header">
          <span>OUTPUT</span>
          <FormatTabs value={outputFormat} onChange={setOutputFormat} />
          <button
            type="button"
            className="output-edit-btn http-output-edit"
            aria-label={editingPayload ? "Apply mock output" : "Edit mock output"}
            onClick={() => {
              if (editingPayload) {
                saveMockOutput();
              } else {
                setDraftPayload(JSON.stringify(output, null, 2));
                setEditingPayload(true);
              }
            }}
          >
            <Pencil size={13} />
          </button>
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
              onChange={(event) => setDraftPayload(event.target.value)}
              placeholder='[{"key": "value"}]'
            />
            <p className="output-edit-hint">Mock output remains local to this editor session.</p>
          </div>
        ) : output.length > 0 ? (
          outputFormat === "json" ? (
            <pre className="node-popup-json">{JSON.stringify(output, null, 2)}</pre>
          ) : outputFormat === "table" ? (
            <OutputTableView data={output} />
          ) : (
            <OutputSchemaView data={output} />
          )
        ) : (
          <div className="http-empty-state">
            <ArrowRight size={22} />
            <strong>No output data</strong>
            <button
              type="button"
              className="manual-execute"
              onClick={onExecute}
              disabled={executing || !canExecute}
              title={emptyExecutionHint}
            >
              {executeLabel}
            </button>
            <span>
              or{" "}
              <button
                type="button"
                className="http-mock-link"
                onClick={() => {
                  setDraftPayload("[]");
                  setEditingPayload(true);
                }}
              >
                set mock data
              </button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function CredentialCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (credential: StudioCredential) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<StudioCredentialType>("bearer");
  const [firstValue, setFirstValue] = useState("");
  const [secondValue, setSecondValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const firstLabel = type === "bearer" ? "Token" : type === "basic" ? "Username" : "Parameter/header name";
  const secondLabel = type === "basic" ? "Password" : "Value";

  const createCredential = async () => {
    setSaving(true);
    setFormError("");
    try {
      const data =
        type === "bearer"
          ? { token: firstValue }
          : type === "basic"
            ? { username: firstValue, password: secondValue }
            : { name: firstValue, value: secondValue };
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-credential", payload: { name, type, data } }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Unable to create credential.");
      setFirstValue("");
      setSecondValue("");
      onCreated(payload.data as StudioCredential);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to create credential.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="http-credential-form">
      <strong>New encrypted credential</strong>
      <label>
        Name
        <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Type
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value as StudioCredentialType);
            setFirstValue("");
            setSecondValue("");
          }}
        >
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic authentication</option>
          <option value="header">Header/API key</option>
          <option value="query">Query API key</option>
        </select>
      </label>
      <label>
        {firstLabel}
        <input
          type={type === "bearer" ? "password" : "text"}
          autoComplete="off"
          value={firstValue}
          onChange={(event) => setFirstValue(event.target.value)}
        />
      </label>
      {type !== "bearer" ? (
        <label>
          {secondLabel}
          <input
            type="password"
            autoComplete="new-password"
            value={secondValue}
            onChange={(event) => setSecondValue(event.target.value)}
          />
        </label>
      ) : null}
      {formError ? (
        <span className="http-field-error" role="alert">
          {formError}
        </span>
      ) : null}
      <div className="http-inline-actions">
        <button
          type="button"
          className="manual-execute"
          disabled={saving || name.trim().length < 2 || !firstValue || (type !== "bearer" && !secondValue)}
          onClick={createCredential}
        >
          {saving ? "Saving…" : "Save credential"}
        </button>
        <button type="button" className="http-secondary-button" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <small>Secret values are encrypted by the backend and are never returned to this browser.</small>
    </div>
  );
}

function FormatTabs({
  value,
  onChange,
}: {
  value: "json" | "table" | "schema";
  onChange: (format: "json" | "table" | "schema") => void;
}) {
  return (
    <div className="output-format-tabs">
      <button
        type="button"
        className={value === "schema" ? "active" : ""}
        aria-pressed={value === "schema"}
        onClick={() => onChange("schema")}
      >
        Schema
      </button>
      <button
        type="button"
        className={value === "table" ? "active" : ""}
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
      >
        Table
      </button>
      <button
        type="button"
        className={value === "json" ? "active" : ""}
        aria-pressed={value === "json"}
        onClick={() => onChange("json")}
      >
        JSON
      </button>
    </div>
  );
}

function HttpOptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="http-option-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="http-switch" aria-hidden="true" />
      <strong>{label}</strong>
    </label>
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
