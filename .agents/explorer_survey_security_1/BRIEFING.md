# BRIEFING — 2026-09-11T00:15:00Z

## Mission
Investigate the codebase for Requirement 1: ZATCA Compliance & Critical Security Fixes (auth/PIN reset, IPC path traversal & RBAC, ZATCA Phase 2 thermal receipt).

## ?? My Identity
- Archetype: explorer
- Roles: Security & ZATCA Explorer
- Working directory: c:\my-pos\V4\.agents\explorer_survey_security_1
- Original parent: e0a85903-c492-48bb-8f0e-76d36ac557f5
- Milestone: Survey & Architectural Design

## ?? Key Constraints
- Read-only investigation — do NOT implement
- Explore R1: ZATCA Compliance & Critical Security Fixes
- Exact file paths, line numbers, and proposed code fixes in handoff.md

## Current Parent
- Conversation ID: e0a85903-c492-48bb-8f0e-76d36ac557f5
- Updated: 2026-09-11T00:15:00Z

## Investigation State
- **Explored paths**:
  - electron/database.cjs (Lines 30-32, 437-445, 856-886, 931-934, 1624-1830, 2662-2736, 2945-2947)
  - electron/main.cjs (Lines 336-343, 720-740, 766-788, 919-943, 956-976, 978-1010)
  - electron/preload.cjs (Lines 132, 166, 198-200, 386)
  - electron/zatca_utils.cjs (Lines 458-501)
  - src/hooks/useTailorPos.jsx (Lines 415-560)
  - src/pages/Pos.jsx (Lines 896-1050, 1400-1530)
  - src/pages/OrdersBoard.jsx (Lines 145-164, 660-678)
  - src/pages/Alterations.jsx (Lines 190-225, 300-330)
  - src/store/useAuthStore.js (Lines 1-93)
  - src/pages/Login.jsx (Lines 1-70)
- **Key findings**:
  1. Boot PIN backdoor confirmed in database.cjs:869-886. Must be removed.
  2. Static-salt SHA-256 in database.cjs:30-32. Must replace with random 16-byte salt + PBKDF2 (100k iterations) with backward compatibility.
  3. Arbitrary file read in main.cjs:782-788. Must restrict to path.join(app.getPath('userData'), 'attachments') with canonical traversal verification.
  4. Backend IPC authorization missing (main.cjs:336-343). Must implement _requireRole and link audit logging to active staff session.
  5. Tailor receipt in useTailorPos.jsx:481-548 is completely non-compliant (no QR code, no VAT number, wrong header, fake invoice number). Must refactor using window.api.getZatcaTLV and window.api.generateQR.
- **Unexplored areas**: None for R1. All critical aspects analyzed.

## Key Decisions Made
- Fully documented all file paths, exact line numbers, security flaws, and drop-in code fix designs.

## Artifact Index
- handoff.md — Final security & ZATCA analysis report
- progress.md — Liveness & task execution progress
