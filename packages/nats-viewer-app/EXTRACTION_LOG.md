# Extraction Log: nats-viewer-app

First app extracted to prove the `@khal-os/sdk` + `@khal-os/ui` platform contract.

## Import Changes

| File | Old Import | New Import | Package |
|------|-----------|------------|---------|
| `NatsViewer.tsx` | `{ SectionHeader, SplitPane, StatusBar, Toolbar } from '@/components/os-primitives'` | `{ SectionHeader, SidebarNav, SplitPane, StatusBar, Toolbar } from '@khal-os/ui'` | `@khal-os/ui` (primitives) |
| `NatsViewer.tsx` | `{ SidebarNav } from '@/components/os-primitives/sidebar-nav'` | _(merged into above)_ | `@khal-os/ui` (primitives) |
| `PublishPanel.tsx` | `{ Button } from '@/components/ui/button'` | `{ Button, Input } from '@khal-os/ui'` | `@khal-os/ui` (shadcn) |
| `PublishPanel.tsx` | `{ Input } from '@/components/ui/input'` | _(merged into above)_ | `@khal-os/ui` (shadcn) |
| `RequestPanel.tsx` | `{ Button } from '@/components/ui/button'` | `{ Button, Input, Spinner } from '@khal-os/ui'` | `@khal-os/ui` (shadcn) |
| `RequestPanel.tsx` | `{ Input } from '@/components/ui/input'` | _(merged into above)_ | `@khal-os/ui` (shadcn) |
| `RequestPanel.tsx` | `{ Spinner } from '@/components/ui/spinner'` | _(merged into above)_ | `@khal-os/ui` (shadcn) |

## Already Clean (no `@/` imports)

| File | External Dependencies |
|------|----------------------|
| `Sidebar.tsx` | `@khal-os/ui` (Separator) |
| `MessageLog.tsx` | `@khal-os/ui` (EmptyState) |
| `SubjectCatalog.tsx` | `@khal-os/sdk/app` (SUBJECTS, useKhalAuth, useNats) |
| `ActiveSubs.tsx` | `lucide-react` only |
| `SubscribeInput.tsx` | `lucide-react` only |
| `nats-viewer-context.tsx` | `react` only |
| `use-message-buffer.ts` | `react` only |
| `types.ts` | none |
| `index.ts` | local re-exports only |
| `manifest.ts` | none |
| `components.ts` | `react` only |

## Package.json Changes

Added `@khal-os/sdk` as explicit workspace dependency (was already used via `@khal-os/sdk/app` imports but not declared).

```diff
 "dependencies": {
+  "@khal-os/sdk": "workspace:*",
   "@khal-os/ui": "workspace:*"
 }
```

## Other Changes

- Added `tsconfig.json` extending root config with empty `paths: {}` (no `@/*` alias)

## Migration Patterns for Other Apps

1. **OS primitives** (`@/components/os-primitives/*`): import from `@khal-os/ui` — all primitives are re-exported from the barrel
2. **shadcn/ui components** (`@/components/ui/*`): import from `@khal-os/ui` — Button, Input, Spinner, Badge, etc. are all re-exported
3. **SDK hooks** (`@/lib/hooks/*`): import from `@khal-os/sdk/app` — useNats, useNatsSubscription, useKhalAuth
4. **NATS subjects** (`@/lib/subjects`): import `SUBJECTS` from `@khal-os/sdk/app`
5. **Merge related imports**: combine multiple `@/components/ui/*` into a single `@khal-os/ui` import
6. **Declare dependencies**: add both `@khal-os/sdk` and `@khal-os/ui` as workspace dependencies in package.json

## Final Dependency Surface

```
@khal-os/nats-viewer-app
  ├── @khal-os/sdk (useNats, useKhalAuth, SUBJECTS)
  ├── @khal-os/ui  (Button, Input, Spinner, SplitPane, Toolbar, StatusBar, SectionHeader, SidebarNav, Separator, EmptyState)
  ├── react        (peer)
  └── lucide-react (icons, provided by monorepo)
```
