# NATS patterns — subjects, request/reply, JetStream

## Subject naming convention

All subjects follow hierarchical dot-notation:

| Pattern | Scope | Examples |
|---|---|---|
| `khal.{orgId}.{service}.{action}` | Org-scoped services | `khal.abc123.files.read`, `khal.abc123.pty.create` |
| `khal.{orgId}.{service}.{id}.{action}` | Entity-scoped | `khal.abc123.pty.sess1.data` |
| `os.{domain}.{action}` | Global / cross-org | `os.sandbox.create`, `os.auth.role-changed` |

**Rule:** org-scoped subjects always include `{orgId}`; global subjects never do. Don't mix them.

## Core subject groups

### PTY (Terminal)
- `khal.{orgId}.pty.create` / `.destroy` / `.list`
- `khal.{orgId}.pty.{sessionId}.{data|input|resize|exit|replay|buffer|buffer-end}`

### File system
- `khal.{orgId}.fs.{list|read|write|search}`
- `khal.{orgId}.fs.watch.{pathHash}`

### Desktop window management
- `khal.{orgId}.desktop.{userId}.cmd.{open|close|focus|minimize|maximize|restore|notify|sync}`
- `khal.{orgId}.desktop.{userId}.event.{opened|closed|focused|minimized|maximized|restored|state|metaUpdated|moved|resized}`

### Sandbox (per-user containers)
- `os.sandbox.{create|delete|status}` (global)
- `os.sandbox.{userId}.events` (lifecycle stream)
- `khal.{orgId}.sandbox.{userId}.pty.{create|destroy|list|data|input|resize|exit}`

### Auth
- `os.auth.role-changed`
- `os.auth.membership-revoked`

### Notifications
- `khal.{orgId}.notify.broadcast`
- `khal.{orgId}.notify.user.{userId}`

### Marketplace
- `os.marketplace.{install|uninstall|update}` — Temporal workflow triggers
- `os.marketplace.installed` — list installed apps
- `os.marketplace.install.status` — installation progress pub
- `os.apps.registry` / `os.apps.registry.changed` / `os.apps.list`

## Request/reply pattern

```typescript
import { useNats } from '@khal-os/sdk/app';

const { request } = useNats();

// Client sends request, waits for reply with timeout (ms)
const reply = await request('khal.{orgId}.files.read', { path: '/home/user/file.txt' }, 5000);
```

## JetStream streams

| Stream | Subject filter | Retention | Purpose |
|---|---|---|---|
| `OS_KHAL_EVENTS` | `events.>` | 7 days | Domain events (app installs, auth changes) |
| `OS_O11Y_EVENTS` | `os.o11y.events.>` | 24 hours | Observability events |
| `OS_O11Y_LOGS` | `os.o11y.logs.>` | 24 hours | Observability logs |

## Subject builders

The authoritative subject constants live in `packages/os-sdk/src/app/subjects.ts`. Always import from `@khal-os/sdk/app/subjects` (or the re-export in `@khal-os/sdk/app`) — **do not** hardcode subject strings in app code.

```typescript
import { SUBJECTS } from '@khal-os/sdk/app';

// Correct: builder functions, call with args
const subject = SUBJECTS.pty.create(orgId);

// Wrong: never use string templates directly
const subject = `khal.${orgId}.pty.create`;   // brittle, drifts from source of truth
```
