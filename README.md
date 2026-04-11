# @khal-os/app-kit

`app-kit` is the TypeScript monorepo that every KhalOS app, pack, and runtime depends on. It ships the four framework packages — **`@khal-os/sdk`**, **`@khal-os/ui`**, **`@khal-os/types`**, and **`@khal-os/dev-cli`** — that define the contract between the desktop shell, the runtime kernel, and the hundred-odd `pack-*` apps that live alongside it in the workspace. Changes here ripple through the entire ecosystem, so this repo is intentionally small, typed strictly, and released via changesets.

This repo is **public** (Elastic-2.0), but it is not meant to be cloned on its own — it lives as a sibling inside the `khal-os` workspace at `repos/app-kit/` and is consumed by `../core`, `../desktop`, every `../pack-*`, and `../platform`. If you need the whole picture, read the workspace manifest at [`../../.genie/MANIFEST.md`](../../.genie/MANIFEST.md) and the agent-facing context at [`CLAUDE.md`](CLAUDE.md).

## What lives here

```
app-kit/
├── packages/
│   ├── os-sdk/      → @khal-os/sdk      (React hooks, NATS client, app registry, runtime supervisor)
│   ├── os-ui/       → @khal-os/ui       (28 components, 11 primitives, OKLCH design tokens)
│   ├── types/       → @khal-os/types    (Zod-validated KhalAppManifest, service + window specs)
│   └── dev-cli/     → @khal-os/dev-cli  (the `khal-dev` CLI — app scaffolding + QA tools)
├── turbo.json       → build orchestration across packages
├── biome.json       → lint + format config
└── pnpm-workspace.yaml
```

## Quickstart

```bash
pnpm install                  # install workspace deps
pnpm build                    # turbo run build  — build every package
pnpm typecheck                # turbo run typecheck
pnpm lint                     # turbo run lint
pnpm lint:fix                 # biome check --write .
```

Packages publish from CI: push to `dev` → `@next` tag, merge to `main` → `@latest`. Pack repos pull these as `@khal-os/sdk`, `@khal-os/ui`, `@khal-os/types` from GitHub Packages.

## Agent context & cross-links

- [`CLAUDE.md`](CLAUDE.md) — agent-facing context for anyone (human or AI) working inside this repo.
- [`../../.genie/MANIFEST.md`](../../.genie/MANIFEST.md) — workspace manifest: where every sibling repo fits.
- `../core/` — the Next.js runtime kernel that hosts apps built against `@khal-os/sdk`.
- `../desktop/` — the Tauri shell that wraps `../core` for macOS/Windows/Linux.
- `../pack-template/` + `../pack-*` — the apps that are this SDK's reason for existing.
