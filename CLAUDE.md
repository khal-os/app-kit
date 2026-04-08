# KhalOS App-Kit — Ecosystem Guide

> This document is the single source of truth for any agent or developer working in the
> khal-os/app-kit repository. Every path, package name, and export listed here is verified
> against the actual source code. When in doubt, grep — don't guess.

---

## Architecture Overview

KhalOS is a browser-based operating system. The codebase is split across four repo families:

| Repo | Role | Key packages |
|------|------|-------------|
| **app-kit** (this repo) | SDK, UI kit, types, CLI, desktop shell | `@khal-os/sdk`, `@khal-os/ui`, `@khal-os/types`, `@khal-os/dev-cli` |
| **dynamic-app-loader** | Core platform runtime — Next.js server, marketplace, Temporal workflows, NATS handlers | `@khal-os/os-cli`, `@khal-os/server-sdk` |
| **desktop** | Tauri desktop client | `desktop-shell` |
| **pack-*** | Individual apps (each in its own repo) | `@khal-os/pack-settings`, `@khal-os/pack-terminal`, etc. |

### Monorepo layout (app-kit)

```
app-kit/
├── packages/
│   ├── os-sdk/          → @khal-os/sdk       (v1.0.17)
│   ├── os-ui/           → @khal-os/ui        (v1.0.17)
│   ├── types/           → @khal-os/types     (v1.0.17)
│   ├── dev-cli/         → @khal-os/dev-cli   (v1.0.0)
│   └── desktop-shell/   → desktop UI shell
├── pack-template/       → canonical app scaffold
├── turbo.json           → build orchestration
└── biome.json           → linter/formatter config
```

---

## Package Map

### `@khal-os/sdk` (v1.0.17)

The app-facing SDK. Six entry points:

| Entry point | Source | Key exports |
|------------|--------|-------------|
| `.` | `src/index.ts` | Re-exports everything from `./app` |
| `./app` | `src/app/index.ts` | `useKhalAuth`, `useNats`, `useNatsSubscription`, `useService`, `getNatsClient`, `defineManifest`, `validateManifest`, `normalizeRole`, `hasMinRole`, `APP_MANIFEST`, `SUBJECTS`, `createSandbox`, `deleteSandbox`, `useSandboxStatus`, `SubjectBuilder` |
| `./app/roles` | `src/app/roles.ts` | `normalizeRole`, `hasMinRole`, `computeRolePermissions`, `registerRolePermissions`, `getRolePermissions`, `ROLE_HIERARCHY` |
| `./app/registry` | `src/app/app-registry.ts` | `APP_MANIFEST`, `registerManifestEntry`, `getManifestEntry`, `getVoiceAgentSlug`, `getVoiceLabel`, `SUBJECT_PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `refreshRolePermissions` |
| `./app/subjects` | `src/app/subjects.ts` | `SUBJECTS` — NATS subject builders for all services |
| `./runtime` | `src/runtime/index.ts` | `TauriSupervisor` — headless service runtime for exported apps |

**Source structure:**
```
packages/os-sdk/src/
├── index.ts
├── app/
│   ├── index.ts            (barrel — main app exports)
│   ├── auth.ts             (useKhalAuth hook)
│   ├── auth-context.ts     (KhalAuthContext provider)
│   ├── hooks.ts            (useNats, useNatsSubscription, useService)
│   ├── nats-client.ts      (getNatsClient singleton)
│   ├── manifest.ts         (defineManifest, type re-exports)
│   ├── validate-manifest.ts
│   ├── app-registry.ts     (APP_MANIFEST, manifest entries)
│   ├── roles.ts            (RBAC: roles, permissions)
│   ├── subjects.ts         (SUBJECTS constant)
│   ├── subject-builder.ts  (SubjectBuilder class)
│   ├── sandbox.ts          (sandbox management)
│   └── parse-env-example.ts
└── runtime/
    ├── index.ts
    └── tauri-supervisor.ts  (headless service supervisor)
