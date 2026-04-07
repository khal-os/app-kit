# @khal-os/desktop-shell

The canonical desktop environment shell for KhalOS. Provides the window manager, taskbar, topbar, notifications, keyboard shortcuts, and the dynamic pack loader.

**Version:** 1.0.0  
**Status:** Private workspace package (not published to npm)

## Usage

```tsx
import {
  Desktop,
  Taskbar,
  TopBar,
  CommandPalette,
  Window,
  WindowFrame,
  NotificationCenter,
  loadPack,
} from '@khal-os/desktop-shell';
```

## Architecture

```
@khal-os/types          (foundational types)
    |
@khal-os/sdk            (auth, NATS, roles)
    |
@khal-os/ui             (UI primitives, design system)
    |
@khal-os/desktop-shell  (this package)
```

`desktop-shell` depends on `@khal-os/sdk` and `@khal-os/ui`. It does **not** depend on any specific app — apps are loaded dynamically via the pack loader.

## Pack Loader Contract

The `loadPack()` function dynamically imports a pack by its package name at runtime. This is the entry point for all first-party and third-party apps in the desktop.

### API

```ts
import { loadPack, PackLoadError } from '@khal-os/desktop-shell';
import type { PackModule } from '@khal-os/desktop-shell';

// Load a pack by package name
const pack: PackModule = await loadPack('@khal-os/pack-terminal');
// pack.default   — React component (the app UI)
// pack.manifest  — optional khal-app.json metadata

// Error handling
try {
  await loadPack('@khal-os/pack-unknown');
} catch (err) {
  if (err instanceof PackLoadError) {
    console.error(err.packId, err.message);
  }
}
```

### Creating a New Pack

1. Create a package that default-exports a React component:

   ```tsx
   // src/index.tsx
   export default function MyApp({ windowId }: { windowId: string }) {
     return <div>Hello from my pack!</div>;
   }

   // Optionally re-export your manifest
   export { default as manifest } from '../khal-app.json';
   ```

2. Register the pack in the desktop's `packs.json`:

   ```json
   [{ "id": "my-app", "package": "@my-org/pack-my-app" }]
   ```

3. The desktop runtime calls `loadPack("@my-org/pack-my-app")` when the user opens the app.

## Creating a new `pack-*` repo

Each first-party app lives in its own `khal-os/pack-<name>` repository, scaffolded from the canonical template.

### 1. Create the repo

```bash
gh repo create khal-os/pack-<name> --template khal-os/pack-template --private
git clone git@github.com:khal-os/pack-<name>.git
cd pack-<name>
```

### 2. Post-create checklist

- [ ] **Rename the npm package** — edit `package/package.json`: set `name` to `@khal-os/pack-<name>`
- [ ] **Fill the manifest** — edit `khal-app.json` at the repo root with your app's `id`, `name`, `icon`, `description`, `permissions`, and `frontend.package`
- [ ] **Implement the entry component** — replace the placeholder in `package/src/index.tsx` with your app's default export (`({ manifest, sdk }) => JSX.Element`)
- [ ] **Delete `service/` if frontend-only** — if your pack has no backend pod, remove the entire `service/` directory and the `backend` section from `khal-app.json`
- [ ] **Update Helm values** — if keeping `service/`, edit `helm/values.yaml` with the correct image repository (`ghcr.io/khal-os/pack-<name>-service`) and environment variables
- [ ] **Update `README.md`** — replace the template README with your app's documentation
- [ ] **Create `dev` branch** — `git checkout -b dev && git push -u origin dev` (all subsequent PRs target `dev`)

### 3. Verify

```bash
cd package && bun install && bun run typecheck && bun run lint && bun run test
```

### 4. Manifest schema

The `khal-app.json` manifest is validated by `KhalAppManifest` from `@khal-os/types`. See [`packages/types/src/manifest.ts`](../types/src/manifest.ts) for the full schema and `validateManifest()` function.

### 5. How the loader works

`desktop-shell/src/loader.ts` dynamically imports a pack module, reads its `manifest` export, validates it with `validateManifest()`, and returns `{ default, manifest }`. If validation fails, it throws a `PackLoadError`.

For more details on the pack architecture, see the [KhalOS docs](https://github.com/khal-os/docs) pack section.

## Exports

### Components
- `Desktop`, `DesktopShell`, `DesktopBackground`, `DesktopIcon`
- `Window`, `WindowFrame`, `WindowContent`, `WindowRenderer`
- `Taskbar`, `AppLauncher`, `RunningApps`, `SystemTray`, `UserMenu`, `WorkspaceSwitcher`
- `TopBar`, `KMenu`, `TabPill`, `TabContextMenu`
- `NotificationCenter`, `NotificationToasts`, `OrphanSessionToast`
- `CommandPalette`, `ConnectionBanner`, `ShortcutViewer`, `WindowSwitcher`
- `AppSettingsPanel`, `AppWindowTabs`, `AppErrorBoundary`
- `TrafficLights`, `WindowControlsOverlay`, `WindowsControls`
- `MobileWindowStack`, `SnapPreview`, `MeshGradientBackground`

### Hooks
- `useDesktopNats`, `useGlobalKeybinds`, `useLaunchApp`, `useNatsNotifications`
- `useConnectionState`, `useIsMobile`, `useVisualViewport`, `usePlatform`

### Stores (Zustand)
- `useDesktopStore`, `useWindowStore`, `useTabStore`, `useKeybindStore`

### Pack Loader
- `loadPack(id)`, `PackLoadError`, `PackModule`

## Peer Dependencies

- `react >= 19`
- `react-dom >= 19`
- `zustand >= 5`
- `@khal-os/sdk >= 1`
- `@khal-os/ui >= 1`
