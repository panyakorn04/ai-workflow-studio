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

describe("HTTP Request node editor", () => {
  test("renders the n8n-style input, parameters, and output workspace", () => {
    const html = renderToStaticMarkup(
      <NodeInspector
        node={httpRequestNode}
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
    expect(html).toContain("Saved credential");
    expect(html).toContain("Configure timeout, redirects, response format, and status handling in the Settings tab.");
    expect(html).toContain("No output data");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Run the trigger and every upstream node through this node.");
  });

  test("shows the save guard and disables request execution for dirty workflows", () => {
    const html = renderToStaticMarkup(
      <NodeInspector
        node={httpRequestNode}
        workflowId="workflow-1"
        hasUnsavedChanges
        onClose={() => {}}
        onConfigChange={() => {}}
      />,
    );

    expect(html).toContain("Save your workflow changes before executing this node.");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test("uses Execute step consistently for the request actions", () => {
    const html = renderToStaticMarkup(
      <NodeInspector
        node={httpRequestNode}
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