```

### `@khal-os/ui` (v1.0.17)

The component library and design system. Two exports:

| Export | What |
|--------|------|
| `.` | All components, hooks, stores, animations, utilities |
| `./tokens.css` | OKLCH design tokens (reference only — host provides at runtime) |

**Components (28):**

| Component | File |
|-----------|------|
| `Avatar` | `src/components/avatar.tsx` |
| `Badge` | `src/components/badge.tsx` |
| `Button` | `src/components/button.tsx` |
| `ContextMenu` | `src/components/ContextMenu.tsx` |
| `Command` | `src/components/command.tsx` |
| `CostCounter` | `src/components/cost-counter.tsx` |
| `DataRow` | `src/components/data-row.tsx` |
| `DropdownMenu` | `src/components/dropdown-menu.tsx` |
| `GlassCard` | `src/components/glass-card.tsx` |
| `Input` | `src/components/input.tsx` |
| `KhalLogo` | `src/components/khal-logo.tsx` |
| `LiveFeed` | `src/components/live-feed.tsx` |
| `MeshGradient` | `src/components/mesh-gradient.tsx` |
| `MetricDisplay` | `src/components/metric-display.tsx` |
| `Note` | `src/components/note.tsx` |
| `NumberFlow` | `src/components/number-flow.tsx` |
| `PillBadge` | `src/components/pill-badge.tsx` |
| `ProgressBar` | `src/components/progress-bar.tsx` |
| `SectionCard` | `src/components/section-card.tsx` |
| `Separator` | `src/components/separator.tsx` |
| `Spinner` | `src/components/spinner.tsx` |
| `StatusDot` | `src/components/status-dot.tsx` |
| `Switch` | `src/components/switch.tsx` |
| `ThemeProvider` | `src/components/theme-provider.tsx` |
| `ThemeSwitcher` | `src/components/theme-switcher.tsx` |
| `TickerBar` | `src/components/ticker-bar.tsx` |
| `Tooltip` | `src/components/tooltip.tsx` |
| `WindowMinimizedContext` | `src/components/window-minimized-context.tsx` |

**Primitives (11):**

| Primitive | File |
|-----------|------|
| `CollapsibleSidebar` | `src/primitives/collapsible-sidebar.tsx` |
| `Dialog` | `src/primitives/dialog.tsx` |
| `EmptyState` | `src/primitives/empty-state.tsx` |
| `ListView` | `src/primitives/list-view.tsx` |
| `PropertyPanel` | `src/primitives/property-panel.tsx` |
| `SectionHeader` | `src/primitives/section-header.tsx` |
| `SidebarNav` | `src/primitives/sidebar-nav.tsx` |
| `SplitPane` | `src/primitives/split-pane.tsx` |
| `StatusBadge` | `src/primitives/status-badge.tsx` |
| `StatusBar` | `src/primitives/status-bar.tsx` |
| `Toolbar` | `src/primitives/toolbar.tsx` |

**Additional exports:**
- Hooks: `useReducedMotion`
- Animations: `fadeIn`, `fadeUp`, `khalEasing`, `scaleUp`, `springConfig`, `staggerChild`, `staggerContainer`
- Stores: `useNotificationStore`, `useThemeStore`
- Auth (re-exported from SDK): `useKhalAuth`, `useOSAuth`, `useNats`, `useNatsSubscription`, `SUBJECTS`
- Utilities: `cn` (classname merge)
- Type: `AppComponentProps` (`{ windowId: string; meta?: Record<string, unknown> }`)

### `@khal-os/types` (v1.0.17)

Shared TypeScript types and Zod schemas.

**Types:**
- `AppManifest`, `AppManifestView`, `AppDesktopConfig`, `AppServiceConfig`
- `AppEnvVar`, `AppDeployConfig`, `AppTauriConfig`
- `ServiceHealthConfig`, `SandboxConfig`, `SandboxResourceSpec`, `SandboxMount`
- `KhalAuth`, `ConnectionState`, `Role`
- `KhalPermission`, `KhalServiceSpec`, `KhalWindowSpec`, `KhalAppEntry`, `KhalAppManifest`

**Zod schemas:**
- `KhalPermission` — enum: `nats:publish`, `nats:subscribe`, `files:read`, `files:write`, `pty:spawn`, `http:fetch`, `system:clipboard`, `system:notifications`
- `KhalServiceSpec` — service declaration (name, command, entry, runtime, ports, health)
- `KhalWindowSpec` — window config (id, title, width, height, resizable)
- `KhalAppManifestSchema` — full manifest validation (strict mode)
- `KhalAppEntrySchema` — bundle pack app entry

**Constants:**
- `ROLE_HIERARCHY`: `['member', 'platform-dev', 'platform-admin', 'platform-owner']`
- `validateManifest(raw)` — validates against `KhalAppManifestSchema`, throws `ZodError` on failure

### `@khal-os/dev-cli` (v1.0.0)

Developer CLI for scaffolding and QA.

**Binary:** `khal-dev`

**Commands:**
- `khal-dev app create [name]` — scaffold a new app (interactive prompts)
- `khal-dev qa look` — screenshot capture
- `khal-dev qa health` — health check
- `khal-dev qa console` — console/logging
- `khal-dev qa bug` — bug report
- `khal-dev qa login` — login testing
- `khal-dev qa session` — session management
- `khal-dev qa assert` — assertions

**Templates location:** `packages/dev-cli/templates/app/`

---

## Design System — OKLCH Tokens

KhalOS uses the OKLCH color space for perceptual uniformity. Scales run 100 (lightest) to 1000 (darkest) in light mode, inverted in dark mode. All tokens use the `--ds-` prefix.

### Color Scales

| Scale | CSS variable pattern | Example (500) |
|-------|---------------------|---------------|
| Gray | `--ds-gray-{100..1000}` | `oklch(0.836 0 0)` |
| Gray Alpha | `--ds-gray-alpha-{100..1000}` | `oklch(0 0 0 / 0.21)` |
| Blue | `--ds-blue-{100..1000}` | `oklch(82.75% 0.0979 248.48)` |
| Red | `--ds-red-{100..1000}` | `oklch(84.47% 0.1018 17.71)` |
| Amber | `--ds-amber-{100..1000}` | `oklch(86.55% 0.1583 79.63)` |
| Green | `--ds-green-{100..1000}` | `oklch(85.45% 0.1627 146.3)` |
| Teal | `--ds-teal-{100..1000}` | teal hues |
| Purple | `--ds-purple-{100..1000}` | purple hues |
| Pink | `--ds-pink-{100..1000}` | pink hues |

### Brand & Product Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-accent-warm` | `oklch(0.74 0.11 65)` | Primary accent color |
| `--ds-accent-warm-subtle` | `oklch(0.74 0.11 65 / 0.12)` | Accent at low opacity |
| `--ds-product-os` | `oklch(0.72 0.15 250)` | KhalOS brand — blue |
| `--ds-product-khal` | `oklch(0.75 0.15 55)` | Khal brand — warm gold |
| `--ds-product-genie` | `oklch(0.73 0.13 295)` | Genie brand — purple |
| `--ds-product-omni` | `oklch(0.8 0.12 175)` | Omni brand — teal |

