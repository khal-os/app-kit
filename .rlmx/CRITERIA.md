# Output format — YAML triage blocks ONLY

Your final answer is a sequence of YAML blocks, one per wish in scope. **No prose. No headings. No "## Summary" section.** The output must start with the first `- slug:` line and end with the last YAML block.

## Schema (per wish)

```yaml
- slug: <wish-slug>
  title: <copy from "# Wish:" or "# WISH:" header, max 100 chars>
  state: shipped | in-flight | queued | stale | superseded | unclear
  state_evidence: <ONE phrase from the wish file justifying the state — quote it>
  core_idea: <ONE sentence — what user/system gets, stripped of HOW>
  value: high | medium | low | none
  overlaps: [<other slugs in scope this wish overlaps with>]
  key_files_referenced: [<files/paths the wish mentions, max 8>]
  files_verified: [<subset of key_files_referenced that you confirmed exist by string-searching REPO_INDEX.md>]
  prs_verified: [<PR numbers from RECENT_PRS.md that match shipped claims>]
  insight: <ONE sentence the user might have missed — only if non-obvious; otherwise omit this field>
  flags: [<flags: pre-rename, numbered-workstream, references-deleted-code, dup-of-<slug>, superseded-by-<slug>, blocked-by-<slug>, security-critical, P0, etc>]
```

## State definitions

- **shipped** — wish file says SHIPPED/COMPLETED/DONE/DELIVERED, OR has a clear `Done` section with merged PR refs (verify via RECENT_PRS.md), OR is a numbered `w<N>-` workstream that has a corresponding named wish marked shipped.
- **in-flight** — explicit `Status: IN PROGRESS`, OR PR number cited as "active", OR matches the current branch.
- **queued** — drafty but coherent, has acceptance criteria, ready to dispatch.
- **stale** — old draft, sketchy, no clear acceptance criteria, references things that may have changed.
- **superseded** — a newer wish in the same area replaces it (cite the slug in `flags`).
- **unclear** — file missing, empty, or genuinely indeterminate from the body alone.

## Value definitions (orthogonal to state)

- **high** — the IDEA is load-bearing for v1 or near-term roadmap.
- **medium** — useful but optional; might re-emerge later.
- **low** — niche, edge case, or already covered.
- **none** — abandoned concept, no longer relevant.

## insight field — what to surface

Use sparingly. Only emit when you spot something the user likely missed:

- A wish marked DRAFT but whose entire scope shows up in REPO_INDEX.md / RECENT_PRS.md (state should be `shipped`).
- A "shipped" wish whose claimed PR doesn't appear in RECENT_PRS.md (suspicious).
- A wish referencing files that DO NOT appear in REPO_INDEX.md (references-deleted-code).
- Two wishes with overlapping scope where one explicitly supersedes the other but the older one isn't marked.
- A "stale" wish whose core idea is still genuinely valuable.

If nothing non-obvious, omit the field. Don't pad.

## Hard rules

- ONE YAML block per wish in scope. Do not skip wishes; if a file is missing emit `state: unclear, state_evidence: "file missing"`.
- NO trailing prose. NO summary section. NO "I have completed the triage" notice.
- Quotes around any string containing colons (`:`) inside YAML values.
- The `overlaps` field uses slugs only (no `repos/<x>/.genie/wishes/` prefix).
- Cap `key_files_referenced` at 8 entries per wish.
- `files_verified` and `prs_verified` MUST be a subset of what's actually in REPO_INDEX.md / RECENT_PRS.md — do not invent.
