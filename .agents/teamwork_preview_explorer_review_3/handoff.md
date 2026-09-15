# TECHNICAL ARCHITECTURE & CODE QUALITY AUDIT (R3)
**Target System:** `smart-touch-pos` (my-pos/V4)  
**Auditor Agent:** `teamwork_preview_explorer_review_3`  
**Date of Audit:** 2026-09-11  
**Working Directory:** `c:\my-pos\V4`  

---

## 1. OBSERVATION

### 1.1 Tech Stack & Project Architecture
* **Frontend Framework & Bundler:**
  * React v18.2.0 (`package.json:95`) running as a Single Page Application (SPA) with HashRouter (`react-router-dom: ^6.22.3`, `src/App.jsx:2, 317`).
  * Bundler: Vite v4.4.5 (`@vitejs/plugin-react: ^4.0.3`, `package.json:109, 123`).
  * Build Verification Command: `npx vite build` executed successfully in 32.67s, producing:
    * `dist/index.html` (2.91 kB)
    * `dist/assets/index-7ae8e1eb.css` (125.53 kB)
    * `dist/assets/index-c7dc42c9.js` (1,891.43 kB minified monolithic bundle, no code splitting).
  * Build Warnings:
    * Minification warning: `▲ [WARNING] "window" is not a known CSS property [unsupported-css-property] ... .\[window\:openPos\]{window:openPos}` in styles.
    * Dynamic/static collision: `qrcode` dynamically imported by `src/utils/LabelPrintEngine.js` but statically imported by `src/pages/Tables.jsx` and `src/utils/qr-gen.js`.
  * Styling & UI Components: Tailwind CSS v4.2.4 (`@tailwindcss/postcss`, `postcss: ^8.5.12`, `autoprefixer: ^10.5.0`), Lucide React v0.383.0 (`package.json:89`), Recharts v3.8.1 (`package.json:99`).
  * Internationalization: `i18next: ^26.3.1` and `react-i18next: ^17.0.8` (`src/i18n.js`).
  * State Management: Zustand v4.5.2 (`src/store/useAuthStore.js`, `src/store/useCartStore.js`, `src/store/useLicenseStore.js`, `src/store/useSubscriptionStore.js`) combined with React Context (`SettingsCtx` in `src/App.jsx:68`).

* **Backend & Desktop Architecture:**
  * Desktop Container: Electron v22.3.27 (`package.json:113`), packaging via `electron-builder: ^26.8.1` targeting Windows NSIS (x64/ia32).
  * Main Process: `electron/main.cjs` (1,840 lines, 108 KB) CommonJS architecture.
  * Preload Bridge: `electron/preload.cjs` (394 lines, 27.5 KB) exposing `contextBridge.exposeInMainWorld('api', {...})`.
  * Embedded Express Servers:
    1. `electron/menuServer.cjs` (port 3000): Express v5.2.1 web server serving customer digital QR menu (`dist/`) and exposing `/api/web-order` endpoints with optional `localtunnel: ^2.0.2` external tunnel.
    2. `electron/syncEngine.cjs` (port 8080): Express v5.2.1 server handling CRDT peer-to-peer synchronization across local POS terminals.
  * Local AI / NLP Engine: `node-nlp: ^5.0.0-alpha.5` trained locally (`electron/local_ai.cjs`, `electron/assistant-executor.cjs`, `electron/model.nlp`).
  * ZATCA Phase 2 Cryptographic Integration: Pure JavaScript cryptographic pipeline in `electron/zatca_phase2_impl.cjs` and `electron/zatca_reporter.cjs` utilizing `node-forge`, `elliptic`, `@xmldom/xmldom`, and `xml-crypto`.

* **Database & ORM Architecture:**
  * Database Engine: SQLite via `better-sqlite3: ^9.6.0` (`electron/database.cjs:217`).
  * Web / In-Memory Fallback: `sql.js: ^1.14.1` (`src/mockApi.js`, `tests/simulation_test.cjs`).
  * ORM: None. Direct SQLite database queries using `better-sqlite3` prepared statements (`db.prepare(...)`).
  * Database Location & Configuration: `pos_data.db` stored in `userData` directory (or workspace root), configured with `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = FULL`, `PRAGMA foreign_keys = ON` (`electron/database.cjs:218-220`).
  * Migration Strategy: No formal migration framework (no Prisma, TypeORM, Knex, or Umzug). Migrations run imperatively inside `initDatabase()` on every application boot via `safe(ALTER TABLE ... ADD COLUMN ...)` (`electron/database.cjs:800-847`), silently swallowing errors.