### Other Tokens

- **Backgrounds:** `--ds-background-100` (white), `--ds-background-200` (near-white)
- **Shadows:** `--ds-shadow-{2xs,xs,small,medium,large,xl,2xl,tooltip,menu,modal,fullscreen}`
- **Focus:** `--ds-focus-ring` (uses blue-700)
- **Motion:** `--ds-motion-swift: cubic-bezier(0.175, 0.885, 0.32, 1.1)`

### Usage in Components

```tsx
// Via Tailwind utilities (preferred):
<div className="bg-background-100 text-gray-1000 shadow-medium" />

// Via CSS custom properties:
style={{ color: 'var(--ds-gray-500)' }}
```

Dark mode is automatic via the `.dark` class — all token values are re-mapped.

---

## How to Create an App

### Step 1: Scaffold

```bash
cd /path/to/app-kit
khal-dev app create my-app
```

Interactive prompts:
1. **Name** — kebab-case, e.g., `my-app` (can pass as argument)
2. **Description** — short text (defaults to "A KhalOS app")
3. **Include backend service with NATS?** — yes/no
4. **Include desktop icon?** — yes/no

Creates `packages/my-app-app/` with all files scaffolded.

### Step 2: Understand the generated structure

**Without service (UI-only):**
```
packages/my-app-app/
├── package.json
├── manifest.ts            (app metadata + views)
├── components.ts          (React.lazy wiring)
└── views/
    └── my-app/
        └── ui/
            └── App.tsx    (React component)
```

**With service (full-stack):**
```
packages/my-app-app/
├── package.json
├── manifest.ts
├── components.ts
└── views/
    └── my-app/
        ├── schema.ts          (TypeBox schemas for request/response)
        ├── subjects.ts        (NATS subject constants)
        ├── ui/
        │   └── App.tsx        (React component with NATS hooks)
        └── service/
            └── index.ts       (NATS service handler)
```

### Step 3: Write the manifest

The generated `manifest.ts` defines your app's views, permissions, and desktop integration:

