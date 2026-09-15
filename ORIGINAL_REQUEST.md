# Original User Request

## 2026-09-10T08:08:16+03:00

Redesign the 'Mulam' experience pipeline to eliminate inconsistencies, friction, and redundancy across all related pages (e.g., the alteration page). Produce a clean, connected UX/UI flow following `ui_ux_pro_max` architectural principles, and implement the frontend code changes.

Working directory: c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign
Integrity mode: demo

## Requirements

### R1. Pipeline Audit
Audit all pages related to the Mulam experience to identify UX gaps, friction points, and redundancies.

### R2. UI/UX Blueprinting
Produce high-fidelity UI mockups (Markdown layout tables, ASCII wireframes, typography scales) that establish a consistent, aesthetic pipeline across all Mulam pages, strictly adhering to the `ui_ux_pro_max` skill guidelines.

### R3. Frontend Implementation
Implement the unified UI/UX design into the frontend codebase to standardize the experience across all identified pages.

## Acceptance Criteria

### UX Audit & Design
- [ ] An audit document is produced that lists all identified Mulam pages, their current friction points, and redundancies.
- [ ] High-fidelity Markdown/ASCII wireframes are created for the new Mulam pipeline, demonstrating a consistent design system.

### Implementation & Verification
- [ ] The implemented frontend code successfully integrates the redesigned mockups.
- [ ] An independent agent acting as a judge reviews the implemented code against the mockups and confirms that the visual and structural consistency matches the new design system.

## 2026-09-10T22:41:44Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Conduct a comprehensive end-to-end review and evaluation of a tailor POS application (my-pos/V4) to determine production readiness. The evaluation must produce a detailed report identifying broken or missing features across the entire customer lifecycle (walk-in to collection) and business owner metrics (worker compensation, material waste, defect deductions), aiming to make the app a benchmark in its category.

Working directory: c:/my-pos/V4
Integrity mode: demo

## Requirements

### R1. Customer Lifecycle Evaluation
Evaluate the application's end-to-end pipeline for day-to-day use, starting from the moment a customer enters the shop to the moment they collect their order. Identify any gaps, missing features, or broken workflows in this pipeline.

### R2. Business Operations and Integrity Evaluation
Evaluate the application from the business owner's perspective, focusing on fraud prevention and accurate metrics tracking. Specifically assess how the app handles:
- Cutter pay rates and total compensation
- Tailor pay rates and total compensation
- Deductions due to defective items made by tailors
- Tracking of textile/material waste

### R3. Comprehensive Reporting
Produce a single, detailed Markdown report that covers all aspects mentioned above. The report must detail what is missing to make the app production-ready, what is implemented but broken, and provide actionable recommendations to elevate the app to a benchmark standard.

## Acceptance Criteria

### Report Completeness
- [ ] The report includes a dedicated section mapping out the customer lifecycle with at least 5 distinct stages evaluated (e.g., walk-in, measurement, tailoring, payment, collection).
- [ ] The report includes a dedicated section on business operations explicitly covering cutter pay, tailor pay, defect deductions, and textile waste tracking.

### Actionability
- [ ] For every broken or missing feature identified, the report cites specific files or components in the existing codebase as context.

### Delivery
- [ ] The final output is saved as a single Markdown file named `comprehensive_app_review.md` in the working directory.

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*

## 2026-09-11T02:57:52+03:00

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Use a very large team of agents

Make the Smart Touch POS (`my-pos/V4`) tailor application production-ready by fixing absolutely everything mentioned in the comprehensive app review report (`c:\my-pos\V4\comprehensive_app_review.md`) in one massive run.

Working directory: c:\my-pos\V4
Integrity mode: demo

## Requirements

### R1. ZATCA Compliance & Critical Security Fixes
Implement all required security patches: remove the hardcoded PIN reset in `database.cjs`, salt password hashes properly, restrict the local file read vulnerability, and secure the IPC endpoints with role-based access. Update the Tailor POS thermal receipt to fully comply with ZATCA Phase 2 (include TLV QR code, seller VAT number, correct headers, and real invoice numbers).

### R2. Financial Integrity & Workforce Schema
Fix the "accounting black hole" where final balance collections vanish from the general ledger. Create the Cutter (المفصل) role in the database schema and POS UI, and fix the tailor payroll SQL queries (`rush_order` vs `is_urgent`) and IPC namespace mismatches so worker compensation calculates correctly. Implement fabric roll-level inventory and variable consumption instead of the hardcoded 3.5m.

### R3. Customer Lifecycle & Domain Logic Refactoring
Remove the rigid 10-digit phone search gate to allow 9-digit local numbers. Expand the hardcoded 8-field measurement schema to accommodate actual bespoke tailoring parameters (suits, Thobe-specific elements) and prevent order-specific measurement adjustments from destructively overwriting permanent customer master profiles. Implement missing QA/defect tracking workflows.

## Acceptance Criteria

### Security & Compliance
- [ ] Application launches without overwriting Admin PIN to '1234' or Cashier PIN to '0000'.
- [ ] Printing a Tailor POS receipt generates a compliant ZATCA Phase 2 format containing a valid BER-TLV QR code and the seller's VAT number.
- [ ] `ipcMain.handle('tailor:readAttachment', ...)` restricts file reads to permitted directories only.

### Financials & Operations
- [ ] Completing a tailor order with a final balance payment correctly inserts double-entry records into the general ledger.
- [ ] Generating payroll for tailors executes without `SqliteError: no such column` exceptions.
- [ ] The `tailor_order_garments` schema and frontend UI allow assigning a specific Cutter to a garment.

### Domain Flow
- [ ] Searching for a customer by a 9-digit phone number correctly queries the database and returns matches.
- [ ] Modifying a garment's measurements for a single order does not permanently overwrite the customer's baseline measurement profile.

