# Orchestration Plan — Tailor POS Production Readiness

## Objective
Fully implement, harden, and verify all requirements specified in `ORIGINAL_REQUEST.md` (header 2026-09-11T02:57:52+03:00) and `comprehensive_app_review.md`.

## Phase 0: Survey & Scope Mapping
- Dispatch 3 parallel survey agents (Spec Miner for comprehensive requirement inventory, Explorer 1 for R1/Security/ZATCA, Explorer 2 for R2/Financial/Workforce/Inventory, Explorer 3/Spec Miner for R3/Customer/Measurements/QA).
- Synthesize findings into `PROJECT.md` with full Feature Inventory, file boundaries, and interface contracts.

## Phase 1: Milestone 1 (R1) — ZATCA Compliance & Critical Security Fixes
1. Remove hardcoded PIN reset in `database.cjs` (admin '1234', cashier '0000').
2. Salt and hash passwords properly.
3. Path traversal vulnerability fix in `ipcMain.handle('tailor:readAttachment', ...)`.
4. Role-based access control on sensitive IPC handlers.
5. ZATCA Phase 2 compliant thermal receipt (BER-TLV QR encoding, seller VAT number, real sequential invoice number, headers).
- Verification & Gate: Worker -> Reviewer -> Challenger -> Auditor -> Pass.

## Phase 2: Milestone 2 (R2) — Financial Integrity & Workforce Schema
1. Fix accounting black hole: insert double-entry ledger records for final balance collections upon order completion.
2. Add Cutter (المفصل) role to schema, employee management, and order garment assignment.
3. Fix tailor payroll query (`rush_order` vs `is_urgent`) and IPC namespace alignment to eliminate SqliteError.
4. Fabric roll-level inventory tracking and variable consumption (replacing hardcoded 3.5m).
- Verification & Gate: Worker -> Reviewer -> Challenger -> Auditor -> Pass.

## Phase 3: Milestone 3 (R3) — Customer Lifecycle & Domain Logic Refactoring
1. Allow 9-digit local phone number search without 10-digit block.
2. Expand measurement schema to support bespoke tailoring parameters (suits, Thobe-specific elements).
3. Isolate order-specific measurement adjustments from permanent customer baseline profiles.
4. Implement defect tracking / QA inspection workflow before delivery.
- Verification & Gate: Worker -> Reviewer -> Challenger -> Auditor -> Pass.

## Phase 4: Final Integration & E2E Verification
- Execute automated and programmatic test suite across all acceptance criteria.
- Reviewer + Challenger + Auditor sign-off.
- Final user report to parent agent.
