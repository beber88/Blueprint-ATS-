# BACKLOG — Bundle size guard in CI

**Raised by:** cmd 8 (pre-launch CI gate).
**Priority:** low. Not blocking go-live.

## Problem

The CI gate today checks: lint, build, test+coverage, migration
idempotency. It does NOT check bundle size. A future PR could
inadvertently double the JS shipped to the client (heavy dep import in
a shared component, accidental server-side-only lib pulled into a
client bundle, etc.) and we wouldn't notice until users complain about
load time.

## Why deferred

Bundle-size guards work best with **baseline data**. We don't have
production usage numbers yet — setting a threshold pre-launch would
either:

- Be too tight: fail valid PRs that add legitimate functionality.
- Be too loose: never fail anything until the baseline has already
  drifted.

The right move is: launch → 2 weeks of stable production → measure
real First-Load JS per route → set thresholds at ~110% of that baseline
→ wire the check into CI.

## Implementation sketch (for the future)

1. Add `@next/bundle-analyzer` as a devDependency.
2. New CI step after `Build`: run `ANALYZE=true npm run build` and
   capture the per-route First-Load JS from the build output.
3. Compare against a checked-in `bundle-size-baseline.json` (similar
   to React's `bundlesize` workflow or Next.js's own bundle-analyzer
   action).
4. Fail CI if any route's First-Load JS grows more than 15 % vs
   baseline.
5. Update the baseline file as part of any PR that legitimately
   increases bundle size — diff is visible in code review.

## Acceptance criteria

- CI fails when a PR adds >15 % to any route's First-Load JS.
- Baseline file (`bundle-size-baseline.json`) is checked into the repo
  and only updated via explicit PR.
- `docs/development/ci-cd.md` documents how to override (when bundle
  growth is intentional).

## Effort estimate

~3 hours including baseline capture, CI integration, doc updates.
