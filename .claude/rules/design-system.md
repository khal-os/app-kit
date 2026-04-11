# Design system — OKLCH tokens

KhalOS uses the **OKLCH color space** for perceptual uniformity. Scales run **100 (lightest) to 1000 (darkest)** in light mode, inverted in dark mode. All tokens use the `--ds-` prefix. Tokens live in `packages/os-ui/tokens.css`.

## Color scales

| Scale | CSS variable pattern | Example (500) |
|---|---|---|
| Gray | `--ds-gray-{100..1000}` | `oklch(0.836 0 0)` |
| Gray Alpha | `--ds-gray-alpha-{100..1000}` | `oklch(0 0 0 / 0.21)` |
| Blue | `--ds-blue-{100..1000}` | `oklch(82.75% 0.0979 248.48)` |
| Red | `--ds-red-{100..1000}` | `oklch(84.47% 0.1018 17.71)` |
| Amber | `--ds-amber-{100..1000}` | `oklch(86.55% 0.1583 79.63)` |
| Green | `--ds-green-{100..1000}` | `oklch(85.45% 0.1627 146.3)` |
| Teal | `--ds-teal-{100..1000}` | teal hues |
| Purple | `--ds-purple-{100..1000}` | purple hues |
| Pink | `--ds-pink-{100..1000}` | pink hues |

## Brand & product colors

| Token | Value | Usage |
|---|---|---|
| `--ds-accent-warm` | `oklch(0.74 0.11 65)` | Primary accent color |
| `--ds-accent-warm-subtle` | `oklch(0.74 0.11 65 / 0.12)` | Accent at low opacity |
| `--ds-product-os` | `oklch(0.72 0.15 250)` | KhalOS brand — blue |
| `--ds-product-khal` | `oklch(0.75 0.15 55)` | Khal brand — warm gold |
| `--ds-product-genie` | `oklch(0.73 0.13 295)` | Genie brand — purple |
| `--ds-product-omni` | `oklch(0.8 0.12 175)` | Omni brand — teal |

## Other tokens

- **Backgrounds:** `--ds-background-100` (white), `--ds-background-200` (near-white)
- **Shadows:** `--ds-shadow-{2xs,xs,small,medium,large,xl,2xl,tooltip,menu,modal,fullscreen}`
- **Focus:** `--ds-focus-ring` (uses blue-700)
- **Motion:** `--ds-motion-swift: cubic-bezier(0.175, 0.885, 0.32, 1.1)`

## Usage in components

```tsx
// Via Tailwind utilities (preferred):
<div className="bg-background-100 text-gray-1000 shadow-medium" />

// Via CSS custom properties:
style={{ color: 'var(--ds-gray-500)' }}
```

**Dark mode is automatic via the `.dark` class** — all token values are re-mapped. If you change a light-mode value, you must update the dark-mode counterpart too.
