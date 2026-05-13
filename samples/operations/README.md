# Operations Intelligence — Sample Reports

This folder contains anonymized sample daily reports for testing the Operations
Intelligence module's Claude extraction pipeline.

## Usage

1. Apply migrations `002_operations_intelligence.sql` and `003_operations_seed_real_data.sql`.
2. Log into `/hr/operations/intake`.
3. For a single-report test: paste `sample_daily_report.txt` into the text area and click "Extract items".
4. For a bulk-import test: paste `sample_bulk_reports.txt` (multiple reports separated by `Date:` headers) into the Bulk Import tab and click "Import all".

## Calibration Notes

The Claude extraction prompt in `lib/claude/extract-report.ts` is calibrated to recognize Blueprint Building Group's
consolidated daily report structure:

1. HR (Human Resources)
2. Administration & Secretary
3. Architecture Department
4. Project Management & Site Updates
5. Procurement Department
6. Missing Information Tracker
7. CEO Action Items
8. Company Priorities for Tomorrow

When the user provides a new sample, refine the few-shot examples in `extract-report.ts` as needed.
