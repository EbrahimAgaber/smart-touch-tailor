# Task Assignment: Security & ZATCA Explorer

**Role**: Security & ZATCA Explorer
**Working Directory**: c:\my-pos\V4\.agents\explorer_survey_security_1
**Authoritative Request**: c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
**Comprehensive Review Document**: c:\my-pos\V4\comprehensive_app_review.md

## Mission
Investigate the codebase for Requirement 1: ZATCA Compliance & Critical Security Fixes.
Inspect:
1. `database.cjs` and authentication logic: Where are PINs and passwords seeded, verified, and updated? How to eliminate hardcoded PIN resets (Admin '1234', Cashier '0000') and implement salted password hashing.
2. `ipcMain.handle('tailor:readAttachment', ...)`: Find the handler and identify all IPC handlers registered. Determine permitted attachment directories and how to implement path traversal protection.
3. Role-based access control (RBAC) on IPC endpoints: Check current IPC security / authentication checks in Electron main process.
4. Tailor POS thermal receipt: Inspect receipt generation, printing templates, ZATCA Phase 2 TLV QR code encoder, seller VAT number, real sequential invoice number, and headers.

Output a detailed technical report with exact file paths, line numbers, and architectural recommendations to `c:\my-pos\V4\.agents\explorer_survey_security_1\handoff.md`.

## 2026-09-11T00:00:00Z
You are a teamwork_preview_explorer.
Your working directory is: c:\my-pos\V4\.agents\explorer_survey_security_1
Your task assignment is in: c:\my-pos\V4\.agents\explorer_survey_security_1\DISPATCH.md
You MUST read c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md and c:\my-pos\V4\comprehensive_app_review.md.

Explore the codebase for R1: ZATCA Compliance & Critical Security Fixes:
1. database.cjs & auth logic: Investigate where PINs are reset (Admin 1234, Cashier 0000) and how password hashing is done (crypto/bcrypt/salt).
2. ipcMain.handle('tailor:readAttachment', ...): Locate the handler, inspect how file paths are handled, identify permitted directories, and specify path traversal protection. Also review IPC endpoints for role-based access control.
3. Tailor POS thermal receipt: Locate receipt generation/printing code, check ZATCA Phase 2 compliance (BER-TLV QR code generator, seller VAT number, real sequential invoice number, headers).

Document exact file paths, line numbers, and proposed code fixes.
Write your full report to c:\my-pos\V4\.agents\explorer_survey_security_1\handoff.md.
Update progress.md in your working directory.
When complete, send a message back to parent with summary and file path.

