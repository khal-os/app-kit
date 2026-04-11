# Building apps — scaffold, structure, manifest, examples

## Step 1 — Scaffold

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

## Step 2 — Understand the generated structure

### UI-only (no service)

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

### Full-stack (with service)

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

## Step 3 — Write the manifest

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

## Step 4 — Build the UI

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

## Step 5 — Write the service (if included)

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

## Step 6 — Create `khal-app.json` for standalone pack repos

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

## Step 7 — Build & publish

```bash
# Build the package
cd packages/my-app-app && pnpm build

# For pack repos: CI handles npm publish
# dev branch → @next tag, main branch → @latest tag
```

---

## `khal-app.json` manifest reference

The `khal-app.json` file is the install-time contract read by the marketplace. It lives at the root of every `pack-*` repo.

### Required fields

| Field | Type | Description |
|---|---|---|
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

### Optional fields

| Field | Type | Description |
|---|---|---|
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

## Example apps

### `pack-settings` — simplest real app (UI-only)

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
  "frontend": { "package": "@khal-os/pack-settings" }
}
```

No backend. Pure React UI using SDK hooks for NATS communication. **Good starting point** for understanding the pattern.

### `pack-terminal` — app with backend + sandbox

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
  "frontend": { "package": "@khal-os/pack-terminal" },
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
|---|---|
| `khal-os/pack-files` | File browser — read/write/watch handlers via NATS |
| `khal-os/pack-genie` | Genie agent UI — spawning and managing agents |
| `khal-os/pack-hello` | Bundle pack example — multiple apps in one repo |
| `khal-os/pack-nats-viewer` | NATS topic visualizer and publisher |

---

## Pack repository structure

Every `pack-*` repo follows this layout (cloned from `../pack-template`):

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

### Dependency strategy

- `react`, `@khal-os/sdk`, `@khal-os/ui` → **peerDependencies** (host provides at runtime)
- App-specific deps (`lucide-react`, `@xterm/xterm`, etc.) → **dependencies** (bundled)
- `typescript`, `tsup`, `@types/*` → **devDependencies**

### Build

`tsup` with ESM + CJS + DTS, externalizing `react`, `react-dom`, and all `@khal-os/*` packages.

---

## Common pitfalls

### Wrong paths

- Packages are under `packages/`, not `repos/` — the `repos/` symlink in old worktrees may be broken
- Template files are in `packages/dev-cli/templates/app/`, not in `../pack-template`
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
- Global subjects (`os.*`) do NOT include `orgId`
- Subject builders in `SUBJECTS` are functions — call them: `SUBJECTS.pty.create(orgId)`, not `SUBJECTS.pty.create`

### Build issues

- All `@khal-os/*` packages must be externalized in tsup — they're provided by the host at runtime via `window.__KHAL_SHARED__`
- `react` and `react-dom` are always externals — never bundle them
- `peerDependencies` must be `^1.0.0` for `@khal-os/sdk` and `@khal-os/ui`

### Role system

- Four roles in order: `member` < `platform-dev` < `platform-admin` < `platform-owner`
- Use `hasMinRole(userRole, 'platform-dev')` to check — don't compare strings manually
- Legacy aliases exist: `admin` → `platform-admin`, `developer` → `platform-dev`, `viewer` → `member`