---

### 1.2 Application Inventory (Modules, Routes, Pages, Components)

* **Active Routes & Pages (mapped in `src/App.jsx:318-369`):**
  1. `/login` (`src/pages/Login.jsx`): Touchscreen 4-digit PIN authentication pad for cashiers and managers.
  2. `/onboarding` (`src/pages/Onboarding.jsx`): First-boot business setup wizard (store name, VAT number, commercial registration).
  3. `/customer-display` (`src/pages/CustomerDisplay.jsx`): Secondary customer-facing monitor view displaying real-time cart items, VAT, and totals.
  4. `/shift` (`src/pages/Shift.jsx`): Cash drawer shift opening float, closing reconciliation, cash/card variances.
  5. `/home` (`src/pages/Home.jsx`): Operations dashboard with quick navigation and daily summary stats.
  6. `/pos` (`src/pages/Pos.jsx`): Core retail/restaurant touch POS with category sidebar, product grid, cart panel, held orders, split payments.
  7. `/tailor-pos` (`src/pages/TailorPos.jsx`): Mulam bespoke tailor POS with fabric selection, measurement profiles, delivery scheduling, deposit handling.
  8. `/alterations` (`src/pages/Alterations.jsx`): Mulam alteration ticket creation and Kanban workflow with thermal receipt printing.
  9. `/orders-board` (`src/pages/OrdersBoard.jsx`): Workshop Kanban tracking 5 production stages (`cutting`, `stitching`, `finishing`, `ironing`, `ready`) with batch stage advance and order completion.
  10. `/measurements` (`src/pages/MeasurementCapture.jsx`): Customer measurement profile management with inch/cm unit conversion and profile history.
  11. `/customer-menu` (`src/pages/CustomerMenu.jsx`): Digital QR mobile menu for dine-in / table self-ordering.
  12. `/dashboard` (`src/pages/Dashboard.jsx`): Owner executive dashboard with sales trends, profit margins, KPI cards, and Recharts graphs.
  13. `/settings` (`src/pages/Settings.jsx`): System settings, VAT configuration, thermal printers, database backup/restore, ZATCA Phase 2 onboarding.
  14. `/expenditures` (`src/pages/Expenditures.jsx`): Operating expense logging, supplier invoices, tax invoice attachments, VAT input deductions.
  15. `/stock` (`src/pages/Stock.jsx`): Inventory management, low-stock reorder thresholds, physical stock adjustments.
  16. `/menu-admin` (`src/pages/MenuAdmin.jsx`): Product catalog CRUD, item variants/modifiers, category ordering, CSV product import.
  17. `/finance-hub` (`src/pages/FinanceHub.jsx`): Phase 1 accounting: Chart of Accounts, Journal Entries, General Ledger, Trial Balance, Income Statement, Balance Sheet, Cash Flow.
  18. `/finance-hub-p2` (`src/pages/FinanceHubP2.jsx`): Phase 2 & 3 accounting: Accounts Receivable Aging, Fixed Assets & Depreciation, Bank Reconciliation, VAT Return (Box 1-16), Payroll processing.
  19. `/sales-history` (`src/pages/SalesHistory.jsx`): Transaction journal, simplified tax invoices, returns/refunds, receipt reprinting.
  20. `/customers` (`src/pages/Customers.jsx`): CRM, loyalty points balance, purchase history, customer merging tool.
  21. `/suppliers` (`src/pages/Suppliers.jsx`): Supplier directory, contact information, ledger accounts, payment logging.
  22. `/purchases` (`src/pages/Purchases.jsx`): Purchase Orders (PO), goods receipt, vendor bill matching, debit notes, partial returns.
  23. `/staff` (`src/pages/Staff.jsx`): Employee directory, role permissions (Admin, Cashier, Tailor, Cutter), PIN modification.
  24. `/audit-logs` (`src/pages/AuditLogs.jsx`): Immutable system event logs, security actions, price overrides, void audits.
  25. `/promotions` (`src/pages/Promotions.jsx`): Discount rules, promotional campaigns, promo codes.
  26. `/services` (`src/pages/Services.jsx`): Repair/maintenance service tracking.
  27. `/sponsors` (`src/pages/Sponsors.jsx`): Corporate customer sponsor accounts.
  28. `/tables` (`src/pages/Tables.jsx`): Restaurant table management and floor plan designer.
  29. `/kds` (`src/pages/KDS.jsx`): Kitchen Display System order queue for restaurant kitchens.
  30. `/subscription-hub` (`src/pages/SubscriptionHub.jsx`): Tier licensing, addon modules, expiration warnings.

