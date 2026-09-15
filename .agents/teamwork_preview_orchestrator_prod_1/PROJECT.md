# Project: Smart Touch POS (my-pos/V4) Tailor Production Readiness

## Architecture
- **Stack**: Electron (Node.js/Chromium) + React (Vite, TailwindCSS) + SQLite (`better-sqlite3`).
- **Process Boundaries**:
  - Main Process (`electron/main.cjs`, `electron/database.cjs`, `electron/hardware.cjs`): IPC handlers, SQLite database transactions, ZATCA Phase 2 cryptographic operations, local hardware drivers.
  - Preload (`electron/preload.cjs`): Context bridge exposing `window.api` and namespaces (`window.api.tailor`, `window.api.auth`, etc.).
  - Renderer Process (`src/`): React application (Tailor POS, Orders Kanban, Staff Management, Measurement Capture, Settings, Accounting).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Boot PIN Reset Backdoor Removal | Delete unconditional Admin/Cashier PIN reset on startup in `database.cjs:869–886` | M1 | Survey |
| 2 | Salted PBKDF2 Password/PIN Hashing | Replace weak static-salt SHA-256 with 100k iteration PBKDF2 + random salt + auto-migration | M1 | Survey |
| 3 | File Server Path Containment | Restrict `tailor:readAttachment` in `main.cjs` to `userData/attachments` with path canonicalization | M1 | Survey |
| 4 | Backend RBAC on IPC Endpoints | Add session tracking & `_requireRole` protecting sensitive IPC handlers (`db:deleteStaff`, `settings:save`) | M1 | Survey |
| 5 | ZATCA Phase 2 Tailor Thermal Receipt | Render "فاتورة ضريبية مبسطة", seller 15-digit TIN, sequential invoice, BER-TLV QR in `useTailorPos.jsx` | M1 | Survey |
| 6 | Balance Pickup Double-Entry Ledger | Post Dr 1111/1112 and Cr 1200 in `completeTailorOrder` on final balance collection | M2 | Survey |
| 7 | Cutter Role Schema & Assignment | Add `assigned_cutter_id` to `tailor_order_garments`, `cutter_piece_rate` to `staff`, POS & OrdersBoard UI | M2 | Survey |
| 8 | Tailor Payroll SQL Column Fix | Replace `o.rush_order` with `o.is_urgent` in `database.cjs:3843` | M2 | Survey |
| 9 | Payroll Preload & UI Namespace Alignment | Expose `getPayroll` and `getCutterPayroll` on `window.api` & `window.api.tailor`; fix `Staff.jsx:60` | M2 | Survey |
| 10 | Fabric Roll-Level Inventory | Add `fabric_rolls` table (`roll_code`, `dye_lot`, `roll_width_inches`, `initial_meters`, `remaining_meters`) | M2 | Survey |
| 11 | Dynamic Fabric Consumption | Replace hardcoded 3.5m with formula based on garment type and measurements | M2 | Survey |
| 12 | Customer Phone Search 9-Digit Support | Relax 10-digit gate in `useTailorPos.jsx` and sanitize phone query in `database.cjs:getCustomers` | M3 | Survey |
| 13 | Bespoke Measurement Schema Expansion | Add fields for Thobes (bottom flare, khaban, jabzor, collar) and suits in `MeasurementCapture.jsx` | M3 | Survey |
| 14 | Baseline Measurement Profile Isolation | Add temporary adjustment toggle; store in `garments.measurements_json` without overwriting profile | M3 | Survey |
| 15 | QC Stage & Defect Tracking Workflow | Add `tailor_defects` table, QC stage on `OrdersBoard`, defect modal, and payroll penalty deductions | M3 | Survey |
| 16 | Alteration Ticket Order Linking | Include `linked_order_id` in SQL INSERT in `createAlterationTicket` | M3 | Survey |
| 17 | Final Verification & Integration Audit | Execute comprehensive programmatic test suite across all acceptance criteria | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: ZATCA Compliance & Security Fixes | Boot PIN reset, PBKDF2 hashing, file read containment, backend RBAC, ZATCA thermal receipt | none | IN_PROGRESS |
| 2 | M2: Financial Integrity & Workforce Schema | Double-entry balance collection, Cutter role, payroll SQL fix & namespaces, fabric roll inventory | M1 | PLANNED |
| 3 | M3: Customer Lifecycle & Domain Logic | 9-digit phone search, bespoke measurement expansion, profile isolation, QC defect tracking | M2 | PLANNED |
| 4 | M4: Final Integration & E2E Validation | Programmatic validation of all 8 acceptance criteria, review, challenge, forensic audit | M1, M2, M3 | PLANNED |

## Code Layout & Write Boundaries
- `electron/database.cjs`: SQLite schemas, migrations, auth hashing, tailor orders, payroll queries, ledger entries.
- `electron/main.cjs`: Electron IPC handlers, RBAC gating, attachment file server.
- `electron/preload.cjs`: IPC context bridge exposing APIs to renderer.
- `src/hooks/useTailorPos.jsx`: Tailor POS business logic, phone search, garment checkout, thermal receipt generator.
- `src/pages/TailorPos.jsx`: Tailor POS UI, customer selection, worker selectors (Tailor & Cutter), measurement input.
- `src/pages/OrdersBoard.jsx`: Kanban workshop board, garment assignment, QC stage, pickup modal.
- `src/pages/Staff.jsx`: Staff management, payroll calculation UI for Tailors & Cutters.
- `src/pages/MeasurementCapture.jsx`: Bespoke measurement grid for Thobes, Suits, Sirwals.
- `src/pages/Alterations.jsx`: Alteration tickets and order linking.
