# Branch Protection — `main`

Branch protection rules are set on GitHub via the web UI; they cannot be
applied automatically from a commit. This document is the exact recipe.

**Apply after:** the CI workflow (`.github/workflows/ci.yml`) has run
green at least once on a real PR. Otherwise the required status checks
won't appear in the dropdown.

## 1. Open the settings page

GitHub → repo `beber88/Blueprint-ATS-` → **Settings** (top right) →
**Branches** (left sidebar) → **Add branch protection rule** /
**Add classic branch protection rule** (newer accounts may see the
"Rulesets" interface; rulesets handle the same fields, just nested
differently).

## 2. Branch name pattern

Field: `Branch name pattern` → `main`

## 3. Rule settings

Tick each of these. The numbers map to the screen sections you'll see.

### 3.1 Require a pull request before merging

- [x] Require a pull request before merging
  - [x] Require approvals → set to **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners
    (this enforces `.github/CODEOWNERS` — schema + ops-lib changes need
    owner approval)
  - [ ] Restrict who can dismiss pull request reviews (leave off for now)

### 3.2 Require status checks to pass before merging

- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks that are required:
    - `ci / Build, Lint, Test, Migrate-Sweep`
      _(this is the single `job.name` from `ci.yml`; if GitHub doesn't
      autocomplete it, push a commit so a CI run completes once, then
      come back here.)_

### 3.3 Require conversation resolution before merging

- [x] Require conversation resolution before merging

### 3.4 Restrict who can push to matching branches

- [x] Restrict who can push to matching branches
  - Add allowed actors: leave empty (everyone goes through PRs)

### 3.5 Apply to administrators

- [x] **Do not allow bypassing the above settings**
  (a.k.a. "Include administrators" in the older UI)

  Why: a 2am hotfix is exactly when discipline matters most. The CI gate
  exists to catch the thing you'd otherwise skip in panic. If you're the
  only admin and you need a break-glass merge, document it in the PR
  description and re-enable the rule the moment it's done.

### 3.6 Force pushes / deletions

- [ ] Allow force pushes — **off**
- [ ] Allow deletions — **off**

## 4. Save

Click **Create** (or **Save changes**).

## 5. Verify it took

Open any open PR → scroll to the merge box at the bottom. You should
see:

```
✓ Review required
   At least 1 approving review is required by reviewers with write access.
   Required by code owners.
✓ Status checks
   ci / Build, Lint, Test, Migrate-Sweep — Required
✓ Conversation resolution
   All conversations on code must be resolved before merge.
```

The "Merge pull request" button should be **disabled** until the
required CI check turns green.

## 6. When the workflow file is renamed

If you ever rename the job or split the workflow into multiple jobs,
the required-status-check name in branch protection breaks silently —
the rule keeps blocking on a check that no longer exists, so nothing
can merge. Recover:

1. Push the workflow rename + a no-op change → push triggers CI → CI
   runs the new job name once.
2. Settings → Branches → edit the protection rule → re-add the new job
   name from the dropdown → remove the stale one.

## 7. Hotfix break-glass procedure

If `main` is broken and CI is also broken (rare — last seen: never),
the documented break-glass:

1. Open a PR with the fix.
2. Settings → Branches → temporarily un-tick "Do not allow bypassing".
3. Merge with admin override.
4. **Immediately** re-tick "Do not allow bypassing".
5. In the PR description, add a section "Break-glass merge — reason:
   <…>" so future spelunkers see why the rule was bypassed.

If `main` is broken but CI is fine, just push a fix through CI normally
— that's what the gate is for.