* **Embedded Sub-tabs in `FinanceHubP2.jsx`:**
  31. `src/pages/BreakEvenTab.jsx`: P-021 Break-Even Analysis with SVG chart (imported line 23).
  32. `src/pages/DeferredRevenueTab.jsx`: P-014 Deferred Revenue Scheduler (imported line 22).
  33. `src/pages/InventoryCostingTab.jsx`: P-018 Inventory Costing Viewer (imported line 25).
  34. `src/pages/GLDrillDown.jsx`: P-003 General Ledger Drill-Down (imported line 21).
  35. `src/pages/VATSettings.jsx`: P-013 VAT Category per product (imported line 24).

* **Orphaned / Dead Files in `src/`:**
  36. `src/pages/LiveOrders.jsx` (17,054 bytes): Orphaned page component. Not imported in `src/App.jsx` and has no active route.
  37. `src/pages/SaudiComplianceTab.jsx` (44,972 bytes): Orphaned page component. Contains EOSB, WPS, and closing wizard UI, but is not imported anywhere in `src/`.
  38. `src/components/Layout/AppLayout.jsx` (33,221 bytes): Orphaned duplicate layout. All pages import `src/components/AppLayout.jsx` (30,168 bytes); this file is never imported.
  39. `src/pages/Settings.jsx.bak-preonboardbtn` (90,142 bytes): Dead backup file left in source directory.
  40. `src/pages/TailorPos.jsx.bak` (47,279 bytes): Dead backup file left in source directory.
  41. `src/components/invoice/`: Empty directory.

---

### 1.3 Code Health, Broken IPC Endpoints & Mocks

* **Broken & Unregistered IPC Handlers:**
  1. `getPrinters`:
     * In `electron/preload.cjs:215`:
       ```javascript
       getPrinters: () => ipcRenderer.invoke('hw:getPrinters')
       ```
       This overwrote `system:getPrinters` (`preload.cjs:168`).
     * In `electron/hardware.cjs:355`, `hw:getPrinters` is defined inside `function registerLabelIPC(db)`.
     * In `electron/main.cjs:11`, `const hardware = require('./hardware.cjs');` is imported, but `hardware.registerLabelIPC(db)` is **NEVER CALLED**.
     * Result: Calling `window.api.getPrinters()` (used in `LabelPrintSettings.jsx:256`) causes an unhandled rejection: `No handler registered for 'hw:getPrinters'`.
  2. `printLabel` and `printLabelZPL`:
     * In `electron/preload.cjs:217-218`, calls `print:label` and `printLabelZPL`.
     * Both handlers reside in `hardware.registerLabelIPC(db)` which is never called in `main.cjs`.
     * Result: Any label print attempt via `window.api.printLabel` fails with `No handler registered`.
  3. `kickDrawer`:
     * In `src/features/pos/hooks/useHardware.js:58`:
       ```javascript
       await window.api.kickDrawer();
       ```
     * `kickDrawer` is completely absent from `electron/preload.cjs` and has no IPC handler in `electron/main.cjs`.
     * Result: Throws `TypeError: window.api.kickDrawer is not a function`.
  4. `openCashDrawer`:
     * In `src/pages/Alterations.jsx:146`:
       ```javascript
       if (openDrawerOnSettle && window.api?.openCashDrawer) { window.api.openCashDrawer().catch(() => {}); }
       ```
     * `openCashDrawer` is not defined in `preload.cjs` or `main.cjs`.
  5. `onSessionExpired`:
     * In `src/App.jsx:249`:
       ```javascript
       window.api.onSessionExpired(() => { ... });
       ```
     * `onSessionExpired` is not exposed in `electron/preload.cjs`.
  6. `onSyncNotify`:
     * In `src/components/OfflineBanner.jsx:23-24`:
       ```javascript
       if (window.api && window.api.onSyncNotify) { window.api.onSyncNotify(() => checkStatus()); }
       ```
     * `onSyncNotify` is missing from `preload.cjs` and `main.cjs`.

