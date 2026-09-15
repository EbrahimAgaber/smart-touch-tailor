# Dispatch Log

## 2026-09-11T02:58:51+03:00
You are the Project Orchestrator (teamwork_preview_orchestrator).
Working directory: c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1
Project root: c:\my-pos\V4

Mission:
Make the Smart Touch POS (my-pos/V4) tailor application production-ready by implementing and fixing all requirements identified in the latest user request and the comprehensive review report (c:\my-pos\V4\comprehensive_app_review.md).

Authoritative user request: c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-11T02:57:52+03:00)

Requirements to fulfill:
1. R1. ZATCA Compliance & Critical Security Fixes:
   - Remove hardcoded PIN reset in database.cjs
   - Properly salt and hash passwords
   - Restrict local file read vulnerability in ipcMain.handle('tailor:readAttachment', ...) to permitted directories only
   - Secure IPC endpoints with role-based access control
   - Update Tailor POS thermal receipt to fully comply with ZATCA Phase 2 (BER-TLV QR code, seller VAT number, correct headers, real invoice numbers)

2. R2. Financial Integrity & Workforce Schema:
   - Fix the 'accounting black hole' where final balance collections vanish from the general ledger (ensure double-entry records inserted)
   - Create the Cutter (المفصل) role in the database schema and POS UI; allow assigning specific Cutter in tailor_order_garments
   - Fix tailor payroll SQL queries (rush_order vs is_urgent column naming mismatch) and IPC namespace mismatches so worker compensation calculates correctly without SqliteError
   - Implement fabric roll-level inventory and variable consumption instead of hardcoded 3.5m

3. R3. Customer Lifecycle & Domain Logic Refactoring:
   - Remove rigid 10-digit phone search gate to allow 9-digit local numbers
   - Expand hardcoded 8-field measurement schema to accommodate actual bespoke tailoring parameters (suits, Thobe-specific elements)
   - Prevent order-specific measurement adjustments from destructively overwriting permanent customer master profiles
   - Implement missing QA/defect tracking workflows

Acceptance Criteria:
- Application launches without overwriting Admin PIN to '1234' or Cashier PIN to '0000'.
- Printing a Tailor POS receipt generates a compliant ZATCA Phase 2 format containing a valid BER-TLV QR code and seller VAT number.
- ipcMain.handle('tailor:readAttachment', ...) restricts file reads to permitted directories only.
- Completing a tailor order with a final balance payment correctly inserts double-entry records into the general ledger.
- Generating payroll for tailors executes without SqliteError: no such column exceptions.
- tailor_order_garments schema and frontend UI allow assigning a specific Cutter to a garment.
- Searching for a customer by a 9-digit phone number correctly queries database and returns matches.
- Modifying a garment's measurements for a single order does not permanently overwrite customer's baseline measurement profile.
