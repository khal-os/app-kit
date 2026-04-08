# Wish: Marketplace UI + Terminal Dynamic Install + Per-User Sandbox

| Field | Value |
|-------|-------|
| **Status** | DRAFT |
| **Slug** | `marketplace-terminal-sandbox` |
| **Date** | 2026-04-08 |
| **Design** | [DESIGN.md](../../brainstorms/core-deploy-terminal-marketplace/DESIGN.md) |

## Summary

Build the marketplace UI in desktop-shell, make terminal the first dynamically installable app, and wire install→sandbox provisioning so each user gets their own ubuntu environment (4c/4g, expandable to 16g, user=email, sudoers). Files and settings stay bundled with the OS. The marketplace is the gateway to everything else.

**Why now:** Core is deploying. Desktop can render the shell. But there's no way to discover, install, or use apps. Terminal is the most tangible first app — proving the full install→provision→use pipeline.

## Scope

### IN

**Wave 1 — Marketplace UI (app-kit/desktop-shell)**
- Build `MarketplaceView` component: grid of app cards from `os.apps.store.list`
- Each card: icon, name, description, install/uninstall button, installed badge
- RBAC-gated install: check `minRole` from app_store entry, show "Request Access" if unauthorized
- Wire into desktop-shell's component registry so `component: 'marketplace'` resolves to MarketplaceView
- Marketplace always in dock (already in FALLBACK_APPS as `id: 'marketplace'`)

**Wave 1 — Desktop app model cleanup (app-kit/desktop-shell)**
- Update FALLBACK_APPS: keep only files, settings, marketplace (remove terminal, nats-viewer, genie, ideas, mission-control)
- Desktop fetches installed apps from `os.apps.list` on login — these appear alongside bundled apps
- Bundled apps (files, settings, marketplace) always visible regardless of `installed_apps` state

**Wave 2 — Terminal ESM bundle (pack-terminal)**
- Configure tsup to produce `dist/bundle.mjs` (single ESM file, React/NATS externalized via `window.__KHAL_SHARED__`)
- Pack-terminal CI builds and publishes the bundle
- Core serves the bundle at `/_apps/terminal/bundle.mjs` (static file serving from `installed-apps/` or reverse proxy)

**Wave 2 — Desktop dynamic loader for installed apps (desktop)**
- When user installs terminal via marketplace, desktop receives updated app list
- Desktop fetches `bundleUrl` from app manifest, loads ESM bundle at runtime
- Terminal component renders in a window

**Wave 3 — Install→sandbox provisioning (core)**
- When `os.apps.register` is called for an app with `sandbox: true` in manifest:
  - Create k8s sandbox pod for that user (4 vCPU, 4GB RAM, limits 16GB)
  - Linux user = user's email, added to sudoers
  - Mount user's Files storage into sandbox (shared PVC)
  - Sandbox registers on NATS: `os.sandbox.{userId}.*`
- Terminal frontend connects to `os.sandbox.{userId}.pty.*`
- Uninstall → teardown sandbox pod

### OUT
- Genie app integration (separate wish — CLI backend complexity)
- Hello apps / NATS viewer (lower priority — after terminal proves pattern)
- Marketplace approval workflow for third-party apps
- App auto-updates / version management
- Sandbox idle timeout / sleep-wake (future optimization)
- Sandbox GPU passthrough
- Multiple sandboxes per user
- Files app backend changes (file server exists — just mount point)
- Tauri desktop build (web-only for now)

## Decisions

| Decision | Rationale |
|----------|-----------|
| Only files + settings bundled | Everything else installable. Salesforce module model — sell separately. |
| Marketplace in desktop-shell | OS chrome, not an app. Users need it to install their first app. |
| Terminal = first installable app | Proves full install→provision→use. Most tangible demo. |
| ESM bundle via tsup | `window.__KHAL_SHARED__` externalizes React/SDK. Pack builds single .mjs file. |
| Sandbox per-user, on-demand | Install triggers creation. 1:1 user:sandbox. Controls cost. |
| 4c/4g base, expandable 16g | Burstable via k8s limits. Reasonable dev workstation. |
| Sandbox user = email + sudoers | Personal workspace. Full control. |
| Files shared with sandbox | Shared PVC mount. Bridges user↔genie data. |
| RBAC on install | `minRole` field on app_store entry. Unauthorized users see "Request Access". |