```typescript
export default {
  id: 'my-app-app',
  views: [
    {
      id: 'my-app',
      label: 'My App',
      permission: 'my-app',
      minRole: 'member' as const,
      natsPrefix: 'my-app',            // only if service included
      defaultSize: { width: 800, height: 600 },
      component: './views/my-app/ui/App',
    },
  ],
  desktop: {
    icon: '/icons/dusk/app.svg',
    categories: ['Utilities'],
    comment: 'A KhalOS app',
  },
};
```

### Step 4: Build the UI

Every view component receives `AppComponentProps`:

```typescript
import type { AppComponentProps } from '@khal-os/ui';

export default function MyAppApp({ windowId, meta }: AppComponentProps) {
  return <div>Hello from My App</div>;
}
```

Use SDK hooks for NATS communication:

```typescript
import { useNats } from '@khal-os/sdk/app';

function MyAppApp({ windowId }: AppComponentProps) {
  const { request } = useNats();

  async function ping() {
    const reply = await request('khal.{orgId}.my-app.ping', { message: 'hello' });
    console.log(reply);
  }

  return <button onClick={ping}>Ping</button>;
}
```

### Step 5: Write the service (if included)

Services use `@khal-os/server-sdk/service` for NATS handling:

```typescript
// views/my-app/service/index.ts
import { connect } from 'nats';

const nc = await connect({ servers: process.env.KHAL_NATS_URL });

// Subscribe to request/reply
const sub = nc.subscribe('khal.*.my-app.ping');
for await (const msg of sub) {
  const data = JSON.parse(new TextDecoder().decode(msg.data));
  msg.respond(JSON.stringify({ pong: data.message }));
}
```

### Step 6: Create khal-app.json for standalone pack repos

When publishing as a standalone `pack-*` repo, create `khal-app.json` at the repo root:

```json
{
  "$schema": "https://raw.githubusercontent.com/khal-os/app-kit/dev/packages/types/src/khal-app-schema.json",
  "id": "my-app",
  "name": "My App",
  "version": "1.0.0",
  "description": "What the app does",
  "author": "Your Name",
  "permissions": ["nats:subscribe", "nats:publish"],
  "frontend": {
    "package": "@khal-os/pack-my-app"
  }
}
```

### Step 7: Build & publish

```bash
# Build the package
cd packages/my-app-app && pnpm build

# For pack repos: CI handles npm publish
# dev branch → @next tag, main branch → @latest tag
```

---

## NATS Patterns

### Subject Naming Convention

All subjects follow hierarchical dot-notation:

| Pattern | Scope | Examples |
|---------|-------|---------|
| `khal.{orgId}.{service}.{action}` | Org-scoped services | `khal.abc123.files.read`, `khal.abc123.pty.create` |
| `khal.{orgId}.{service}.{id}.{action}` | Entity-scoped | `khal.abc123.pty.sess1.data` |
| `os.{domain}.{action}` | Global / cross-org | `os.sandbox.create`, `os.auth.role-changed` |

### Core Subject Groups

**PTY (Terminal):**
- `khal.{orgId}.pty.create` / `.destroy` / `.list`
- `khal.{orgId}.pty.{sessionId}.{data|input|resize|exit|replay|buffer|buffer-end}`

**File System:**
- `khal.{orgId}.fs.{list|read|write|search}`
- `khal.{orgId}.fs.watch.{pathHash}`

**Desktop Window Management:**
- `khal.{orgId}.desktop.{userId}.cmd.{open|close|focus|minimize|maximize|restore|notify|sync}`
- `khal.{orgId}.desktop.{userId}.event.{opened|closed|focused|minimized|maximized|restored|state|metaUpdated|moved|resized}`

**Sandbox (per-user containers):**
- `os.sandbox.{create|delete|status}` (global)
- `os.sandbox.{userId}.events` (lifecycle stream)
- `khal.{orgId}.sandbox.{userId}.pty.{create|destroy|list|data|input|resize|exit}`

**Auth:**
- `os.auth.role-changed`
- `os.auth.membership-revoked`

**Notifications:**
- `khal.{orgId}.notify.broadcast`
- `khal.{orgId}.notify.user.{userId}`

**Marketplace:**
- `os.marketplace.{install|uninstall|update}` — Temporal workflow triggers
- `os.marketplace.installed` — list installed apps
- `os.marketplace.install.status` — installation progress pub
- `os.apps.registry` / `os.apps.registry.changed` / `os.apps.list`

### Request/Reply Pattern

```typescript
import { useNats } from '@khal-os/sdk/app';

const { request } = useNats();

// Client sends request, waits for reply with timeout
const reply = await request('khal.{orgId}.files.read', { path: '/home/user/file.txt' }, 5000);
```

