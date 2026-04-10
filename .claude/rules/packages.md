# Packages — Exhaustive map of every @khal-os/* package

## `@khal-os/sdk` (v1.0.17)

The app-facing SDK. Six entry points:

| Entry point | Source | Key exports |
|---|---|---|
| `.` | `src/index.ts` | Re-exports everything from `./app` |
| `./app` | `src/app/index.ts` | `useKhalAuth`, `useNats`, `useNatsSubscription`, `useService`, `getNatsClient`, `defineManifest`, `validateManifest`, `normalizeRole`, `hasMinRole`, `APP_MANIFEST`, `SUBJECTS`, `createSandbox`, `deleteSandbox`, `useSandboxStatus`, `SubjectBuilder` |
| `./app/roles` | `src/app/roles.ts` | `normalizeRole`, `hasMinRole`, `computeRolePermissions`, `registerRolePermissions`, `getRolePermissions`, `ROLE_HIERARCHY` |
| `./app/registry` | `src/app/app-registry.ts` | `APP_MANIFEST`, `registerManifestEntry`, `getManifestEntry`, `getVoiceAgentSlug`, `getVoiceLabel`, `SUBJECT_PERMISSIONS`, `DEFAULT_ROLE_PERMISSIONS`, `refreshRolePermissions` |
| `./app/subjects` | `src/app/subjects.ts` | `SUBJECTS` — NATS subject builders for all services |
| `./runtime` | `src/runtime/index.ts` | `TauriSupervisor` — headless service runtime for exported apps |

### Source structure

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

## `@khal-os/ui` (v1.0.17)

The component library and design system. Two exports:

| Export | What |
|---|---|
| `.` | All components, hooks, stores, animations, utilities |
| `./tokens.css` | OKLCH design tokens (reference only — host provides at runtime) |

### Components (28)

| Component | File |
|---|---|
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

### Primitives (11)

| Primitive | File |
|---|---|
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

### Additional exports

- **Hooks:** `useReducedMotion`
- **Animations:** `fadeIn`, `fadeUp`, `khalEasing`, `scaleUp`, `springConfig`, `staggerChild`, `staggerContainer`
- **Stores:** `useNotificationStore`, `useThemeStore`
- **Auth (re-exported from SDK):** `useKhalAuth`, `useOSAuth`, `useNats`, `useNatsSubscription`, `SUBJECTS`
- **Utilities:** `cn` (classname merge)
- **Type:** `AppComponentProps` = `{ windowId: string; meta?: Record<string, unknown> }`

## `@khal-os/types` (v1.0.17)

Shared TypeScript types and Zod schemas.

### Types

- `AppManifest`, `AppManifestView`, `AppDesktopConfig`, `AppServiceConfig`
- `AppEnvVar`, `AppDeployConfig`, `AppTauriConfig`
- `ServiceHealthConfig`, `SandboxConfig`, `SandboxResourceSpec`, `SandboxMount`
- `KhalAuth`, `ConnectionState`, `Role`
- `KhalPermission`, `KhalServiceSpec`, `KhalWindowSpec`, `KhalAppEntry`, `KhalAppManifest`

### Zod schemas

- `KhalPermission` — enum: `nats:publish`, `nats:subscribe`, `files:read`, `files:write`, `pty:spawn`, `http:fetch`, `system:clipboard`, `system:notifications`
- `KhalServiceSpec` — service declaration (name, command, entry, runtime, ports, health)
- `KhalWindowSpec` — window config (id, title, width, height, resizable)
- `KhalAppManifestSchema` — full manifest validation (strict mode)
- `KhalAppEntrySchema` — bundle pack app entry

### Constants

- `ROLE_HIERARCHY`: `['member', 'platform-dev', 'platform-admin', 'platform-owner']`
- `validateManifest(raw)` — validates against `KhalAppManifestSchema`, throws `ZodError` on failure

## `@khal-os/dev-cli` (v1.0.0)

Developer CLI for scaffolding and QA.

**Binary:** `khal-dev`

**Commands:**
- `khal-dev app create [name]` — scaffold a new app (interactive prompts)
- `khal-dev qa look` — screenshot capture
- `khal-dev qa health` — health check
- `khal-dev qa console` — console / logging
- `khal-dev qa bug` — bug report
- `khal-dev qa login` — login testing
- `khal-dev qa session` — session management
- `khal-dev qa assert` — assertions

**Templates location:** `packages/dev-cli/templates/app/` — this is what `khal-dev app create` copies. It is NOT the same as `../pack-template` (which is the template for standalone `pack-*` repos). Keep the two in sync where they share concerns.

## Registered apps (`APP_MANIFEST`)

`packages/os-sdk/src/app/app-registry.ts` contains static entries for core apps:

| App ID | Label | Permission |
|---|---|---|
| `terminal` | Terminal | `terminal` |
| `settings` | Settings | `settings` |
| `files` | Files | `files.read` |
| `nats-viewer` | NATS Viewer | `nats-viewer` |
| `mission-control` | Mission Control | `mission-control` |
| `genie` | Genie | `genie` |
| `ideas` | Ideas | `ideas` |
| `marketplace` | Marketplace | `marketplace` |

Apps not in this list are loaded dynamically via `registerManifestEntry()` at runtime.
