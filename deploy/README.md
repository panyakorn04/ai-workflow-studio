# Production deployment

GitHub Actions validates the Bun application, publishes `ghcr.io/panyakorn04/ai-workflow-studio:<commit-sha>`, and deploys only immutable tags. The remote script updates only `STUDIO_IMAGE` in `/opt/apps/.env`, retains all runtime environment and Compose files, checks `https://studio.panyakorn.com`, and automatically restores the prior image after any failed deploy/health gate.

Manual rollback: run **CI/CD → Run workflow**, select `rollback`, and provide a previously published full 40-character commit SHA. GitHub serializes deployments within this repository, while the VPS-wide `flock` serializes Backend and Studio deployments across repositories.

Required `production` environment secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. Pin `VPS_KNOWN_HOSTS` as complete known_hosts line(s). The workflow uses its short-lived repository-scoped `GITHUB_TOKEN` with `packages: read`; no app/runtime secret is committed or synchronized.