## Success Criteria

- [ ] User logs in → sees Settings, Files, and Marketplace in dock (NOT terminal, genie, etc.)
- [ ] Opens Marketplace → sees app catalog from `os.apps.store.list` (5 apps seeded)
- [ ] Terminal card shows "Install" button (user has permission)
- [ ] Clicks Install → terminal installs → sandbox pod created (4c/4g, user=email, sudoers)
- [ ] Terminal icon appears on desktop
- [ ] Opens Terminal → PTY session to personal sandbox → working shell
- [ ] Sandbox can access Files content at mount point
- [ ] Second user installs terminal → gets own independent sandbox
- [ ] Uninstall terminal → sandbox pod deleted → icon removed
- [ ] Unauthorized user sees "Request Access" instead of "Install"
- [ ] Files and Settings work without any install (bundled)

## Execution Strategy

### Wave 1 (single engineer — marketplace UI + app model cleanup)
| Group | Agent | Description |
|-------|-------|-------------|
| 1 | engineer | MarketplaceView component + FALLBACK_APPS cleanup (same files, single engineer) |

### Wave 2 (parallel — terminal bundle + desktop loader)
| Group | Agent | Description |
|-------|-------|-------------|
| 2 | engineer | Pack-terminal ESM bundle build |
| 3 | engineer | Desktop dynamic loader refactor for marketplace-installed apps |

### Wave 3 (sequential — sandbox provisioning, depends on Wave 2)
| Group | Agent | Description |
|-------|-------|-------------|
| 4 | engineer | Install→sandbox provisioning in core + terminal PTY wiring |

## Execution Groups

### Group 1: MarketplaceView + App Model Cleanup
**Goal:** Build marketplace UI in desktop-shell AND separate bundled apps from installed apps. Single engineer — both touch `desktop-store.ts` and related files.

**Deliverables:**
1. Create `packages/desktop-shell/src/components/marketplace/MarketplaceView.tsx`:
   - Fetch catalog via NATS: `os.apps.store.list` → grid of app cards
   - Each card: icon (from `iconUrl` or `iconLucide`), name, shortDescription, category badge
   - Install button: calls `os.apps.register` with `{slug}`, shows loading state
   - Uninstall button: calls `os.apps.unregister`, confirms first
   - Installed badge on apps already in `installed_apps`
   - RBAC: read `minRole` from store entry, compare with user's role. Show "Request Access" if insufficient.
2. Create `packages/desktop-shell/src/components/marketplace/AppCard.tsx` — individual app card component
3. Register `MarketplaceView` in the component map so `component: 'marketplace'` resolves correctly
4. Export from `packages/desktop-shell/src/index.ts`
5. Update `FALLBACK_APPS` in `desktop-store.ts`: keep ONLY files, settings, marketplace. Remove terminal, nats-viewer, genie, ideas, mission-control.
6. Ensure `fetchApps` merges installed apps (from `os.apps.list`) with bundled apps — no duplicates
7. Bundled apps always visible even if `os.apps.list` returns empty or fails
8. When an app is installed via marketplace, desktop refreshes app list (re-fetch `os.apps.list` or listen for NATS event)

**Acceptance Criteria:**
- [ ] MarketplaceView renders a grid of apps from `os.apps.store.list`
- [ ] Install/uninstall buttons call correct NATS subjects
- [ ] RBAC check prevents unauthorized installs
- [ ] Component registered — opening "App Store" from dock shows MarketplaceView
- [ ] Fresh desktop shows only Files, Settings, Marketplace — no Terminal, no Genie
- [ ] After installing an app, it appears on desktop without page refresh
- [ ] Bundled apps persist even when NATS/PG is down (fallback)
- [ ] `bun run typecheck` clean

**Validation:**
```bash
# Run from app-kit repo root after cloning khal-os/app-kit
bun run typecheck
grep -r "MarketplaceView" packages/desktop-shell/src/ --include="*.tsx" --include="*.ts" | head -5
# Verify FALLBACK_APPS only has files, settings, marketplace:
grep -A5 "FALLBACK_APPS" packages/desktop-shell/src/stores/desktop-store.ts | grep -c "terminal"
# Must be 0
```

