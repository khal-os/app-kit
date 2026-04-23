# Custom REPL tools — live codebase access via rtk (Rust Token Killer)

These tools give the REPL fresh codebase + git + GitHub data on demand.
Every tool wraps `rtk <cmd>` so the output stays compact (70-99% token reduction).
Use these instead of relying on stale snapshot files.

`rtk` lives at `/home/genie/.local/bin/rtk` — `_run` extends PATH automatically.

## _run

```python
import subprocess, os
def _run(args, timeout=20, cwd=None):
    """Internal: run a command with PATH including rtk, return (stdout, returncode)."""
    env = {**os.environ, "PATH": os.environ.get("PATH", "") + ":/home/genie/.local/bin"}
    try:
        r = subprocess.run(args, capture_output=True, text=True, env=env, timeout=timeout, cwd=cwd)
        return (r.stdout if r.returncode == 0 else f"[err:{r.returncode}] {r.stderr[:500]}", r.returncode)
    except subprocess.TimeoutExpired:
        return (f"[timeout {timeout}s] {' '.join(args)}", -1)
    except Exception as e:
        return (f"[exc:{type(e).__name__}] {e}", -1)
```

## file_exists

```python
def file_exists(pattern, type_filter="f"):
    """Return list of files matching <pattern> in the repo. <pattern> is a glob like 'src/lib/*.ts'.

    Use to verify a wish references real files. Empty list = file doesn't exist (potential references-deleted-code).
    Cheap — runs `rtk find -name <pattern>` (compact output)."""
    out, rc = _run(["rtk", "find", ".", "-name", pattern, "-type", type_filter, "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*", "-not", "-path", "*/dist/*"])
    if rc != 0:
        return out
    return [line.strip() for line in out.strip().split("
") if line.strip()]
```

## git_log

```python
def git_log(path=None, n=10):
    """Show last <n> commits, optionally filtered to commits touching <path>.

    Use to verify when a wish's claimed work was last touched in the repo."""
    args = ["rtk", "git", "log", "--oneline", f"-{n}"]
    if path:
        args += ["--", path]
    out, _ = _run(args)
    return out
```

## pr_search

```python
def pr_search(query="", state="merged", limit=20):
    """Search merged (default) or open PRs. Fresh from `gh pr list` via rtk.

    Use to verify a wish's `Status: SHIPPED via PR #X` claim — search by title/branch."""
    args = ["rtk", "gh", "pr", "list", "--state", state, "--limit", str(limit)]
    if query:
        args += ["--search", query]
    out, _ = _run(args, timeout=30)
    return out
```

## pr_view

```python
def pr_view(number):
    """Get PR details by number. Use when you need to verify what a specific PR actually changed."""
    out, _ = _run(["rtk", "gh", "pr", "view", str(number)], timeout=20)
    return out
```

## code_search

```python
def code_search(pattern, glob=None):
    """ripgrep <pattern> in the repo source. <glob> like '*.ts' to scope by extension.

    Use to verify whether a symbol/function/import mentioned in a wish actually exists in code."""
    args = ["rtk", "grep", "-r", "-n", pattern, "."]
    if glob:
        args += ["--glob", glob]
    out, _ = _run(args, timeout=30)
    return out[:5000]  # cap big results
```

## read_source

```python
def read_source(path, level="standard"):
    """Read a source file with rtk's intelligent filtering. level=standard|aggressive (signatures only).

    Use sparingly — only when wish triage truly needs to see the implementation, not just verify existence."""
    out, _ = _run(["rtk", "read", path, "-l", level], timeout=15)
    return out[:8000]
```

## repo_tree

```python
def repo_tree(path=".", depth=2):
    """Compact directory tree. Use to understand repo structure when judging a wish's scope."""
    out, _ = _run(["rtk", "tree", path, "-L", str(depth)], timeout=15)
    return out
```

## current_branch

```python
def current_branch():
    """Return the current git branch. Use to detect if a wish matches the in-flight branch."""
    out, _ = _run(["git", "branch", "--show-current"], timeout=5)
    return out.strip()
```

## recent_pr_titles

```python
def recent_pr_titles(limit=50):
    """Quick scan of last <limit> merged PR titles. Cheap broad sweep.

    Use as a first pass before pr_search() — if no title sounds related, skip the deeper search."""
    out, _ = _run(["rtk", "gh", "pr", "list", "--state", "merged", "--limit", str(limit), "--json", "number,title,mergedAt"], timeout=30)
    return out
```
