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