**Repo:** `khal-os/app-kit` — branch: `feat/marketplace-ui`
**depends-on:** none

---

### Group 2: Pack-Terminal ESM Bundle
**Goal:** Make pack-terminal produce a single ESM bundle loadable at runtime by desktop.

**Deliverables:**
1. Update `package/tsup.config.ts`: add `bundle` entry that produces `dist/bundle.mjs`
   - Format: `esm`
   - Entry: `src/index.ts`
   - External: `['react', 'react-dom', /^@khal-os\//]` (provided by `window.__KHAL_SHARED__`)
   - No splitting, single file output
2. Verify `bun run build` produces `dist/bundle.mjs`
3. Add `bundleUrl` field to `package/src/manifest.ts` pointing to `/_apps/terminal/bundle.mjs`
4. Update core's `apps.json`: add `bundleUrl: "/_apps/terminal/bundle.mjs"` to terminal entry

**Acceptance Criteria:**
- [ ] `bun run build` produces `package/dist/bundle.mjs`
- [ ] Bundle size < 500KB (xterm.js + terminal UI, externalized deps)
- [ ] Bundle exports default React component + manifest
- [ ] `apps.json` in core has terminal entry with bundleUrl

**Validation:**
```bash
# Run from pack-terminal repo root after cloning khal-os/pack-terminal
cd package && bun install && bun run build
ls dist/bundle.mjs && echo "PASS" || echo "FAIL"
wc -c dist/bundle.mjs
```

**Repo:** `khal-os/pack-terminal` — branch: `feat/esm-bundle`
**depends-on:** none (but Wave 2 timing — runs after review-1 passes)

---

### Group 3: Desktop Dynamic Loader Refactor
**Goal:** Refactor desktop's pack-registry to load marketplace-installed apps at runtime via ESM bundles instead of compile-time Vite imports.

**Context:** Current `pack-registry.ts` uses static `import(entry.package)` where `entry.package` is an npm package name (e.g., `@khal-os/pack-terminal`). This resolves at Vite build time. For marketplace-installed apps, we need runtime `import(bundleUrl)` where `bundleUrl` is an HTTP URL (e.g., `/_apps/terminal/bundle.mjs`). This is a **refactor**, not a trivial tweak.

**Deliverables:**
1. Refactor `src/desktop/pack-registry.ts`:
   - Bundled apps (files, settings): keep current Vite import path
   - Installed apps (from `os.apps.list`): load via `bundleUrl` from app manifest using `import(/* @vite-ignore */ bundleUrl)`
   - Distinguish bundled vs installed by source (`type: 'builtin'` vs `type: 'installed'`)
2. When rendering a window for an installed app:
   - Get `bundleUrl` from the app's manifest (returned by `os.apps.get` or `os.apps.list`)
   - `import(bundleUrl)` → get React component
   - Render component in window frame
3. Handle loading states: show spinner while bundle loads, error boundary if load fails
4. Core static file serving: serve `/_apps/{slug}/bundle.mjs` from `installed-apps/` directory or Next.js static route

**Acceptance Criteria:**
- [ ] Desktop can render a window for an app loaded via ESM bundle URL
- [ ] Loading spinner shown while bundle fetches
- [ ] Error boundary catches failed bundle loads gracefully
- [ ] Core serves `/_apps/terminal/bundle.mjs` (static file or API route)
- [ ] Bundled apps (files, settings) still work via Vite imports

**Validation:**
```bash
# Run from desktop repo root after cloning khal-os/desktop
pnpm run typecheck
grep -r "bundleUrl\|@vite-ignore" src/ --include="*.ts" --include="*.tsx" | head -5
```

**Repo:** `khal-os/desktop` — branch: `feat/dynamic-app-loader`
**depends-on:** Group 1 (marketplace must be able to trigger install)

---

### Group 4: Install→Sandbox Provisioning + Terminal PTY
**Goal:** When terminal is installed, auto-provision a per-user sandbox pod and wire PTY over NATS.

**Deliverables:**
1. Extend `os.apps.register` handler in `app-store-handlers.ts`:
   - After inserting into `installed_apps`, check if app manifest has `sandbox: true` in `manifestJson`
   - If yes, call sandbox provisioning: publish to `os.sandbox.create` with user-specific params
   - This is NEW code — the current handler only inserts and increments download count