* **Mock API (`src/mockApi.js`) Failures:**
  * When running in browser development mode without Electron, `src/main.jsx:11` sets `window.api = mockApi`.
  * `mockApi.js` (304 lines) has **ZERO implementations of `window.api.tailor`**.
  * Result: Navigating to `/tailor-pos`, `/alterations`, `/orders-board`, or `/measurements` immediately throws `TypeError: Cannot read properties of undefined (reading 'getDashboardStats')` in `src/components/mulam/MulamSubNav.jsx:60` and crashes the UI.

* **SQL Syntax / Schema Column Mismatch:**
  * In `electron/database.cjs:3843`:
    ```sql
    SUM(CASE WHEN o.rush_order = 1 THEN 10 ELSE 0 END) as rush_bonuses
    ```
    The column in table `tailor_orders` is named `is_urgent` (`electron/database.cjs:3561`), not `rush_order`.
    Result: `rush_bonuses` is always calculated as 0 or results in SQL query errors.

* **ESLint Code Health Audit:**
  * Command: `npm run lint` (`eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`).
  * Result: **1,864 problems (1,834 errors, 30 warnings)**.
  * Causes: Unconfigured `react/prop-types` across all React components; missing ignore patterns in `.eslintrc.cjs` causing linting of external CommonJS scripts, root utility files, and website scripts (`THREE`, `gsap` undefined errors); and unhandled hook dependencies.

---

### 1.4 Security & Data Integrity

* **Hardcoded Backdoor: Emergency PIN Reset on Every Boot:**
  * In `electron/database.cjs:869-886`:
    ```javascript
    try {
        console.log('[Auth] Checking for emergency PIN resets...');
        const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
        if (adminUser) {
            db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
            console.log(`[Auth] Emergency: Admin '${adminUser.name}' (ID: ${adminUser.id}) PIN reset to '1234'`);
        }
        const cashierUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'cashier'").get();
        if (cashierUser) {
            db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('0000'), cashierUser.id);
            console.log(`[Auth] Emergency: Cashier '${cashierUser.name}' (ID: ${cashierUser.id}) PIN reset to '0000'`);
        }
    } catch (err) { ... }
    ```
  * Every time the application starts up, the Admin PIN is forcibly reset to `'1234'` and the Cashier PIN is reset to `'0000'`, completely overwriting any custom PIN set by the business owner.

* **Weak Cryptographic Password Storage:**
  * In `electron/database.cjs:30-32`:
    ```javascript
    function hashPin(pin) {
        return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
    }
    ```
  * PINs are 4 numeric digits (0000–9999 = 10,000 possibilities). Storing them using SHA-256 with a static hardcoded salt (`'pos-salt-2026-'`) allows an attacker to compute a complete rainbow lookup table in under 50 milliseconds.

* **Arbitrary Local File Read Vulnerability:**
  * In `electron/main.cjs:782-788`:
    ```javascript
    ipcMain.handle('tailor:readAttachment', (e, filePath) => {
        try {
            return { success: true, base64: 'data:image/jpeg;base64,' + fs.readFileSync(filePath).toString('base64') };
        } catch(err) {
            return { success: false, error: err.message };
        }
    });
    ```
  * Accepts any arbitrary `filePath` string from the renderer without path traversal checking or directory containment. Any file accessible to the user account on the operating system can be read and exfiltrated.

* **Hardcoded Secret Key in Source Code:**
  * In `electron/main.cjs:9`:
    ```javascript
    const _LICENSE_SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b";
    ```
  * The master HMAC secret used to generate and validate license keys is stored in plaintext in the repository, allowing anyone with access to forge valid lifetime enterprise keys.

