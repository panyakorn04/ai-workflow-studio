<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-skills -->
# Project skills — use them

This repo ships project skills in `.agents/skills/`. Activate them proactively (no need to ask first) when the work matches:

- **nextjs-code-review** — when reviewing Next.js App Router changes: Server/Client Component boundaries, Server Actions, data fetching, caching, middleware, metadata, API routes. Use before finishing a feature or preparing a PR.
- **nextjs-performance** — when writing or optimizing Next.js code that touches Core Web Vitals (LCP, INP, CLS), `next/image`, `next/font`, caching, Server Components, Suspense streaming, or bundle size.
- **react-doctor** — React security, performance, correctness scanner. Run `npx react-doctor@latest --verbose` to check the health score before committing. Use when the user types `/doctor`.

Load a skill's `references/*.md` files on demand for the specific area you are working on rather than reading everything up front.
<!-- END:nextjs-skills -->