2. Sandbox provisioning creates k8s pod:
   - Image: ubuntu sandbox base (already built)
   - Resources: `requests: {cpu: "4", memory: "4Gi"}`, `limits: {cpu: "4", memory: "16Gi"}`
   - User: created from authenticated user's email, added to sudoers
   - Volume: mount user's Files storage (shared PVC at `/files`)
   - NATS sidecar for PTY communication
3. Terminal frontend connects to `os.sandbox.{userId}.pty.*` subjects
4. Extend `os.apps.unregister`: if app has sandbox, call `os.sandbox.delete` to tear down pod
5. Add `sandbox: true` flag to terminal's `app_store` seed migration `manifestJson`

**Acceptance Criteria:**
- [ ] Installing terminal creates a sandbox pod for the user
- [ ] Sandbox has 4c/4g resources, user=email, sudoers
- [ ] Files mount at `/files` inside sandbox
- [ ] Terminal opens → PTY connects to user's sandbox → working shell
- [ ] Uninstalling terminal deletes the sandbox pod
- [ ] Second user gets independent sandbox

**Validation:**
```bash
# Run from core repo root after cloning khal-os/core
bun run typecheck
grep -r "sandbox" apps.json
# After deploy: kubectl get pods -l app=sandbox
```

**Repo:** `khal-os/core` — branch: `feat/sandbox-install-provisioning`
**depends-on:** Groups 1, 2, 3 (marketplace + terminal bundle + dynamic loader must all work first)

---

## QA Criteria

- [ ] Fresh login shows Files + Settings + Marketplace only — NO other apps
- [ ] Marketplace shows 5 catalog apps from seeded `app_store`
- [ ] Install terminal → sandbox pod created → terminal opens → shell works
- [ ] Files accessible from sandbox at `/files`
- [ ] Uninstall terminal → sandbox deleted → icon gone
- [ ] Unauthorized user cannot install (sees "Request Access")
- [ ] Two users can have terminal installed simultaneously with independent sandboxes

---

## Assumptions / Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| MarketplaceView UI complexity | Medium | Start minimal — grid of cards, install button. Polish later. |
| ESM bundle loading fails in production | High | Terminal is the first test. Debug inline. Error boundary catches failures gracefully. |
| xterm.js bundle too large | Medium | Externalize React/SDK. xterm.js is ~200KB gzipped — acceptable. |
| Sandbox boot time (30-60s) | Medium | Show progress indicator. Pre-pull base image on nodes. |
| 10 users × 4c/4g = 40 cores/40GB | High | Start with 2-3 OKE nodes, autoscale. Monitor. |
| Shared PVC requires ReadWriteMany | Medium | Use NFS-backed PVC or OCI File Storage (both support RWX). |
| Desktop dynamic loader never tested | High | Group 4 is the proof. If it fails, fix before proceeding to Group 5. |

---

## Cross-Wish Dependencies

**Depends on (already shipped):**
- `production-ready-core` — NATS namespace clean, app store seeded
- `pack-contract` — pack-terminal repo standardized
- `dynamic-app-loader` — core registry + desktop loader infrastructure

**Blocks:**
- Individual pack integrations (genie, nats-viewer, hello) — terminal proves the pattern first
- `core-strip` — can't strip core until all apps load dynamically

---

## Files to Create/Modify

```
# App-Kit (Group 1)
packages/desktop-shell/src/components/marketplace/MarketplaceView.tsx  (CREATE)
packages/desktop-shell/src/components/marketplace/AppCard.tsx  (CREATE)
packages/desktop-shell/src/stores/desktop-store.ts  (MODIFY — FALLBACK_APPS cleanup + fetchApps merge)
packages/desktop-shell/src/index.ts  (MODIFY — export MarketplaceView)

# Pack-Terminal (Group 2)
package/tsup.config.ts  (MODIFY — add bundle entry)
package/src/manifest.ts  (MODIFY — add bundleUrl)

# Core (Groups 2 + 4)
apps.json  (MODIFY — add terminal bundleUrl)
src/lib/app-store-handlers.ts  (MODIFY — sandbox provisioning on install)

# Desktop (Group 3)
src/desktop/pack-registry.ts  (MODIFY — refactor to support ESM bundle loading for installed apps)
```
