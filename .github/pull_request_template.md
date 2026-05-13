<!--
  PR template — keep PRs scoped and reviewable.
  Required sections: Checklist + Verification.
  Everything else scales with PR size.
-->

## What
<!-- One-line description: what does this PR change? -->

## Why
<!-- Motivation, linked issue if any. If this is a follow-up to a previous PR,
     link the commit / PR number. -->

## Checklist
- [ ] Migrations are idempotent (if any new migration added) — verified via `npm run ci:migrate-sweep`
- [ ] All tests pass locally — `npm run ci:test`
- [ ] Coverage on `lib/operations/*` not regressed (CI enforces 80% stmt / 80% line / 80% func / 70% branch)
- [ ] Docs updated if API or DB schema changed
- [ ] `.env.example` updated if a new env var was introduced
- [ ] No `console.log` left in committed code
- [ ] Backlog file (`docs/operations/backlog/BACKLOG_*.md`) added if work was deferred

## Verification
<!-- What did you run, what output did you see? Paste-able evidence — not "tested locally". -->

```
$ npm run ci:all
…paste tail of output here…
```

## Screenshots (if UI change)
<!-- For changes under app/ — paste a Before / After screenshot. -->

## Notes for reviewer
<!-- Anything specific you want the reviewer to focus on. Optional. -->
