# Task Assignment: Financial & Domain Explorer

**Role**: Financial & Domain Explorer
**Working Directory**: c:\my-pos\V4\.agents\explorer_survey_domain_1
**Authoritative Request**: c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
**Comprehensive Review Document**: c:\my-pos\V4\comprehensive_app_review.md

## Mission
Investigate the codebase for Requirements 2 & 3: Financial Integrity, Workforce Schema, Customer Lifecycle, and Domain Logic.
Inspect:
1. Final balance collection accounting in tailor orders: Trace order completion / balance payment flow. Why are double-entry records missing from the general ledger, and where/how should they be inserted?
2. Cutter (المفصل) role: Check current roles in DB schema (`database.cjs`, migrations), user/employee management, and `tailor_order_garments` schema/frontend assignment UI.
3. Tailor payroll query mismatch: Trace the `SqliteError: no such column` caused by `rush_order` vs `is_urgent`, and IPC namespace mismatches for worker compensation.
4. Fabric inventory: Roll-level tracking and variable consumption instead of hardcoded 3.5m.
5. Customer phone search: 10-digit phone gate removal to support 9-digit local numbers.
6. Measurement schema: Hardcoded 8 fields vs bespoke tailoring parameters (suits, Thobes), and separating order-specific adjustments from customer master profiles.
7. QA/defect tracking: Review gaps and workflows for defect tracking before delivery.

Output a detailed technical report with exact file paths, line numbers, and architectural recommendations to `c:\my-pos\V4\.agents\explorer_survey_domain_1\handoff.md`.

## 2026-09-10T23:59:48Z
You are a teamwork_preview_explorer.
Your working directory is: c:\my-pos\V4\.agents\explorer_survey_domain_1
Your task assignment is in: c:\my-pos\V4\.agents\explorer_survey_domain_1\DISPATCH.md
You MUST read c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md and c:\my-pos\V4\comprehensive_app_review.md.

Explore the codebase for R2 (Financial & Workforce) and R3 (Customer Lifecycle & Domain Logic):
1. Financial integrity: Trace the final balance payment when completing a tailor order. Where does payment get recorded, why are general ledger double-entry records missing, and how to insert them?
2. Cutter role: Check schema in database.cjs/migrations and frontend UI. How to add Cutter role and allow assigning Cutter to garments in tailor_order_garments?
3. Tailor payroll: Locate the query with `rush_order` vs `is_urgent` and IPC namespace mismatches causing SqliteError: no such column.
4. Fabric roll-level inventory & variable consumption: Trace current inventory handling (hardcoded 3.5m) and design roll-level tracking & variable meters per garment.
5. Customer phone search: Locate the 10-digit validation gate in frontend/backend and show how to support 9-digit local numbers.
6. Measurement schema & profile isolation: Locate current 8 fields in DB/UI. Show how to expand for bespoke tailoring (suits, Thobe elements) and prevent order-specific adjustments from overwriting customer master baseline.
7. QA/defect tracking: Identify defect tracking gaps and design workflow.

Document exact file paths, line numbers, and proposed implementation details.
Write your full report to c:\my-pos\V4\.agents\explorer_survey_domain_1\handoff.md.
Update progress.md in your working directory.
When complete, send a message back to parent with summary and file path.
