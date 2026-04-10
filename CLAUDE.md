# app-kit — KhalOS SDK / UI kit / types / dev-CLI

> You are working inside **`repos/app-kit/`**, the framework packages that every KhalOS app and every pack repo depends on. Touching code here affects the entire ecosystem — every pack, every app, every runtime.

## What lives here

| Package | Version | Role |
|---|---|---|
| [`@khal-os/sdk`](packages/os-sdk/) | 1.0.17 | App-facing SDK: React hooks (`useNats`, `useKhalAuth`, `useService`), NATS client, roles/permissions, subject builders, app registry, runtime supervisor |
| [`@khal-os/ui`](packages/os-ui/) | 1.0.17 | Component library + design system (28 components, 11 primitives, hooks, stores, animations, OKLCH tokens) |
| [`@khal-os/types`](packages/types/) | 1.0.17 | Shared TypeScript types + Zod schemas (`KhalAppManifest`, `KhalServiceSpec`, `KhalWindowSpec`, `validateManifest`) |
| [`@khal-os/dev-cli`](packages/dev-cli/) | 1.0.0 | `khal-dev` CLI — app scaffolding + QA tools (screenshots, health checks, assertions) |

## Monorepo layout

```
app-kit/
├── packages/
│   ├── os-sdk/              → @khal-os/sdk
│   ├── os-ui/               → @khal-os/ui
│   ├── types/               → @khal-os/types
│   ├── dev-cli/             → @khal-os/dev-cli (binary: khal-dev)
│   └── desktop-shell/       → desktop UI shell
├── turbo.json               → build orchestration
├── biome.json               → linter/formatter config
└── pnpm-workspace.yaml      → workspace declaration
```

## Quick start

```bash
pnpm install                              # install workspace deps
turbo build                               # build all packages
turbo typecheck                           # typecheck all packages
biome check .                             # lint + format

# Scaffold a new app from templates:
khal-dev app create <name>

# Publish (CI-driven; dev → @next tag, main → @latest)
cd packages/os-sdk && pnpm publish --tag next
```

## Where the ecosystem lives

- **Runtime kernel** → `../core/` (Next.js server, NATS, apps registry)
- **Tauri desktop client** → `../desktop/`
- **Deployment orchestrator** → `../deploy/`
- **Platform control plane** → `../platform/` (api.khal.ai)
- **Individual apps** → `../pack-*` (one repo per app — all cloned from `../pack-template`)
- **Workspace manifest** → `../../.genie/MANIFEST.md`