### JetStream Streams

| Stream | Subject filter | Retention | Purpose |
|--------|---------------|-----------|---------|
| `OS_KHAL_EVENTS` | `events.>` | 7 days | Domain events (app installs, auth changes) |
| `OS_O11Y_EVENTS` | `os.o11y.events.>` | 24 hours | Observability events |
| `OS_O11Y_LOGS` | `os.o11y.logs.>` | 24 hours | Observability logs |

---

## App Manifest Reference (`khal-app.json`)

The `khal-app.json` file is the install-time contract read by the marketplace. It lives at the root of every `pack-*` repo.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique app ID, kebab-case |
| `name` | string | Human-readable name |
| `version` | string | Semver version |
| `description` | string | Short description for marketplace |
| `author` | string | Author name |
| `permissions` | `KhalPermission[]` | Required capabilities |

**Valid permissions:** `nats:publish`, `nats:subscribe`, `files:read`, `files:write`, `pty:spawn`, `http:fetch`, `system:clipboard`, `system:notifications`

### Frontend (required — pick one)

**Single-app pack:**
```json
"frontend": { "package": "@khal-os/pack-my-app" }
```

**Bundle pack (multiple apps):**
```json
"apps": [
  { "id": "app-a", "name": "App A", "frontend": { "package": "@khal-os/pack-app-a" } },
  { "id": "app-b", "name": "App B", "frontend": { "package": "@khal-os/pack-app-b" } }
]
```

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | JSON schema URL for validation |
| `icon` | string | Path to icon (relative to repo root) |
| `backend` | object | Backend service config (image, helmChart, env, ports) |
| `services` | `KhalServiceSpec[]` | Service declarations (name, command, runtime, ports, health) |
| `windows` | `KhalWindowSpec[]` | Window specifications |
| `sandbox` | `SandboxConfig` | Per-user container provisioning |
| `deploy` | `AppDeployConfig` | Kubernetes deployment config |
| `tauri` | `AppTauriConfig` | Standalone desktop export config |
| `env` | `AppEnvVar[]` | Environment variable declarations |
| `bundleUrl` | string | Pre-built ESM bundle URL |

### Validation

```typescript
import { validateManifest } from '@khal-os/types';

const manifest = JSON.parse(fs.readFileSync('khal-app.json', 'utf-8'));
validateManifest(manifest); // throws ZodError on invalid
```

---

## Example Apps

### pack-settings (simplest real app — UI-only)

**Repo:** `khal-os/pack-settings`

```json
{
  "$schema": "https://raw.githubusercontent.com/khal-os/app-kit/dev/packages/types/src/khal-app-schema.json",
  "id": "settings",
  "name": "Settings",
  "version": "1.0.0",
  "description": "Desktop settings — manage appearance, services, SSH keys, keyboard shortcuts, and system configuration.",
  "author": "Namastex",
  "permissions": ["nats:subscribe", "nats:publish", "system:clipboard"],
  "frontend": {
    "package": "@khal-os/pack-settings"
  }
}
```

No backend. Pure React UI using SDK hooks for NATS communication. Good starting point for understanding the pattern.

### pack-terminal (app with backend + sandbox)

**Repo:** `khal-os/pack-terminal`

```json
{
  "$schema": "https://raw.githubusercontent.com/khal-os/app-kit/dev/packages/types/src/khal-app-schema.json",
  "id": "terminal",
  "name": "Terminal",
  "version": "1.0.0",
  "icon": "./package/src/assets/icon.svg",
  "description": "PTY terminal emulator for KhalOS with NATS-bridged stdin/stdout",
  "author": "KhalOS Core Team",
  "permissions": ["pty:spawn", "nats:publish", "nats:subscribe"],
  "frontend": {
    "package": "@khal-os/pack-terminal"
  },
  "backend": {
    "image": "ghcr.io/khal-os/pack-terminal-service",
    "helmChart": "oci://ghcr.io/khal-os/charts/pack-terminal",
    "env": {
      "KHAL_PTY_SHELL": "/bin/bash",
      "KHAL_NATS_URL": "nats://nats.khal-system.svc:4222"
    },
    "ports": [8002]
  }
}
```

Has a backend service for PTY management. The service connects to NATS and handles `khal.{orgId}.pty.*` subjects. Demonstrates the full-stack pattern with Docker image, Helm chart, and backend config.

### Other pack repos

