import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NodeInspector } from "./node-inspector";

const httpRequestNode = {
  id: "http-request-1",
  type: "http-request" as const,
  kind: "action" as const,
  label: "Get US High Impact Calendar",
  position: { x: 240, y: 70 },
  config: {
    method: "GET",
    url: "https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
    authMode: "none",
    headers: {},
    body: "",
    queryParameters: [],
    options: {
      timeoutMs: 30000,
      followRedirects: true,
      maxRedirects: 5,
      responseFormat: "auto",
      includeResponseHeaders: true,
      ignoreHttpStatusErrors: true,
    },
  },
};

const definition = {
  version: 1 as const,
  nodes: [
    {
      id: "manual-trigger",
      type: "manual" as const,
      kind: "trigger" as const,
      label: "Manual Test Trigger",
      position: { x: 0, y: 70 },
      config: { enabled: true, outputPayload: "[]" },
    },
    httpRequestNode,
  ],
  edges: [{ id: "manual-to-http", source: "manual-trigger", target: httpRequestNode.id }],
};

describe("HTTP Request node editor", () => {
  test("renders the n8n-style input, parameters, and output workspace", () => {
    const html = renderToStaticMarkup(
      <NodeInspector
        node={httpRequestNode}
        definition={definition}
        workflowId="workflow-1"
        hasUnsavedChanges={false}
        onClose={() => {}}
        onConfigChange={() => {}}
      />,
    );

    expect(html).toContain('class="http-workspace-input"');
    expect(html).toContain('class="http-workspace-parameters"');
    expect(html).toContain('class="http-workspace-output"');
    expect(html).toContain("Manual Test Trigger");
    expect(html).toContain("Execute previous nodes");
    expect(html).toContain("Import cURL");
    expect(html).toContain("Authentication");
    expect(html).toContain("Send Query Parameters");
    expect(html).toContain("Send Headers");
    expect(html).toContain("Send Body");
    expect(html).toContain("Generic Credential Type");
    expect(html).toContain("Configure timeout, redirects, response format, and status handling in the Settings tab.");
    expect(html).toContain("No output data");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Run the trigger and every upstream node through this node.");
  });

  test("renders Generic Credential Type with Header Auth and a saved Header Auth selector", () => {
    const credentialNode = {
      ...httpRequestNode,
      config: {
        ...httpRequestNode.config,
        authMode: "credential",
        genericAuthType: "headerAuth",
        credentialId: "cred-header-1",
      },
    };
    const html = renderToStaticMarkup(
      <NodeInspector
        node={credentialNode}
        definition={{ ...definition, nodes: [definition.nodes[0], credentialNode] }}
        workflowId="workflow-1"
        hasUnsavedChanges={false}
        onClose={() => {}}
        onConfigChange={() => {}}
      />,
    );

    expect(html).toContain("Generic Auth Type");
    expect(html).toContain("Header Auth");
    expect(html).toContain('aria-label="Edit selected Header Auth credential"');
    expect(html).not.toContain("Bearer token");
    expect(html).not.toContain("Basic authentication");
    expect(html).not.toContain("Query API key");
  });

  test("clears an unavailable or non-Header Auth credential after metadata loads", async () => {
    const source = await Bun.file(new URL("./node-inspector.tsx", import.meta.url)).text();
    expect(source).toContain("!credentialsLoaded");
    expect(source).toContain("credentialId: undefined");
    expect(source).toContain("not an active Header Auth connection");
  });

  test("shows the save guard and disables request execution for dirty workflows", () => {
    const html = renderToStaticMarkup(
      <NodeInspector
        node={httpRequestNode}
        definition={definition}
        workflowId="workflow-1"
        hasUnsavedChanges
        onClose={() => {}}
        onConfigChange={() => {}}
      />,
    );

    expect(html).toContain("Save your workflow changes before executing this node.");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test("keeps execution polling alive across parameter and trigger-list edits", async () => {
    const source = await Bun.file(new URL("./node-inspector.tsx", import.meta.url)).text();
    expect(source).toContain("[node?.id, node?.type]");
    expect(source).toContain("executionAbortRef.current = null;\n    setExecuting(false);");
    expect(
      source.match(/controller\.signal\.aborted \|\| executionAbortRef\.current !== controller/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
    expect(source).not.toContain(
      "[defaultTriggerId, enabledTriggers, node?.config?.outputPayload, node?.type, syncOutputFromPayload]",
    );
  });

  test("uses Execute step consistently for the request actions", () => {
    const html = renderToStaticMarkup(
      <NodeInspector
        node={httpRequestNode}
        definition={definition}
        workflowId="workflow-1"
        hasUnsavedChanges={false}
        onClose={() => {}}
        onConfigChange={() => {}}
      />,
    );

    expect(html.match(/Execute step/g)?.length).toBe(2);
    expect(html).not.toContain("Send request");
  });
});
