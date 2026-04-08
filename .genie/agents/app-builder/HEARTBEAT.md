# HEARTBEAT.md — Khal OS PM

> **Shared rules (quiet hours, session exit, task discipline) in `~/.claude/rules/agent-bible.md`. Read it.**

Multiple specialized heartbeats. Each runs independently and exits early if nothing is actionable. Never combine purposes — run the heartbeat that matches the current wake reason.

---

## Monitoring Heartbeat

Purpose: catch production issues before users report them.

### 1. Sentry Check
- Run `sentry issue list` for the khal-os project (last 30 minutes).
- If new errors appear (not pre-existing/known):
  1. Triage severity: our code or upstream dependency?
  2. Create GitHub issue with: title, Sentry link, stack trace summary, affected route/service.
  3. Label `bug` + priority (`P0-critical` / `P1-high` / `P2-medium`).
  4. If P0: escalate via Telegram (Omni) immediately.

### 2. GitHub CI Status
- `gh run list --limit 5` — check recent workflow runs.
- Failing runs on `dev` or `master`: investigate, file issue if not already tracked.
- CI failures on dev block all releases.

### 3. PM2 Process Health
- `pm2 jlist` — verify `os-nats`, `os-services`, `os-ws-bridge` are `online`.
- If any process is `errored` or `stopped`: check `pm2 logs <name> --lines 20`, file issue, attempt restart.
- Repeated crashes (3+ in 10 minutes) → P0 escalation.

### 4. NATS Connectivity
- Verify NATS accepts connections on port 4222.
- Confirm JetStream is enabled and healthy.
- NATS down = all services dead → P0.

### 5. Exit
- All systems healthy and Sentry clean → exit silently.

---

## Triage Heartbeat

Purpose: keep the backlog clean and work flowing.

### 1. New Issues
- `gh issue list --state open --label "" --limit 20` — find unlabeled issues.
- For each: read, label (`bug`, `feature`, `chore`, `docs`), set priority, assign owner.

### 2. Blocked Issues
- `gh issue list --state open --label "blocked"` — check if any can be unblocked.
- Provide missing information, clarify requirements, or reassign where possible.
- Verify external blockers are still valid.

### 3. Stale Issues
- Identify `in_progress` issues with no activity in 48+ hours.
- Follow up with assignee or escalate.

### 4. Priority Check
- Verify top-5 issues are correctly prioritized.

### 5. Exit
- Backlog clean, nothing to triage → exit.

---

## Team Heartbeat

Purpose: monitor active genie teams and unblock workers.

### 1. List Active Teams
```bash
genie ls
genie status <slug>   # for each active team
```

### 2. Check for Blocks
- Read team-lead output if needed: `genie read <team-lead>`.
- If blocked: provide missing context, make scope decisions, or escalate to human.

### 3. Monitor PRs
- `gh pr list --state open` — check for PRs awaiting review.
- Ensure every PR has QA agent review in progress.
- PRs open > 48 hours without review → follow up.

### 4. Unblock
- Worker stuck → message team-lead with context.
- Team-lead stuck → intervene directly: clarify scope, adjust wish, or escalate.
- 15-minute rule: if you cannot unblock in 15 minutes, escalate to human.

### 5. Exit
- All teams progressing, no blockers, no stale PRs → exit.

---

## Release Heartbeat

Purpose: verify all gates before shipping.

### 1. CI Gate
- `gh run list --branch dev --limit 1` — latest CI must be green.
- Red → do not proceed. File issue or check if already tracked.

### 2. Sentry Gate
- Check for new Sentry errors since last release.
- New error → release blocked. Triage as P0/P1.

### 3. QA Gate
- Verify QA agent approved with evidence (screenshots, CLS scores, GIF recordings).
- No QA sign-off → release blocked.

### 4. Service Health Gate
- PM2 processes all online and stable (no recent crashes).
- NATS accepting connections, JetStream healthy.

### 5. Version Gate
- Verify version bumped and synced across all required files.
- Changelog updated with conventional commit entries.

### 6. Ship or Block
- **All gates pass:** Merge PR to dev. Update changelog. Tag version.
- **Any gate fails:** Document which gate failed, file issue, do not ship.

### 7. Post-Ship
- Verify dev deployment is healthy.
- Monitor Sentry for 15 minutes post-deploy.
- Send release notification via Telegram (Omni) if user-facing changes.

### 8. Exit
- Release shipped and stable, or blocked with documented reason.
