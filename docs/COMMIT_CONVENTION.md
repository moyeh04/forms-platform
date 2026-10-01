# Git Commit Convention

This document defines the commit message style for this project, based on
[Conventional Commits](https://www.conventionalcommits.org/).

---

## Format

```
<type>(<scope>): <Subject>

<body>

<footer>
```

---

## Subject Line

```
type(scope): Subject with capital first letter
```

| Rule | Example |
|------|---------|
| Capitalize first word | `feat(auth): Add login validation` ✅ |
| Imperative mood | `Fix bug` ✅ not `Fixed bug` ❌ |
| No period at end | `Add feature` ✅ not `Add feature.` ❌ |
| Max 50 chars (standard target) | Keep the subject concise and scannable |
| Max 72 chars (hard limit) | Never exceed this boundary |

---

## Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, config, build) |
| `style` | Formatting, whitespace (no code change) |
| `perf` | Performance improvement |
| `solve` | Complete an exercise, assignment, or project task |
| `learn` | Add or update learning material (captures, notes, curricula) |
| `drill` | Practice exercises, katas, or repetition-based work |
| `audit` | Review, verify, or quality-check existing content |
| `build` | Build system or tooling changes (scripts, runners, Makefiles) |
| `init` | Initialize a new project, module, or repository |
| `deploy` | Deployment-related changes |
| `revert` | Revert a previous commit |
| `ci` | CI/CD pipeline changes |

> The very first commit of any repository is always:
> ```
> init(repo): Ready, Set... Go!
> ```

---

## Scope (Preferred)

The scope provides context about what part of the codebase is affected.

**Why use scope?**
- Instantly know which area changed without reading the body
- Makes `git log --oneline` scannable
- Helps when filtering commits (e.g., `git log --grep="(auth)"`)

**Examples:**
- `feat(auth):` - Authentication module
- `fix(api):` - API layer
- `refactor(users):` - Users module
- `docs(readme):` - README file

Use lowercase. Keep it short (one word preferred).

---

## Body

- Separate from subject with a blank line
- Wrap lines at **72 characters**
- Explain **what** changed and **why** (not how — the code shows how)
- Use bullet points with `-` for lists
- **Start with a 1–2 line summary** before any headers or bullets
- **End with an outcome line** — a closing sentence that states the
  end result or benefit of the change (what the user/system gains)
- Use `##` headers to organize when the commit touches multiple
  concerns (see [Body Sections](#body-sections-for-large-changes))
- Use `## Architecture` only when the commit makes a meaningful design
  decision. Name a pattern only when it accurately describes committed code.
- **No transient information** — describe the final staged state, not
  the iterative process that got there. Don't reference intermediate
  decisions, discarded approaches, or drafts that never made it into
  the repo history (exception: [The Debrief](#optional-the-debrief-war-story--postmortem-in-code),
  where the user explicitly shares the journey)

### Small Change (No Headers Needed)

When the commit is focused on a single concern, plain bullets or a
short paragraph after the summary line is enough:

```
feat(search): Implement case-insensitive search

Add a dedicated search column so users can query without worrying
about capitalization.

- Add indexed column for efficient case-insensitive queries
- Update search data layer to use dedicated search fields
- Preserve original capitalization for display

Users can now search for "my term" and find "My Term" entries
while the original capitalization is maintained in the UI.
```

---

## Body Sections (For Large Changes)

When a commit spans multiple concerns, use `##` markdown headers to
organize the body. **Every header must have bullet points under it.**

There are two kinds of headers — **thematic** (what the change
achieves) and **component** (where in the codebase it happened).
Mix and match freely; most large commits benefit from both.

### Available Headers

Pick the headers that fit your change:

| Header type | Header | Use when… |
|-------------|--------|-----------|
| Thematic | `## Key Features` | Listing user-facing capabilities added |
| Thematic | `## Architecture` | Explaining structural/design decisions |
| Thematic | `## Benefits` | Clarifying why this approach was chosen |
| Thematic | `## Deployment` / `## DevOps` | Infrastructure or pipeline changes |
| Thematic | `## Backward Compatibility` | Confirming what still works unchanged |
| Thematic | `## Migration Notes` | Steps others must take after pulling |
| Thematic | `## Trade-offs` | Acknowledging known limitations |
| Component | `## Service Layer` | Changes to business logic layer |
| Component | `## Repository Layer` | Changes to data access layer |
| Component | `## API Layer` | Changes to controllers or routes |
| Component | `## Config` / `## Build` | Build system or configuration changes |

These are suggestions — invent headers that fit the change. The goal
is **scannable structure**, not rigid categories.

### Example 1: New Feature

```
feat(config): Implement modular configuration system

Replace monolithic config file with module-based architecture,
enabling users to compose setups from independent modules that
can be mixed and matched.

## Key Features
- Module discovery via marker annotations in config files
- Interactive picker with checkbox selection
- CLI mode for non-interactive installs (--module-a --module-b)
- Smart config merging with conflict detection

## Config Layer
- Declarative module format with validation
- Conflict detection prevents ownership collisions
- Config generation validates all entries before writing

## Deployment Improvements
- Auto-detect artifact filenames from release API
- Fast-path for config-only updates (no binary download)
- Direct copy first, only elevates if permissions fail

## Backward Compatibility
All existing CLI commands unchanged. File handling and
deployment logic preserved.
```

### Example 2: Refactor

```
refactor(users): Modernize user module architecture

Split monolithic service into focused components with proper
type safety and consistent patterns.

## Architecture
- Separate business rules from data access
- Introduce typed DTOs for all request/response contracts

## Service Layer
- Extract validation into dedicated rules class
- Implement factory pattern for entity creation

## Repository Layer
- Replace raw queries with specification pattern
- Add custom query methods for search and filtering

## Backward Compatibility
- All existing API routes work unchanged
- No breaking changes to external interfaces
```

### Example 3: New Subsystem

```
feat(notifications): Add real-time notification system

Introduce a push-based notification pipeline so users receive
updates without polling.

## Key Features
- Subscribe to topics with granular filters
- Batch delivery for high-volume events
- Automatic retry with exponential backoff

## Service Layer
- Event dispatcher routes messages to correct handlers
- Deduplication prevents repeated deliveries

## API Layer
- WebSocket endpoint for live connections
- REST fallback for clients without WebSocket support

## Backward Compatibility
Existing REST polling endpoints remain functional.
Clients can migrate to WebSocket at their own pace.
```

### Optional: The Debrief (War Story / Postmortem in Code)

For commits where the fix was deceptively simple but the journey was
not — hours of debugging, misleading errors, or a one-line fix that
took forever to find. This style is **opt-in** (only use it when the
pain deserves to be documented).

The structure wraps the standard mixed headers inside `## The Fix`:

```
fix(network): Allow outbound DNS on port 53

After 6 hours of debugging silent packet drops, the fix was a
single firewall rule. Documenting this so no one repeats the
investigation.

## The Pain
- Containers could not resolve any external hostnames
- Logs showed no errors — requests just timed out silently
- Tested DNS config, resolver settings, and bridge networking
- Packet capture finally revealed outbound UDP/53 was blocked

## The Fix

### Network Layer
- Add ALLOW rule for outbound UDP/53 in firewall config

### Config
- Add explicit DNS egress entry to environment defaults

### Key Change
- One line. Six hours.

## Lesson Learned
Silent drops with no logging are the default for most firewalls.
Always check packet-level captures before chasing application
config.
```

> **When to use this:** Only when the commit tells a story worth
> preserving — a trap someone else could fall into, a non-obvious
> root cause, or a fix whose simplicity belies the effort.
> The committer decides when it applies.
>
> **AI note:** Never fabricate the Pain section. If the user opts
> into a postmortem, ask them to describe what happened and how it
> felt — then use their own words. The pain must be authentic.

### When to Use Headers

| Commit size | Structure |
|-------------|-----------|
| ≤ 5 bullet points, single concern | Plain bullets, no headers |
| 6+ bullets OR multiple concerns | `##` headers to organize |
| Touches multiple layers for one feature | Mix thematic + component |
| Painful debug or deceptively simple fix | Debrief (opt-in) |

## Footer

Reference issues or breaking changes. **Required** when your commit fixes, closes, or introduces a breaking change. Omit if none apply.

```
feat(api): Add user deletion endpoint

BREAKING CHANGE: Removed deprecated /users/remove endpoint

Fixes: #123
Closes: #456
```

---

## Quick Reference

```
50 chars target for subject --------------------->|
72 chars hard maximum for subject ------------------------------------->|
72 chars max for body ------------------------------------------------->|
```

### Good Examples

```
feat(auth): Add refresh token support

- Implement token refresh endpoint
- Add refresh token to login response
- Store refresh tokens with expiration

Users can now stay logged in without re-authenticating.
```

```
fix(leaderboard): Exclude admin users from results

Filter the leaderboard query to remove admin accounts, ensuring
rankings reflect regular users only.

Fixing this prevents inflated scores from skewing the leaderboard.

Fixes: #89
```

```
chore(deps): Bump web framework to 3.0.0
```

### Bad Examples

```
fixed the bug          # No type, not capitalized, vague
```

```
feat: added new feature.   # Past tense, period, vague
```

```
FEAT(AUTH): ADD LOGIN   # All caps
```

---

## Best Practices

### One Commit = One Concern

Each commit should do **one thing**. If you changed two unrelated things, make two commits.

| Situation | Split or Combine? |
|-----------|-------------------|
| Fixed a bug AND added a feature | **Split** — `fix` + `feat` |
| Changed config AND updated docs | **Split** — different scopes |
| Renamed a variable across 5 files | **Combine** — one logical refactor |
| Added a test AND the code it tests | **Combine** — they belong together |
| Fixed typo while working on a feature | **Split** — `style` + `feat` |
| Added a feature AND docs that describe it | **Combine** — docs are part of the deliverable, not a separate concern |

> **Code + its own docs = one concern.**
> The distinction is whether the docs *describe what you just built* (combine)
> or are a *separate documentation task* unrelated to the current code change
> (split). If reverting the code would make the docs wrong, they belong together.

### Plan the Commit Series

Before implementation begins, map the expected work into a provisional commit series.
Update the plan when the implementation reveals a better boundary. The plan must not
impose an arbitrary target such as "three commits" or compress a substantial branch
into a few catch-all snapshots.

Split work when each part is independently understandable, reviewable, testable, and
revertible. Different commit types usually deserve separate commits when they represent
different concerns, for example:

- `feat`: one coherent capability or behavior slice;
- `fix`: a defect correction discovered during feature work;
- `refactor`: structural change that preserves behavior;
- `build` or `ci`: build, test-runner, packaging, or pipeline infrastructure;
- `test`: independent coverage work not inseparable from one implementation slice;
- `docs`: documentation unrelated to the code being introduced; and
- `chore`: repository maintenance or generated-artifact policy.

Do not split mechanically by file, class, or commit type when the pieces cannot work or
be reverted independently. A feature implementation and the focused tests and docs that
define that same behavior normally belong together. Conversely, do not hide an
independent fix, refactor, build change, or repository cleanup inside a feature commit.

There is no preferred commit count. A branch may need two commits or twenty. Each commit
must represent one completed concern, and the author commits that concern after review
and proportionate verification instead of batching every change at the end.

Every substantive commit includes a useful body describing its final change, rationale,
important components, and outcome. Do not inflate a genuinely trivial commit merely to
make its message long.

### The Atomic Test

> "Could I revert this commit without breaking something unrelated?"

- If **YES** → good commit boundary
- If **NO** → you probably need to combine or reorganize

### Staging Specific Files

```sh
git add file1.py          # Stage one file
git commit -m "fix(auth): Handle expired tokens"

git add file2.py          # Stage another file separately
git commit -m "docs(readme): Update setup instructions"
```

Never `git add .` unless every changed file belongs to the same logical commit.

---

## Branching Strategy

### Branch Types

| Prefix | Purpose | Base | Merges into | Example |
|--------|---------|------|-------------|---------|
| `main` | Stable, production-ready | — | — | `main` |
| `feat/` | New features | `main` | `main` | `feat/auth-login` |
| `fix/` | Bug fixes | `main` | `main` | `fix/token-expiry` |
| `hotfix/` | Urgent production fixes | `main` | `main` | `hotfix/crash-on-start` |
| `refactor/` | Code restructuring | `main` | `main` | `refactor/user-module` |
| `build/` | Build system changes | `main` | `main` | `build/cmake-migration` |
| `test/` | Adding or updating tests | `main` | `main` | `test/auth-coverage` |
| `release/` | Release prep (optional) | `main` | `main` | `release/v1.0.0` |

### Direct Commits on `main`

These types are small enough to commit directly on `main` without a
branch:

| Type | Directly on `main`? | Reason |
|------|---------------------|--------|
| `chore` | ✅ Yes | Deps, config — low risk |
| `docs` | ✅ Yes | Documentation only — zero code risk |
| `style` | ✅ Yes | Formatting, whitespace — no logic change |
| `solve` | ✅ Yes | Completed task — no ongoing work to isolate |
| `learn` | ✅ Yes | Notes and material — no logic risk |
| `drill` | ✅ Yes | Practice exercises — no logic risk |
| `audit` | ✅ Yes | Review only — no code change |
| Everything else | ❌ No — use a branch | Code changes need isolation |

> If it touches logic, it gets a branch. No exceptions.

### Naming Rules

| Rule | Good | Bad |
|------|------|-----|
| All lowercase | `feat/user-search` | `feat/UserSearch` |
| Hyphens between words | `fix/null-pointer` | `fix/null_pointer` |
| Short (2–4 words after prefix) | `feat/csv-export` | `feat/add-the-new-csv-export-feature` |
| Descriptive, not just numbers | `fix/null-pointer-crash` | `fix/123` |
| Optional issue suffix | `feat/auth-login-42` | — |

### Branch Lifecycle

1. Create branch from `main`
2. Work in small, focused commits (one concern each)
3. When done, merge back into `main` with `--no-ff` (see next section)
4. Delete the branch after merge

### Protection

- **`main`**: No force pushes. No rewriting history. Ever.
- Direct commits only for `chore`, `docs`, `style`.
- All other work goes through a branch + merge `--no-ff`.

---

## Merge Policy

### Always `--no-ff`

Every branch merge **must** use `git merge --no-ff`:

```sh
git checkout main
git merge --no-ff feat/auth-login
```

**Why `--no-ff`?**

| With `--no-ff` | Without (fast-forward) |
|----------------|------------------------|
| Merge commit marks where a feature started and ended | Commits look like they were made directly on `main` |
| `git log --graph` shows clear branch structure | Flat history — no way to tell what belonged together |
| Revert one merge commit = undo entire feature | Must revert each commit individually |
| History tells the *story* of the project | History is a flat list |

### Pre-Merge History Audit

Before merging, review the complete branch rather than only its final tree:

```sh
git status --short
git log --reverse --format=fuller <target>..<branch>
git diff --check <target>...<branch>
```

Confirm that:

- each commit has one coherent concern and the correct type and scope;
- substantial commits have complete, wrapped bodies and outcome lines;
- independent feature, fix, refactor, build, test, docs, and chore work is not crammed
  into a catch-all commit;
- code, tests, and documentation that form one inseparable concern are not split merely
  to increase the commit count;
- no temporary, generated, research, user-owned, or unrelated file entered the branch;
  and
- the branch contains no unfinished staging state or accidental history rewrite.

### Merge Commit Message

Use this format for merge commits:

```
Merge <prefix>/<branch-name> into <target>

<1–2 sentence summary of what the branch accomplished>

<optional bullet list of key changes>
```

When a feature materially changes architecture, its merge commit summarizes the
significant patterns, value objects, and dependency boundaries that remain in the final
tree. It omits review conversations, abandoned approaches, and merge mechanics.

A multi-commit feature branch requires a comprehensive merge body. Summarize the final
capabilities, major components, verification evidence, compatibility, and operational
impact without repeating every child commit or narrating the development process.

**Example:**

```
Merge feat/auth-login into main

Implement JWT-based authentication with refresh token support.

- Add login and token refresh endpoints
- Store refresh tokens with expiration
- Add middleware for protected routes

Users can now authenticate and stay logged in.
```

### Make `--no-ff` the Default

```sh
# Per-branch
git config branch.main.mergeoptions "--no-ff"

# Or globally for all merges
git config --global merge.ff false
```

---

## Tagging Strategy

Tags bookmark specific commits. This project uses two kinds of tags for different purposes — both use annotated tags (`git tag -a`).

### Release Tags

For shipping versions. Follow [Semantic Versioning](https://semver.org/):

```
v<MAJOR>.<MINOR>.<PATCH>
```

- **MAJOR** (`v1.0.0` → `v2.0.0`): Breaking changes / incompatible API
- **MINOR** (`v1.0.0` → `v1.1.0`): New features, backward-compatible
- **PATCH** (`v1.0.0` → `v1.0.1`): Bug fixes, backward-compatible

**Creating a release tag:**

```sh
git tag -a v1.0.0 -m "Release v1.0.0"
```

For larger releases, write a release summary in a temp file and use `-F`:

```sh
git tag -a v1.1.0 -F /tmp/tag_msg.txt
```

### Personal Checkpoint Tags

For bookmarking a moment in history for yourself before risky work or submissions.

**Prefixes:**

- `checkpoint/`: Before refactors, risky experiments, or rewrites
- `submission/`: Before handing in work (assignments, milestone reviews)

**Examples:**

```sh
# Tag before a rewrite
git tag -a checkpoint/before-auth-rewrite -m "Working state before rewriting auth"

# Tag before submitting milestone 1
git tag -a submission/milestone-1 -m "Milestone 1 submission"
```

> [!WARNING]
> **Namespace Conflict Rule:**
> Git stores tags as files under `.git/refs/tags/`. If you create a tag
> named `checkpoint`, Git creates a file. If you then try to create
> `checkpoint/before-refactor`, it will fail because `checkpoint` cannot
> be both a file and a directory.
> **Never name a tag exactly "checkpoint" or "submission".** Always use
> the slash prefix (e.g. `checkpoint/name`).

---

### How to Use Checkpoint Tags

Bookmarking is only useful if you know how to use it when things go wrong:

#### 1. Inspecting a Checkpoint (Read-Only)
To check out the code at a checkpoint to run tests or inspect files:

```sh
git checkout checkpoint/before-auth-rewrite
```
*Note: This puts you in a "detached HEAD" state. Do not make new commits here.*
To return to your current work:
```sh
git checkout main
```

#### 2. Starting a New Path from a Checkpoint
If your rewrite failed and you want to start over from the checkpoint:

```sh
git checkout -b auth-rewrite-attempt-2 checkpoint/before-auth-rewrite
```

#### 3. Restoring a Single File from a Checkpoint
If you messed up just one file and want to revert it to the checkpoint state:

```sh
git restore --source=checkpoint/before-auth-rewrite path/to/file.cpp
```

---

### Lifecycle and Sharing Rules

| Tag Type | Push to Remote? | Deleting |
|----------|-----------------|----------|
| **Release** (`v*`) | **Always** (`git push origin <tag>`) | **Never delete** once pushed. |
| **Submission** (`submission/*`) | **Always** | **Never delete** (provides proof of deadline). |
| **Checkpoint** (`checkpoint/*`) | **No** (keep local to avoid clutter) | **Delete** when the refactor is successful. |

**To delete a temporary local checkpoint:**
```sh
git tag -d checkpoint/before-auth-rewrite
```

---

## Writing Big Commit Messages

### The Problem

Git does **not** wrap your commit message body automatically. If you
write a 200-character line, it stays 200 characters — and breaks in:

- `git log` (terminal overflow)
- GitHub/GitLab commit views (horizontal scroll)
- Code review tools (truncation)
- `git format-patch` / email workflows

**You are responsible for hard-wrapping at 72 characters.**

### The Solution: `git commit -F`

For any commit with a body, **write the message in a temp file first**,
then commit with `-F`:

```sh
# 1. Write your message in a temp file (wrap at 72 chars)
vim /tmp/commit_msg.txt

# 2. Commit using -F
git commit -F /tmp/commit_msg.txt
```

This gives you:

- Full editor control over line wrapping
- Time to structure headers and bullets properly
- Ability to review the message before committing
- No accidental 300-character `-m` strings

### When to Use Each Method

| Situation | Method | Example |
|-----------|--------|---------|
| Subject-only commit | `-m` is fine | `git commit -m "chore(deps): Bump Qt to 6.7"` |
| Commit with body | `-F` with a temp file | Write message → `git commit -F /tmp/msg.txt` |
| Large structured commit (headers, bullets) | `-F` always | Format `##` headers and bullets in the file |

### Template for the Temp File

```
type(scope): Subject line (50 target, 72 hard maximum)

1–2 sentence summary of the change.

## Section Header (if needed)
- Bullet point wrapped at 72 characters so it does
  not overflow in git log or GitHub views
- Another point

Outcome line — what the user or system gains.

Fixes: #123
```

### Visual Ruler

```
|--- Subject: 50 chars standard target ---------------------->|
|--- Subject: 72 chars hard maximum -------------------------------->|
|--- Body: 72 chars hard maximum ------------------------------------->|
```

> **Rule of thumb:** If the commit has more than a subject line,
> use `-F`. Never write a body with `-m`.

---

## Tooling

Consider using these tools to enforce the convention:

- [commitlint](https://commitlint.js.org/) - Lint commit messages
- [commitizen](https://commitizen-tools.github.io/commitizen/) - Interactive commit CLI
- [husky](https://typicode.github.io/husky/) - Git hooks for validation