* **Absence of Backend Authentication & Authorization in IPC:**
  * IPC handlers (`db:deleteStaff`, `settings:save`, `acct:postJournalEntry`, `db:voidSale`, `tailor:refundOrder`) only check `_gated()` (which verifies license validity). They do **NOT** verify user session tokens, active PIN logins, or role permissions.
  * Role authorization (`AdminRoute`, `FeatureGate`) exists only on the React frontend and can be bypassed by invoking IPC channels directly.

* **Lack of Data Validation Schemas:**
  * Neither backend nor frontend uses schema validation libraries (no Zod, Joi, or class-validator). Unsanitized JSON payloads from the frontend are directly inserted into SQL parameters.

* **Severe Transactional Safety & Accounting Gaps:**
  1. **Dual Asynchronous Order Creation without Distributed Transaction:**
     * In `src/hooks/useTailorPos.jsx:420-464`:
       The frontend executes `window.api.saveSale(...)` to create a sale record and post journal entries. It then executes a separate call `window.api.tailor.createOrder(...)` to create the tailor order.
       If `createOrder` throws an error or crashes, `saveSale` is **never rolled back**. The customer’s payment remains in accounting as an orphaned sale with no production ticket.
  2. **100% Off-The-Books Alteration Revenue:**
     * In `src/pages/Alterations.jsx:264`, creating an alteration ticket calls `tailor.createAlteration(payload)`. In `electron/database.cjs:3864`, this only inserts into `alteration_tickets` and `alteration_items`. It **never creates a sale in `sales` and never touches `ledger_entries` or `accounts`**.
     * In `src/pages/Alterations.jsx:140`, delivering an alteration and collecting the remaining balance calls `updateAlterationStatus({ ticket_id, status: 'delivered' })`. It records zero payment in the cash drawer, zero general ledger entries, and zero VAT output.
  3. **Untracked Order Pickup Balances:**
     * In `src/pages/OrdersBoard.jsx:149` and `electron/database.cjs:3786`, `completeTailorOrder({ order_id, payment_method, balance_paid })` sets `status = 'delivered', balance_due = 0, deposit_paid = total_amount`.
     * It **never creates a sale record or general ledger receipt** for the `balance_paid`. The money collected at delivery is completely absent from the accounting books.
  4. **Fabric Inventory Deduction Disconnect:**
     * `createTailorOrder` updates `products.length_available` (`electron/database.cjs:3597`), but does **not** update `products.stock` and does **not** create a record in `stock_movements`. Fabric consumption does not appear in inventory movement reports or COGS calculations.
     * Fabric length is hardcoded to `3.5` meters (`useTailorPos.jsx:442`) regardless of garment type (thobe vs. sirwal) or customer size.

---

### 1.5 Test Coverage & CI/CD Pipeline

* **Native Module Binary Incompatibility (ERR_DLOPEN_FAILED):**
  * Execution Command: `node tests/unit_tests_db.cjs`
  * Verbatim Error:
    ```
    CRITICAL: Database initialization failed: Error: The module '\\?\C:\my-pos\V4\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
    was compiled against a different Node.js version using
    NODE_MODULE_VERSION 110. This version of Node.js requires
    NODE_MODULE_VERSION 127. Please try re-compiling or re-installing
    the module (for instance, using `npm rebuild` or `npm install`).
    code: 'ERR_DLOPEN_FAILED'
    ```
  * `better-sqlite3` was compiled for Electron's bundled Node.js (Node 16 / ABI 110). Executing with standard system Node (Node 22 / ABI 127) fails immediately.

* **Non-Idempotent Test Failure under Electron:**
  * Execution Command: `npx cross-env ELECTRON_RUN_AS_NODE=1 npx electron tests/unit_tests_db.cjs`
  * Verbatim Output:
    ```
    --- Starting Database Logic Tests ---
    Connecting to database at: C:\my-pos\V4\tests\test_data\pos_data.db
    ...
    ❌ TEST FAILED: UNIQUE constraint failed: products.name
    SqliteError: UNIQUE constraint failed: products.name
        at Object.addItem (C:\my-pos\V4\electron\database.cjs:991:25)
        at Object.<anonymous> (C:\my-pos\V4\tests\unit_tests_db.cjs:35:31)
    ```
  * `unit_tests_db.cjs` uses a static directory `tests/test_data` and fails on repeated runs because it does not isolate or reset its test database.

