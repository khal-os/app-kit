# Constraints — app-kit

- **NEVER** push directly to `main`. Feature branches only; PRs target `dev`. Humans merge `dev → main`.
- **NEVER** add a new export without verifying it against the actual source file. Grep first, document second.
- **NEVER** bundle `react`, `react-dom`, or any `@khal-os/*` package into a published tsup build — they must be `external`. Host provides at runtime via `window.__KHAL_SHARED__`.
- **NEVER** move `react`, `@khal-os/sdk`, or `@khal-os/ui` out of `peerDependencies`. App packs rely on this contract.
- **NEVER** change NATS subject constants in `@khal-os/sdk/app/subjects` without updating `../core/src/lib/subjects.ts` and grepping every pack. Both locations must stay in sync.
- **NEVER** rename or remove an exported symbol from a published package without a major version bump.
- **NEVER** add breaking schema changes to `KhalAppManifest`, `KhalServiceSpec`, or `KhalWindowSpec` without a migration plan for existing `pack-*` repos.
- **NEVER** publish a package with `--no-verify` or `--no-git-checks`. CI publishes; manual pushes require explicit approval.
- **NEVER** edit OKLCH token values in `packages/os-ui/tokens.css` without coordinating with `../desktop` and `../core` — dark-mode remapping lives there too.
- **NEVER** commit `.env` files or real secrets.

## Authority matrix

### Can do without approval

- Add new components to `@khal-os/ui` (non-breaking)
- Add new hooks to `@khal-os/sdk` (non-breaking)
- Add new Zod-schema fields as optional to `@khal-os/types`
- Fix bugs in `khal-dev` CLI commands
- Update scaffold templates in `packages/dev-cli/templates/app/` (all new packs get the change; existing ones don't)
- Add missing types to existing exports
- Run `turbo build`, `turbo typecheck`, `biome check .`

### Requires human approval

- Publishing to npm / GitHub Packages
- Bumping any `@khal-os/*` major version
- Removing or renaming exported symbols
- Changing NATS subject constants
- Modifying OKLCH tokens
- Modifying peer dependency constraints
- Merging to `main`