| Repo | Description |
|------|-------------|
| `khal-os/pack-files` | File browser — read/write/watch handlers via NATS |
| `khal-os/pack-genie` | Genie agent UI — spawning and managing agents |
| `khal-os/pack-hello` | Bundle pack example — multiple apps in one repo |
| `khal-os/pack-nats-viewer` | NATS topic visualizer and publisher |

---

## Pack Repository Structure

Every `pack-*` repo follows this layout:

```
pack-<name>/
├── khal-app.json               (manifest — validated by CI)
├── package.json                (workspace root, private)
├── pnpm-workspace.yaml         (packages: ['package', 'service'])
├── tsconfig.base.json
├── biome.json
├── .env.example
├── package/                    (frontend — published to npm)
│   ├── package.json            (@khal-os/pack-<name>)
│   ├── tsup.config.ts          (ESM + CJS + DTS)
│   └── src/
│       ├── index.ts            (barrel: components + manifest)
│       ├── components.ts       (React.lazy view map)
│       ├── manifest.ts         (typed AppManifest)
│       └── views/
│           └── <view-name>/
│               └── <View>.tsx
├── service/                    (backend — optional, not published)
│   ├── package.json            (@khal-os/pack-<name>-service, private)
│   ├── Dockerfile
│   └── src/
│       └── index.ts            (Bun HTTP + NATS subscriptions)
└── helm/                       (Helm chart — optional, if service exists)
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

**Dependency strategy:**
- `react`, `@khal-os/sdk`, `@khal-os/ui` → **peerDependencies** (host provides at runtime)
- App-specific deps (lucide-react, @xterm/xterm, etc.) → **dependencies** (bundled)
- `typescript`, `tsup`, `@types/*` → **devDependencies**

**Build:** `tsup` with ESM + CJS + DTS, externalizing `react`, `react-dom`, and all `@khal-os/*` packages.

---

## Registered Apps (APP_MANIFEST)

The SDK's `APP_MANIFEST` in `packages/os-sdk/src/app/app-registry.ts` contains static entries for core apps:

| App ID | Label | Permission |
|--------|-------|-----------|
| `terminal` | Terminal | `terminal` |
| `settings` | Settings | `settings` |
| `files` | Files | `files.read` |
| `nats-viewer` | NATS Viewer | `nats-viewer` |
| `mission-control` | Mission Control | `mission-control` |
| `genie` | Genie | `genie` |
| `ideas` | Ideas | `ideas` |
| `marketplace` | Marketplace | `marketplace` |

Apps not in this list are loaded dynamically via `registerManifestEntry()` at runtime.

---

## Common Pitfalls

### Wrong paths
- Packages are under `packages/`, not `repos/` — the `repos/` symlink in worktrees may be broken
- Template files are in `packages/dev-cli/templates/app/`, not in `pack-template/`
- os-ui tokens file is `packages/os-ui/tokens.css`

### Wrong imports
- Use `@khal-os/sdk/app` for app hooks, not `@khal-os/sdk` directly (same exports, but explicit)
- Use `@khal-os/sdk/app/subjects` to import `SUBJECTS` directly
- `useOSAuth` is an alias for `useKhalAuth` — both work, prefer `useKhalAuth`
- `AppComponentProps` comes from `@khal-os/ui`, not from `@khal-os/sdk`

### Manifest confusion
- `manifest.ts` (TypeScript, in `package/src/`) is for the SDK's runtime type system
- `khal-app.json` (JSON, at repo root) is for the marketplace install-time contract
- Both describe the same app but serve different purposes — keep them in sync

### NATS subjects
- Always scope with `orgId`: `khal.{orgId}.service.action` — never omit the org
- Global subjects (`os.*`) do NOT include orgId
- Subject builders in `SUBJECTS` are functions — call them: `SUBJECTS.pty.create(orgId)`, not `SUBJECTS.pty.create`

### Build issues
- All `@khal-os/*` packages must be externalized in tsup — they're provided by the host at runtime via `window.__KHAL_SHARED__`
- `react` and `react-dom` are always externals — never bundle them
- peerDependencies must be `^1.0.0` for `@khal-os/sdk` and `@khal-os/ui`

### Role system
- Four roles in order: `member` < `platform-dev` < `platform-admin` < `platform-owner`
- Use `hasMinRole(userRole, 'platform-dev')` to check — don't compare strings manually
- Legacy aliases exist: `admin` → `platform-admin`, `developer` → `platform-dev`, `viewer` → `member`
