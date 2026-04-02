# Deployment Handoff — Three-Repo Architecture

> Generated: 2026-04-02 | Architecture: khal-os org (core + app-kit + desktop)

## Repositories

| Repo | Visibility | License | Purpose |
|------|-----------|---------|---------|
| [khal-os/core](https://github.com/khal-os/core) | Private | Proprietary | Backend — Next.js, NATS services, WS bridge, server-sdk |
| [khal-os/app-kit](https://github.com/khal-os/app-kit) | Public | ELv2 | Published SDK/UI/types + private core app UIs |
| [khal-os/desktop](https://github.com/khal-os/desktop) | Private | Proprietary | Tauri + Vite SPA desktop client |

## npm Packages

| Package | Version | Access | Description |
|---------|---------|--------|-------------|
| `@khal-os/sdk` | 1.0.1 | Public | App framework — hooks, NatsClient, manifest, roles |
| `@khal-os/ui` | 1.0.1 | Public | Component library — design tokens, primitives |

Published to npmjs.com under the `khal-os` org scope. ELv2 licensed.

## Teams & Access Control

| Team | core | app-kit | desktop |
|------|------|---------|---------|
| **backend** | write | read | — |
| **frontend** | — | write | write |
| **platform** | admin | admin | admin |

## Branch Strategy

All repos use `main` (production) + `dev` (development). PRs target `dev`, then `dev` merges to `main` for release.

Branch protection on `main`:
- 1 PR review required, stale reviews dismissed
- Required status check: `Quality Gate`
- No force push, no branch deletion
- Conversation resolution required
- Merge commits + rebase only (squash disabled)

## Core — Deployment Pipeline

### Local Development

```bash
cd core
pnpm install
pm2 start ecosystem.config.cjs    # NATS + services + WS bridge + Next.js
# → http://localhost:8888/desktop
```

### Dev (k3s on Proxmox LXC — alpha.khal.namastex.io)

```bash
make dev
```

Pulls latest from `main`, installs deps, builds Next.js, builds Docker image (Dockerfile.prod — COPY only, no compile), imports into k3s, helm upgrades `khal-os` in `khal-dev` namespace.

### QA (OKE — qa.khal.namastex.io)

```bash
make build VERSION=1.YYMMDD.N     # Build + push to OCIR
make qa VERSION=1.YYMMDD.N        # Helm upgrade in khal-qa namespace
```

### Production (OKE — per-customer namespaces)

```bash
make prod                          # All customers
make prod-one CUSTOMER=pags        # Single customer
```

Full pipeline: pull → build → Docker → push to OCIR → helm upgrade fleet (all `khal-*` namespaces with `khal.ai/type=customer` label).

### Operations

```bash
make health                        # Health check all environments
make status                        # Cluster overview
make logs CUSTOMER=pags            # Tail customer logs
make backup CUSTOMER=pags          # Backup customer DB
make rollback CUSTOMER=pags VERSION=v1.2.3
```

### Customer Onboarding

```bash
make onboard CUSTOMER=acme DOMAIN=acme.khal.ai
make db-cloud-create CUSTOMER=acme
make prod-one CUSTOMER=acme VERSION=$(cat package.json | python3 -c "import json,sys;print(json.load(sys.stdin)['version'])")
```

### Container Architecture

```
Docker image (khal-os:VERSION)
├── Next.js (port 8888)
├── WS bridge (port 4280)
├── Service loader (discovers + spawns services)
├── NATS sidecar (Helm-managed, port 4222)
└── Migrations (run on startup via docker-entrypoint.sh)
```

Key paths inside the container:
- `/app/packages/server-sdk/` — internal server code (runtime, db, service, api)
- `/app/node_modules/@khal-os/sdk/` — published SDK (from npm)
- `/app/node_modules/@khal-os/ui/` — published UI (from npm)
- `/app/src/` — Next.js app, service-loader, WS bridge
- `/app/scripts/docker-entrypoint.sh` — startup script

### Database

| Env | Host | DB | Managed by |
|-----|------|----|-----------|
| Dev | `pgserve` (k3s sidecar) | `khal_dev` | Helm chart `helm/pgserve` |
| QA | `khal-pg-rw.khal-db` (CloudNativePG) | `khal_qa` | CloudNativePG operator |
| Prod | `khal-pg-rw.khal-db` (CloudNativePG) | `khal_{customer}` | CloudNativePG operator |

Migrations: `packages/server-sdk/src/db/migrate.ts` (Drizzle ORM). Run automatically on container startup.

## App-Kit — Publishing Pipeline

### Versioning

Semver via [Changesets](https://github.com/changesets/changesets). Calver stays for core.

```bash
cd app-kit
pnpm changeset                     # Create a changeset
# → Commit + push → CI creates "Version Packages" PR
# → Merge version PR → CI publishes to npm
```

### CI

- **Push/PR**: `turbo run build typecheck lint`
- **Release** (main push): Changesets action → version PR or npm publish

### Manual Publish (bootstrap)

```bash
cd app-kit/packages/os-sdk && npm publish --access public
cd app-kit/packages/os-ui && npm publish --access public
```

## Desktop — Build Pipeline

### Development

```bash
cd desktop
pnpm install
make dev                           # Vite hot-reload + Tauri
```

### Build

```bash
make bin                           # .app bundle
make run                           # Build + open
make dmg                           # DMG installer
```

### Architecture

```
Tauri Binary (.app)
├── Static HTML/CSS/JS (Vite build → tauri://localhost)
│   ├── DesktopShell from @khal-os/desktop-shell
│   ├── NatsClient → Tauri Channel IPC → Rust WS relay
│   └── TauriKhalAuthProvider → get_session_info()
├── Rust layer
│   ├── WS relay → wss://remote-server/ws/nats
│   ├── Deep link handler (khalos://)
│   └── Auth token storage (never exposed to JS)
└── No Node.js. No subprocess. No server.
```

### Release

Desktop releases via GitHub Actions → `cargo tauri build` → upload `.app`/`.dmg` to GitHub Releases.

## Secrets & Configuration

### GitHub Secrets (per repo)

| Secret | Repos | Purpose |
|--------|-------|---------|
| `NPM_TOKEN` | core, app-kit, desktop | npm publish + install |
| `GITGUARDIAN_API_KEY` | core | Secrets scanning (needs re-configuration for khal-os org) |

### Environment Variables (core container)

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKOS_CLIENT_ID` | Yes | WorkOS auth |
| `WORKOS_API_KEY` | Yes | WorkOS API |
| `WORKOS_COOKIE_PASSWORD` | Yes | Session encryption |
| `WORKOS_WEBHOOK_SECRET` | Yes | Webhook verification |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NATS_URL` | Yes | NATS server (default: `nats://nats:4222`) |
| `OS_SECRET` | No | Machine auth bypass for headless Chrome |
| `KHAL_INSTANCE_ID` | No | Instance identifier |

### Infrastructure

| Service | Provider | Region |
|---------|----------|--------|
| Container Registry | OCI (gru.ocir.io) | São Paulo |
| Kubernetes | OKE (Oracle) | São Paulo |
| DNS | Cloudflare | — |
| Auth | WorkOS | — |
| Dev LXC | Proxmox (local) | — |

## Migration Notes

### What Changed from Monorepo

1. **Packages extracted**: `os-sdk`, `os-ui`, `types`, `terminal-app`, `files-app`, `genie-app`, `settings-app`, `nats-viewer-app`, `hello-*` → now in app-kit
2. **Server code**: `packages/server-sdk/` created in core (runtime, db, service, api)
3. **Auth**: `useKhalAuth()` is now provider-agnostic via `KhalAuthContext`. Core uses WorkOS provider, desktop uses Tauri provider.
4. **Imports**: All `@khal-os/sdk/runtime`, `@khal-os/sdk/db`, etc. → `@khal-os/server-sdk/*` in core
5. **npm dependencies**: Core consumes `@khal-os/sdk@^1.0.1` and `@khal-os/ui@^1.0.1` from npm
6. **Docker**: `COPY packages/` now copies only `server-sdk`, `npx-cli`, `os-cli`
7. **Tauri targets**: `make bin`/`run`/`dmg` moved from core Makefile to desktop Makefile

### Known Issues

- **GitGuardian**: API key needs re-configuration for `khal-os` org (currently fails in CI, non-blocking)
- **npm token**: Rotate after initial setup — token was used in bootstrap session
- **app-kit CI**: Typecheck is non-blocking until SDK peer deps are fully configured
- **Dependabot**: 1 moderate vulnerability flagged on app-kit — check https://github.com/khal-os/app-kit/security/dependabot/1
