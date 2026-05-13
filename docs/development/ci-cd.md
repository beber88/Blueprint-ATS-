# CI / CD — Pre-Launch Quality Gate

This is the contract that every PR to `main` (and every push to `main`)
must satisfy. The workflow lives at `.github/workflows/ci.yml`.

## What it runs

In order, all in a single job (`ci / Build, Lint, Test, Migrate-Sweep`)
on `ubuntu-latest` with a `postgres:16` service container:

1. **Checkout** — `actions/checkout@v4`.
2. **Setup Node 20** — with npm cache.
3. **`npm ci`** — clean, lockfile-honest install.
4. **Wait for Postgres** — `pg_isready` loop, max 30 s.
5. **`npm run lint`** — `next lint`. Warnings are allowed; errors fail
   the job. The current baseline has only `react-hooks/exhaustive-deps`
   warnings in unrelated pages.
6. **`npm run build`** — `next build`. Must compile clean.
7. **`npm run ci:test`** — `jest --coverage --ci` with default + JUnit
   reporters. **Hard-fails** if any file in `lib/operations/*` drops
   below:
   - 80 % statements
   - 80 % lines
   - 80 % functions
   - 70 % branches (set lower than the others; warning-path branches
     drift more easily on small PRs and we don't want to flag false
     alarms)
8. **`npm run ci:migrate-sweep`** — runs `scripts/a1-migration-sweep.js`
   against the postgres service. **Hard-fails** on:
   - exit 2: any of `001..007` broke on initial apply
   - exit 3: row counts drifted after re-running `003..007` (silent
     non-idempotency)
   - exit 4: any of `003..007` broke when re-applied (loud
     non-idempotency)
   - the documented `001 + 002` re-run failures are logged but do not
     fail the job — they're known, see
     `docs/operations/production-readiness.md` §4.2.
9. **`npm audit --audit-level=high || true`** — visible in logs, does
   NOT fail the job. Remove the `|| true` once we've worked through the
   current advisories.
10. **Upload artifacts** — `coverage/` and `junit.xml`, retained 14
    days. Open a failed run → Artifacts dropdown → download to see what
    fell over.

Total typical runtime: ~3–4 minutes for a clean run.
Job timeout: 15 minutes.

## What it does NOT run

- **No `ANTHROPIC_API_KEY`** is exposed to CI. Real Claude calls cost
  money and would block PR throughput. The `extract-report.ts` logic is
  unit-tested with fixtures; live API smoke tests are a production
  concern.
- **No real `SUPABASE_*` secrets**. Postgres is the throwaway service
  container — its `TEST_DATABASE_URL` is hard-coded in `ci.yml`. No
  cross-contamination with prod.
- **No UI / browser tests**. UI walkthroughs are the owner's manual
  responsibility — see `docs/operations/production-readiness.md` §2
  step 8.
- **No bundle-size guard**. Deferred — see
  `docs/operations/backlog/BACKLOG_bundle_size_guard.md`.

## Local debugging — reproduce CI on your machine

```bash
# Spin up a local postgres if you don't have one:
docker run --rm -d --name pg-ci -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=test -p 5432:5432 postgres:16

# Then mirror what CI does:
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test \
  npm run ci:all
```

`ci:all` = `ci:install && ci:lint && ci:build && ci:test &&
ci:migrate-sweep`. Each step is also a standalone script if you want to
narrow in:

```bash
npm run ci:lint            # just lint
npm run ci:test            # just tests + coverage gate
npm run ci:migrate-sweep   # just the schema idempotency check
```

## Debugging a CI failure

The most common failure modes and where to look first:

| Symptom | Where to look | Usually means |
|---|---|---|
| "Postgres failed to come up within 30s" | Wait-for-Postgres step logs | Service container fails to boot — re-run the workflow. Persistent: image tag bumped + breaking change. |
| Lint job fails | "Lint" step | Either a real error (fix it) or an `@next/next` rule change. Check `.eslintrc.json`. |
| Build fails on missing types | "Build" step | Usually `npm ci` got a different version than was lock-pinned. Bump `package-lock.json`. |
| Coverage gate fails on `lib/operations/*` | Tail of "Test" step → "Jest: Uncovered…" line | Coverage on a single file dropped. Either add a test or `/* istanbul ignore */` with a comment justifying it (rare — almost always means "add a test"). |
| Migrate-sweep exits 3 (drift) | "Migration sweep" step | A migration that was idempotent now isn't. Inspect the row-count table in the log; the table that drifted is the culprit. |
| Migrate-sweep exits 4 (re-run failed) | "Migration sweep" step | A `CREATE TABLE` / `CREATE POLICY` lost its `IF NOT EXISTS` / `DO $$ EXCEPTION` guard. |

## Updating CI itself

Changes to `.github/workflows/ci.yml` require code-owner approval
(see `.github/CODEOWNERS`). When making changes:

1. Test on a feature branch first — the workflow file applies from the
   branch's HEAD for PR events.
2. **Never** add `continue-on-error: true` to the test, build, or
   migrate-sweep steps without a documented reason in the commit.
3. If you add a new step, decide upfront whether it should be hard-fail
   or non-blocking. `npm audit` is the only non-blocking step today;
   that's the pattern to follow.

## How this fits with branch protection

CI alone is advisory unless GitHub branch protection requires it. See
`docs/development/branch-protection.md` for the manual setup — it's a
one-time owner action that must happen after the first green CI run.