* **Synthetic Accounting Simulation vs. Real Application Tests:**
  * Execution Command: `node tests/simulation_test.cjs` passed 12/12.
  * However, `simulation_test.cjs` (668 lines) uses `sql.js` with its own isolated schema definitions. It does not test the real Electron main process, `electron/database.cjs`, preload IPC, or frontend components.

* **Playwright Scripts & Assertion Gaps:**
  * `tests/playwright_tailor.js`, `tests/playwright_alterations.js`, `tests/playwright_draft_quote.js` are imperative automation scripts.
  * They have no assertion framework (no `expect(...)` checks), no test runner runner configuration (`vitest.config.js` or `playwright.config.js` do not exist), and `package.json` contains no `"test"` script.

* **CI/CD:**
  * There are no `.github/workflows` directories or CI pipeline configurations. Automated building, linting, and testing on commit are entirely absent.

---

### 1.6 Missing Business Operations & Integrity Features (Requirement R2)
* **Cutter Pay Rates & Compensation:** Completely absent. The database schema has no `cutter_id`, no cutter rate field, and no cutting pay calculation.
* **Tailor Piece Rates & Defect Deductions:**
  * `getTailorPayroll` calculates `base_commission: r.pieces_completed * (r.piece_rate || 0)` based on `production_stage = 'ready'`.
  * There is no mechanism to log defective garments, rework costs, or deduct penalties from tailor compensation.
* **Textile / Material Waste Tracking:**
  * There is no table or schema to record remnant fabrics, shrinkage, offcuts, or cutting waste.
  * Account 4110 exists in the chart of accounts (`إيرادات رسوم المواد` / `Waste Recovery`), but is only referenced in an uncalled comment in `refundTailorOrder`.

---

## 2. LOGIC CHAIN

1. **Vulnerability Analysis:**
   * *Premise:* An application that forcibly overwrites administrative credentials to default values on every boot cannot protect store data.
   * *Evidence:* `electron/database.cjs:871-883` explicitly queries `staff WHERE role = 'admin'` and executes `UPDATE staff SET pin = hashPin('1234')`.
   * *Inference:* Regardless of manager configuration, any walk-in worker or attacker who enters `'1234'` receives full administrative privileges upon app restart.

2. **Financial Integrity & Leakage Analysis:**
   * *Premise:* A POS system must record every exchange of cash or card into double-entry accounting and sales registers to prevent employee theft and maintain tax compliance.
   * *Evidence 1:* `Alterations.jsx:264` and `database.cjs:3864` create alteration tickets without calling `saveSale` or inserting ledger entries.
   * *Evidence 2:* `Alterations.jsx:132-143` settles alterations upon delivery by updating `status = 'delivered'` without recording any cash/card payment in accounts.
   * *Evidence 3:* `OrdersBoard.jsx:149` and `database.cjs:3786` mark tailor orders as delivered without recording the collected `balance_paid` into sales or ledger entries.
   * *Inference:* 100% of alteration revenue and all final balance payments on tailor orders are completely untracked in accounting. Employees can collect cash payments without the owner or tax authority ever seeing a record.

3. **Production Stability Analysis:**
   * *Premise:* A production desktop POS cannot fail silently or throw unhandled exceptions during core operational workflows (printing receipts, scanning printers, navigating pages).
   * *Evidence 1:* `preload.cjs:215` binds `window.api.getPrinters` to `hw:getPrinters`, but `registerLabelIPC` is omitted from `main.cjs`.
   * *Evidence 2:* `useHardware.js:58` and `Alterations.jsx:146` invoke non-existent cash drawer functions (`kickDrawer`, `openCashDrawer`).
   * *Evidence 3:* `mockApi.js` omits the entire `tailor` API module.
   * *Inference:* Attempting to configure barcode printers, kick open the cash drawer on payment, or run the app in preview/browser modes causes immediate runtime crashes.

4. **Architectural & Transactional Consistency Analysis:**
   * *Premise:* Multi-step business transactions (registering a financial sale and creating a tailoring production order) must succeed or fail as an atomic unit.
   * *Evidence:* In `src/hooks/useTailorPos.jsx:420-464`, `saveSale` and `createOrder` are executed sequentially across separate IPC calls.
   * *Inference:* A network hiccup, database lock, or software crash during `createOrder` leaves a permanent financial sale in the database without any production order, creating customer dispute and audit discrepancies.

