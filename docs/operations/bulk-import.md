# Bulk Import — Lifecycle & Recovery

Bulk import lets an operator paste months of historical daily reports at once.
The system splits them, sends each through Claude extraction, and stores the
structured items. This document covers the **operational contract**: how to
read the state of a job, how to cancel one, how to resume one, and what every
status means.

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/operations/bulk-import/preview` | Counts reports, estimates cost, checks for duplicate batches. Does **not** call Claude. Returns 422 if the report count exceeds `BULK_IMPORT_MAX_REPORTS`. |
| `POST` | `/api/operations/bulk-import` | Creates a job + per-report items, processes them with bounded concurrency, returns the final summary. Body: `{ text, defaultProjectId?, force? }`. |
| `GET` | `/api/operations/bulk-import/jobs/:id` | Returns the job row plus every item and a `{status → count}` map. |
| `POST` | `/api/operations/bulk-import/jobs/:id/cancel` | Marks the job `cancelled` and flips pending items to `cancelled`. Items mid-flight finish naturally. |
| `POST` | `/api/operations/bulk-import/jobs/:id/resume` | Recovery only. Marks items stuck in `processing` > 1 h as `failed` and re-queues if there's any `pending` work left. **Does not re-run extraction** — POST the original batch again with `force=true` to actually re-process. |

## Job statuses

| Status | Meaning |
| --- | --- |
| `queued` | Job created but worker hasn't started. Also the state after `resume` if there are still `pending` items. |
| `running` | Worker is actively processing items. |
| `done` | All items reached a terminal state (`done` or `failed`); no `pending` left and the job was not cancelled. |
| `failed` | All items ended in `failed` and none succeeded. |
| `cancelled` | An operator called the cancel endpoint. Some items may have completed before cancel landed. |

## Item statuses

| Status | Meaning |
| --- | --- |
| `pending` | Created with the job. Worker hasn't picked it up. |
| `processing` | Worker is actively sending the chunk to Claude. |
| `done` | Extraction succeeded; `output_report_id` points at the `op_reports` row. |
| `failed` | Extraction failed. See `error_message` for the cause. The chunk is **not** retried automatically. |
| `cancelled` | The job was cancelled before this item started. |

## Guards in front of every run

1. **Min length** — paste must be ≥ 100 chars or the request 400s.
2. **Header detection** — at least one `Date:` / `תאריך:` line; otherwise 400.
3. **Cap** — `BULK_IMPORT_MAX_REPORTS` (default **200**) per batch. Above this, the preview returns 422 with `capExceeded: true`. The UI disables the Run button. The run endpoint also enforces the cap server-side as a defense-in-depth check.
4. **Dedup** — sha256 of the normalized paste. If a `done` job with the same hash exists within `BULK_IMPORT_DEDUP_WINDOW_HOURS` (default 24), the preview shows a warning and the run endpoint returns 409 unless `force: true` is set in the body.
5. **Cost preview** — the UI shows estimated input + output tokens and USD cost (from `config/pricing.ts`). The Run button is disabled until the user clicks the "I understand" checkbox.

## Concurrency

`BULK_IMPORT_CONCURRENCY` (default **10**) caps the number of Claude calls in
flight at once via `p-limit`. With 200 reports and concurrency 10, expect
~20 sequential waves.

## Recovery procedures

### Worker died mid-flight

The worker is a Next.js route handler, which on Vercel can die at the 300s
function timeout. When that happens:

1. `GET /api/operations/bulk-import/jobs/:id` to inspect state.
2. If some items are stuck in `processing` for > 1 h:
   ```
   POST /api/operations/bulk-import/jobs/:id/resume
   ```
   That moves the stuck items to `failed` (so the human-readable count is
   accurate) and flips the job back to `queued` if there's still pending
   work.
3. To actually re-run, POST the original batch again with `force: true`:
   ```
   POST /api/operations/bulk-import  { text, force: true }
   ```

### Cancellation race

Cancellation flips the job status; the worker re-reads it before each item
and exits early. Items already in `processing` complete their Claude call
to avoid burning tokens twice. Expect 1-10 items to land between a cancel
click and the worker noticing.

### Cleaning up after a failed run

`op_bulk_import_jobs` and `op_bulk_import_items` are append-only from the
app. Delete a job manually only via a DBA migration. The `ON DELETE
CASCADE` on `items.job_id` ensures item rows go with the job. The reports
the job produced are linked via `output_report_id` with `ON DELETE SET
NULL` — they stand on their own and are NOT deleted when the job is.

## Environment variables

| var | default | purpose |
| --- | --- | --- |
| `BULK_IMPORT_MAX_REPORTS` | `200` | Hard cap on reports per batch. |
| `BULK_IMPORT_CONCURRENCY` | `10` | Max concurrent Claude calls. |
| `BULK_IMPORT_DEDUP_WINDOW_HOURS` | `24` | How far back to look for duplicate batches by hash. |
