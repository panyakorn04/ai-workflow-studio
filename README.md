# AI Workflow Studio

A production-oriented control plane for agentic workflows. This repository is the standalone frontend for creating workflows, monitoring live Agent Loops, reviewing approval gates, and inspecting execution cost and reliability.

## Portfolio architecture

- `ai-workflow-studio` — workflow UI and operations console
- `portfolio-backend-2026` — API, auth, persistence, queues, SSE
- `custom-ai-skills` — reusable agent tools and skill definitions
- n8n/workers — long-running integrations and media jobs

## Current MVP

- Responsive operations dashboard
- Server-side integration with `portfolio-backend-2026` via `GET /api/studio/overview`
- Validated API envelope with a safe local fallback when the backend is unavailable
- Searchable workflow inventory and status filters
- Persisted execution-specific timeline with live SSE updates, reconnect, and fallback
- Recent execution inspector
- Authenticated Run controls for active workflows, proxied through the session-backed mutation BFF
- Cost, success, latency, and volume signals
- Typed workflow query/metrics utilities with tests

Public reads retain a local fallback. The browser opens the same-origin
`/api/studio/executions/:id/events` route; that Next.js route streams the backend
SSE response without exposing or coupling the browser to the backend origin.
The selected-run hook validates every snapshot, reconnects with bounded
exponential backoff, closes stale streams on selection/unmount, and keeps the
last safe fallback visible with an accessible connection status. Authenticated
controls never embed credentials: the BFF forwards only the named admin session
cookie to allowlisted backend routes.

## Local development

```bash
bun install
bun run dev
```

Open http://localhost:3000.

## Quality gates

```bash
bun test
bun run lint
bun run build
```

Set `FRONTEND_API_BASE_URL` to the server-side backend origin. Do not set a
browser-facing API origin for SSE; same-origin proxying avoids CORS coupling.
