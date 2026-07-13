# AI Workflow Studio

A production-oriented control plane for agentic workflows. This repository is the standalone frontend for creating workflows, monitoring live Agent Loops, reviewing approval gates, and inspecting execution cost and reliability.

## Portfolio architecture

- `ai-workflow-studio` — workflow UI and operations console
- `portfolio-backend-2026` — API, auth, persistence, queues, SSE
- `custom-ai-skills` — reusable agent tools and skill definitions
- n8n/workers — long-running integrations and media jobs

## Current features

**Dashboard & access control**
- Responsive operations dashboard with metrics, workflow inventory, and execution timeline
- Admin sign-in gate — full-page authentication required before accessing the dashboard
- Session-backed admin access with login/logout via BFF proxy to `portfolio-backend-2026`

**Real-time execution monitoring**
- Live SSE stream of execution stages with SHA256 snapshot diffing
- Bounded exponential backoff reconnect with fallback state
- Execution timeline with stage-level progress (Search → Analyze → Generate → Approval → Publish)

**Workflow CRUD**
- Server-side integration with `portfolio-backend-2026` via `GET /api/studio/overview`
- Authenticated workflow creation, editing, and execution via admin BFF
- **Visual node editor** — drag-and-drop canvas with React Flow, inline rename, node palette
- Execution controls: pause, retry, cancel, approve with RBAC (admin/editor)
- Searchable workflow inventory, status filters, and cost/success/latency signals
- Validated API envelope with safe local fallback when backend is unavailable

**Developer experience**
- Biome for linting + formatting (migrated from ESLint)
- `.githooks/` — pre-commit auto-bumps version, pre-push runs lint + build
- Agent skills installed: react-doctor, nextjs-code-review, nextjs-performance
- Version number displayed in footer (auto-incremented via git hook)

## Local development

```bash
bun install
bun run dev
```

Open http://localhost:3000.

Set `FRONTEND_API_BASE_URL` to the server-side backend origin. Do not set a browser-facing API origin for SSE; same-origin proxying avoids CORS coupling.

## Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start Next.js dev server |
| `bun run build` | Production build (standalone output) |
| `bun run lint` | Biome check (format + lint) |
| `bun run format` | Biome auto-fix (format + organize imports) |
| `bun test` | Run unit tests |
| `bun run verify` | Full gate: test → lint → build |
| `bun run doctor` | React Doctor health scan |
| `bun run hooks:install` | Configure git hooks path to `.githooks/` |

## Git hooks

- **pre-commit** — auto-bumps PATCH version in `package.json` and stages it
- **pre-push** — runs `bun run lint && bun run build` before pushing (set `SKIP_VERIFY=1` to skip)

Version starts at `0.1.0` and increments with every commit. The current version is shown in the footer as `vX.Y.Z`.

## Quality gates

```bash
bun test          # 24 tests, 0 fail
bun run lint      # 37 files, 0 errors
bun run build     # TypeScript + Next.js production build
bun run verify    # All three together
```

## Deploy

```bash
# Production URL
https://studio.panyakorn.com

# Backend API
https://api.panyakorn.com
```

## Agent skills

```bash
npx react-doctor@latest --verbose   # React health scan (score ~55/100)
```

Installed skills in `.agents/skills/`:
- `react-doctor` — React security, performance, correctness scanner
- `nextjs-code-review` — Next.js App Router code review checklist
- `nextjs-performance` — Core Web Vitals, streaming, image/font optimization