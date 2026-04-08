---
name: create-app
description: "Scaffold a new KhalOS app — manifest, views, service, UI boilerplate. Like create-next-app for KhalOS."
argument-hint: "<app-name>"
---

# /khal:create-app — Scaffold a New App

Create a new KhalOS app with all boilerplate: manifest, package.json, views, service, and UI component.

## Flow

1. Ask for the app name/slug if not provided in `$ARGUMENTS` (kebab-case, e.g., `my-cool-app`)
2. Create the package directory and all files
3. Add to root dependencies
4. Verify it builds

## Step 1: Create Package Directory

```bash
APP_NAME="<slug>"  # e.g., "my-cool-app"
APP_ID="${APP_NAME}"
VIEW_ID="${APP_NAME//-/}"  # remove hyphens for view ID

mkdir -p "packages/${APP_NAME}/views/${VIEW_ID}/ui"
mkdir -p "packages/${APP_NAME}/views/${VIEW_ID}/service"
```

## Step 2: Create package.json

```json
{
  "name": "@khal-os/${APP_NAME}",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {
    "@khal-os/sdk": "workspace:*",
    "@khal-os/ui": "workspace:*",
    "react": "workspace:*"
  }
}
```

## Step 3: Create manifest.ts

Use `defineManifest` from the SDK for type-safe manifest definition:

```typescript
import { defineManifest } from '@khal-os/sdk/app';

export default defineManifest({
  id: '${APP_ID}',
  views: [
    {
      id: '${VIEW_ID}',
      label: '${AppLabel}',
      permission: '${VIEW_ID}',
      minRole: 'platform-dev' as const,
      defaultSize: { width: 800, height: 600 },
      component: './views/${VIEW_ID}/ui/${AppComponent}',
    },
  ],
  desktop: {
    icon: '/icons/dusk/application.svg',
    categories: ['Apps'],
    comment: '${AppLabel} app',
  },
});
```

## Step 4: Create UI Component

Create `packages/${APP_NAME}/views/${VIEW_ID}/ui/${AppComponent}.tsx`:

```tsx
export default function ${AppComponent}() {
  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-xl font-medium">${AppLabel}</h1>
    </div>
  );
}
```

## Step 5: Create Service (optional)

Ask the user whether the app needs a backend service. If yes, create `packages/${APP_NAME}/views/${VIEW_ID}/service/index.ts`:

```typescript
import { createService } from '@khal-os/sdk/service/runtime';

createService({
  name: '${APP_ID}-service',
  appId: '${APP_ID}',
  subscriptions: [],
  onReady: async (_nc, log) => {
    log.info('${AppLabel} service ready');
  },
});
```

If the app does NOT need a service, skip this step and use the no-service package.json variant (omit service-related deps).

## Step 6: Register in Root

Add to root `package.json` dependencies:
```bash
# The pnpm workspace glob (packages/*) auto-discovers it.
# Just add the dependency reference:
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.dependencies['@khal-os/${APP_NAME}'] = 'workspace:*';
  // Sort dependencies
  pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a],[b]) => a.localeCompare(b)));
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n');
"
```

## Step 7: Verify

```bash
pnpm install
npx tsc --noEmit
pnpm biome check .
```

## Variable Reference

| Placeholder | Derivation | Example |
|---|---|---|
| `${APP_NAME}` | User input (kebab-case) | `my-cool-app` |
| `${APP_ID}` | Same as APP_NAME | `my-cool-app` |
| `${VIEW_ID}` | APP_NAME with hyphens removed | `mycoolapp` |
| `${AppLabel}` | Title-cased APP_NAME | `My Cool App` |
| `${AppComponent}` | PascalCase APP_NAME | `MyCoolApp` |

## Reference Apps

Look at these for patterns:
- `packages/settings-app/` — simple UI-only app with `defineManifest`
- `packages/terminal-app/` — app with PTY service using `createService`
- `packages/genie-app/` — complex app with multiple views

## Existing Template

There is also a file-based template at `packages/os-cli/templates/app/` that can be used as a starting point via the CLI:
```bash
npx tsx packages/os-cli/src/index.ts app create <name>
```