---

## 3. CAVEATS

1. **Hardware Driver Execution:** Physical thermal printers (e.g., ESC/POS, ZPL Zebra printers) and physical cash drawers connected via RJ11/serial ports were not tested with live hardware. Observations are based on source code analysis of the IPC communication layer and Windows PowerShell printer invocation methods in `electron/hardware.cjs`.
2. **ZATCA Live Clearance:** ZATCA Phase 2 compliance was audited against the local cryptographic signing implementation (`zatca_phase2_impl.cjs`), sandbox CSR generation, and local queueing. No live submissions to ZATCA production servers (Fatoora portal) were made during this audit to avoid creating legal tax liabilities.
3. **P2P Sync Engine:** The CRDT sync engine (`syncEngine.cjs`) was inspected statically; a multi-node live distributed sync test across physical local network devices was not performed.

---

## 4. CONCLUSION

`smart-touch-pos` (V4) possesses an extensive feature set covering retail, restaurant, advanced Phase 1–3 accounting, and bespoke tailoring workflows. However, **the application in its current state is NOT production-ready**.

### Top Production Blockers:
1. **Critical Security Backdoor:** Automatic reset of Admin and Cashier PINs to `1234` / `0000` on every startup (`database.cjs:871-883`).
2. **Critical Financial Accounting Disconnect:** Complete omission of accounting entries for alteration ticket creation, alteration delivery settlement, and tailor order pickup balance collection.
3. **Broken Hardware IPC Endpoints:** Unregistered `hw:getPrinters`, missing `kickDrawer`, and non-functional barcode printer discovery due to omitted `registerLabelIPC(db)` in `main.cjs`.
4. **Missing Domain Operations:** Complete absence of cutter compensation models, tailor defect deductions, and textile waste/shrinkage tracking (R2 requirements).
5. **Non-Atomic Order Creation:** Fragile two-step frontend coordination between `saveSale` and `createOrder`.
6. **Native Build & Test Incompatibility:** Native module version conflict (ABI 110 vs 127) preventing standard testing and CI/CD automation.

---

## 5. VERIFICATION METHOD

To independently verify the observations documented in this audit report, execute the following commands in the workspace root (`c:\my-pos\V4`):

1. **Verify Frontend Build & Monolithic Bundle Warning:**
   ```powershell
   npx vite build
   ```
   *Expected:* Builds successfully with CSS warning `[window:openPos]{window:openPos}` and generates monolithic `dist/assets/index-*.js` (>1.8MB).

2. **Verify ESLint Errors:**
   ```powershell
   npm run lint
   ```
   *Expected:* Fails with code 1, reporting ~1,864 problems.

3. **Verify Native Module ABI Mismatch:**
   ```powershell
   node tests/unit_tests_db.cjs
   ```
   *Expected:* Fails immediately with `ERR_DLOPEN_FAILED` (compiled with NODE_MODULE_VERSION 110, requires 127).

4. **Verify Non-Idempotent Test Failure via Electron:**
   ```powershell
   npx cross-env ELECTRON_RUN_AS_NODE=1 npx electron tests/unit_tests_db.cjs
   ```
   *Expected:* Fails with `SqliteError: UNIQUE constraint failed: products.name`.

5. **Verify Hardcoded PIN Overwrite:**
   Inspect `c:\my-pos\V4\electron\database.cjs` at lines 869–886. Note the unconditional `db.prepare('UPDATE staff SET pin = ...').run(hashPin('1234'), adminUser.id)`.

6. **Verify Broken Printer IPC Binding:**
   Inspect `c:\my-pos\V4\electron\preload.cjs:215` (`hw:getPrinters`), and check `c:\my-pos\V4\electron\main.cjs` to confirm `hardware.registerLabelIPC(db)` is never called.

7. **Verify Accounting Bypass in Alterations:**
   Inspect `c:\my-pos\V4\src\pages\Alterations.jsx:132-145` and `electron/database.cjs:3901-3905` to confirm `updateAlterationStatus` touches only `alteration_tickets` and never interacts with `sales` or `ledger_entries`.
