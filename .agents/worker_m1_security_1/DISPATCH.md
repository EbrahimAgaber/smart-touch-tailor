# Task Assignment: Milestone 1 Worker (Security & ZATCA Fixes)

**Role**: Security & ZATCA Implementer
**Working Directory**: c:\my-pos\V4\.agents\worker_m1_security_1
**Authoritative Request**: c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
**Project Scope**: c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1\PROJECT.md
**Security Explorer Blueprint**: c:\my-pos\V4\.agents\explorer_survey_security_1\handoff.md

## Write Ownership
You exclusively own:
- `electron/database.cjs` (for PIN backdoor removal and PBKDF2 hashing)
- `electron/main.cjs` (for `tailor:readAttachment` path containment and RBAC)
- `src/hooks/useTailorPos.jsx` (for ZATCA Phase 2 compliant thermal receipt)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks
1. `electron/database.cjs`:
   - Remove lines 869–886 (unconditional boot reset of Admin PIN to '1234' and Cashier PIN to '0000').
   - Implement PBKDF2 salted password/PIN hashing with 100,000 iterations, unique 16-byte random salts, timing-safe verification, and seamless auto-migration of legacy static-salt SHA-256 hashes upon login.
2. `electron/main.cjs`:
   - Secure `tailor:readAttachment` by enforcing strict path canonicalization and containment within `path.resolve(app.getPath('userData'), 'attachments')`. Reject any path traversal attempt. Verify file existence and type, and return proper MIME type.
   - Implement session tracking and `_requireRole(['admin'])` / `_requireRole(['admin', 'manager'])` middleware guarding sensitive IPC handlers (`db:deleteStaff`, `settings:save`, `db:voidSale`, etc.). Pass active user ID to `addAuditLog`.
3. `src/hooks/useTailorPos.jsx`:
   - Update `saveOrder` / receipt generation to produce a fully compliant ZATCA Phase 2 thermal receipt (80mm):
     - Official title: "فاتورة ضريبية مبسطة"
     - Seller 15-digit Tax Identification Number (TIN)
     - Sequential Tax Invoice Number from `saveSale` (`finalTaxInvoiceNum`)
     - Real itemized bespoke garments instead of single generic line
     - Valid BER-TLV QR code fetched via `window.api.getZatcaTLV` and rendered via `window.api.generateQR`
     - Clean deposit, balance due, and expected delivery date display.
4. Run tests and build:
   - Run `npx vite build` to ensure frontend builds cleanly.
   - Run or create a programmatic test (e.g. Node test script) verifying PIN persistence, PBKDF2 hashing, and path containment.
   - Document all changes and verification commands in `c:\my-pos\V4\.agents\worker_m1_security_1\handoff.md`.

## 2026-09-11T00:12:23Z
You are a teamwork_preview_worker.
Your working directory is: c:\my-pos\V4\.agents\worker_m1_security_1
Your task assignment is in: c:\my-pos\V4\.agents\worker_m1_security_1\DISPATCH.md
You MUST read c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md, c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1\PROJECT.md, and the explorer report at c:\my-pos\V4\.agents\explorer_survey_security_1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Milestone 1 (Security & ZATCA Phase 2):
1. In electron/database.cjs: Remove lines 869-886 (boot PIN reset). Implement 100,000-iteration salted PBKDF2 hashing with random salt and transparent auto-migration of legacy hashes in verifyStaffPin.
2. In electron/main.cjs: Restrict tailor:readAttachment to path.resolve(app.getPath('userData'), 'attachments') with directory traversal protection. Add RBAC session management (_activeSession, _requireRole) to guard administrative IPC endpoints (db:deleteStaff, settings:save, db:voidSale, etc.) and attribute user_id in audit_logs.
3. In src/hooks/useTailorPos.jsx: Update tailor receipt to ZATCA Phase 2 format (simplified tax invoice header, seller VAT number, sequential tax invoice number, itemized bespoke garments, and BER-TLV QR code via window.api.getZatcaTLV and window.api.generateQR).
4. Run verification: run `npx vite build` and verify database and security checks. Write your handoff report to c:\my-pos\V4\.agents\worker_m1_security_1\handoff.md.
When finished, send a message to parent with your summary and handoff report path.
