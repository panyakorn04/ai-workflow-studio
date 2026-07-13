import { describe, expect, test } from "bun:test";
import { getStudioOverview, parseStudioOverview } from "./studio-api";

describe("studio API contract", () => {
  test("accepts the backend success envelope", () => {
    const result = parseStudioOverview({
      ok: true,
      data: {
        workflows: [
          {
            id: "wf-1",
            name: "Research",
            description: "Research flow",
            category: "Research",
            status: "active",
            runs: 12,
            success: 99,
            updated: "now",
            nodes: ["Search"],
          },
        ],
        executions: [
          {
            id: "run-1",
            workflow: "Research",
            status: "running",
            started: "now",
            duration: "00:10",
            durationMs: 10000,
            cost: 0.01,
          },
        ],
        stages: [{ name: "Search", detail: "Searching", state: "running" }],
      },
    });
    expect(result.workflows[0].id).toBe("wf-1");
    expect(result.source).toBe("backend");
  });

  test("rejects malformed backend data", () => {
    expect(() => parseStudioOverview({ ok: true, data: { workflows: [] } })).toThrow(
      "Invalid studio overview response",
    );
    expect(() =>
      parseStudioOverview({
        ok: true,
        data: { workflows: [{}], executions: [{}], stages: [{}] },
      }),
    ).toThrow("Invalid studio overview response");
    expect(() =>
      parseStudioOverview({
        ok: true,
        data: {
          workflows: [
            {
              id: "wf",
              name: "Bad",
              description: "Bad",
              category: "Test",
              status: "unknown",
              runs: -1,
              success: 101,
              updated: "now",
              nodes: [],
            },
          ],
          executions: [
            {
              id: "run",
              workflow: "Bad",
              status: "running",
              started: "now",
              duration: "0",
              durationMs: -1,
              cost: Number.NaN,
            },
          ],
          stages: [{ name: "Bad", detail: "Bad", state: "unknown" }],
        },
      }),
    ).toThrow("Invalid studio overview response");
  });

  test("falls back on a non-success response and normalizes the URL", async () => {
    const originalFetch = globalThis.fetch;
    const originalBaseURL = process.env.FRONTEND_API_BASE_URL;
    let requestedURL = "";
    process.env.FRONTEND_API_BASE_URL = "https://api.example.test/";
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestedURL = String(input);
      return new Response("unavailable", { status: 503 });
    }) as typeof fetch;
    try {
      const result = await getStudioOverview();
      expect(requestedURL).toBe("https://api.example.test/api/studio/overview");
      expect(result.source).toBe("empty");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalBaseURL === undefined) delete process.env.FRONTEND_API_BASE_URL;
      else process.env.FRONTEND_API_BASE_URL = originalBaseURL;
    }
  });
});
