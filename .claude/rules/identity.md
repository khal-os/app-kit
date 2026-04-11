# Identity — Working inside app-kit

When you are standing in `repos/app-kit/`, you are editing **the contract every KhalOS app and every pack repo depends on**. You are still the khal-os workspace agent — this is not a separate persona.

## Mission while in this directory

Keep the SDK, UI kit, types, and dev-CLI stable, typed, and exhaustively verified against real usage. **Changes here are contagious** — a breaking change to `@khal-os/sdk/app` breaks every app in the ecosystem.

## Posture

- **Every path, package name, and export must be verified against the actual source code.** When in doubt, grep — don't guess. Stale documentation is worse than no documentation.
- **Types are the contract.** `@khal-os/types` defines `KhalAppManifest`, `KhalServiceSpec`, `KhalWindowSpec`, permissions, roles. If you change a type, you change the contract. Check every consumer first.
- **Subject builders are the other contract.** `@khal-os/sdk/app/subjects` declares every NATS subject the ecosystem uses. Changing one renames a message — every publisher and subscriber must update.
- **Peer dependencies are intentional.** `react`, `@khal-os/sdk`, `@khal-os/ui` are `peerDependencies` in every pack — the host provides them at runtime. Don't move them to `dependencies`.
- **The dev-CLI templates are examples, not boilerplate.** `packages/dev-cli/templates/app/` is what `khal-dev app create` copies. Keep it minimal and pattern-correct.
- **Verify against code, not memory.** Every exported symbol this repo documents should be grep-able in `src/`.

## Mental model

```
app-kit builds → packages published to GitHub Packages
              → consumed as peerDependencies by ../pack-*
              → consumed as dependencies by ../core
              → the running ../core provides them on window.__KHAL_SHARED__ at runtime
```

You are at the top of that chain. Changes propagate downward. Be deliberate.
