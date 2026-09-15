# End-to-End Evaluation Report: Business Operations and Integrity (Requirement R2)

**Author / Evaluator:** `teamwork_preview_explorer_review_2`  
**Target Application:** Tailor POS System (`my-pos/V4` - "البصمة الذكية")  
**Evaluation Scope:** Requirement R2 — Business Operations, Worker Compensation, Defect Deductions, Material Waste, and Fraud Prevention / Role-based Integrity  
**Date:** 2026-09-11  

---

## Executive Summary Matrix

| Evaluation Area | Implementation Status | Primary Schema / Backend Files | Primary Frontend UI Files | Critical Findings / Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **1. Cutter Pay Rates & Compensation** | **Completely Missing** *(Stubbed UI label only)* | `electron/database.cjs:448, 646-656` | `src/pages/Staff.jsx:408` | No `assigned_cutter_id` in schema; no rate matrix per garment/cut; no cut job tracking; no payout reports. Role exists only as a datalist `<option>`. |
| **2. Tailor Pay Rates & Compensation** | **Partially Implemented & Critically Broken** | `electron/database.cjs:646-656, 3839-3861`, `electron/main.cjs:756`, `electron/preload.cjs:382` | `src/pages/Staff.jsx:60, 140-176, 328-358`, `src/hooks/useTailorPos.jsx:449` | Flat `piece_rate` exists on `staff`, but `getTailorPayroll` crashes (`SqliteError: no such column: o.rush_order`); frontend calls undefined `window.api.getPayroll`; `assigned_tailor_id` is never populated from POS; no payout ledger persistence. |
| **3. Defect Deductions & Penalties** | **Completely Missing** | `electron/database.cjs:606-623, 3738-3771`, `electron/accounting_p2.cjs:210` | `src/pages/Alterations.jsx:220-285`, `src/pages/OrdersBoard.jsx:8-14` | Zero QC checkpoints; no defect logging tables; no worker attribution for rework; penalty in `refundTailorOrder` penalizes the *customer*, not the tailor; no deduction line items on pay slips. |
| **4. Textile / Material Waste Tracking** | **Partially Implemented Primitive Prototype** | `electron/database.cjs:697-698, 1411-1418, 3596-3599` | `src/hooks/useTailorPos.jsx:442`, `src/pages/MenuAdmin.jsx:148` | No `fabric_rolls` table; inventory is a single gross float (`length_available`); consumption is hardcoded to 3.5m across all garment types and sizes; zero scrap tracking, shrinkage logging, or waste costing. |
| **5. Fraud Prevention & Role-based Integrity** | **Partially Implemented with High Fraud Vulnerability** | `electron/database.cjs:379-391, 464-470, 1940-2115, 2805-2940`, `electron/main.cjs:336-343` | `src/pages/Shift.jsx:46`, `src/pages/Pos.jsx:2000-2022, 2137`, `src/pages/SalesHistory.jsx:114-122`, `src/pages/AuditLogs.jsx:154`, `src/store/useAuthStore.js:57-92` | Backend IPC `_gated()` checks license key only (zero RBAC); cashiers can freely override prices and void invoices with zero approval; shift `expected_cash` ignores petty cash payouts; `audit_logs` has `user_id = NULL` everywhere. |

---

## 1. Observation

### 1.1 Cutter Pay Rates and Total Compensation
1. **Schema Definition (`electron/database.cjs:437-448`):**
   ```sql
   CREATE TABLE IF NOT EXISTS staff (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       pin TEXT NOT NULL UNIQUE,
       role TEXT DEFAULT 'Cashier',
       permissions_json TEXT DEFAULT '[]',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ALTER TABLE staff ADD COLUMN piece_rate REAL DEFAULT 0;
   ```
   - Only a single scalar `piece_rate` column exists on `staff`.
2. **Garment Production Schema (`electron/database.cjs:646-656`):**
   ```sql
   CREATE TABLE IF NOT EXISTS tailor_order_garments (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       tailor_order_id INTEGER,
       garment_type TEXT,
       measurement_profile_id INTEGER,
       fabric_id INTEGER,
       production_stage TEXT DEFAULT 'measuring',
       assigned_tailor_id INTEGER,
       special_instructions TEXT,
       FOREIGN KEY (tailor_order_id) REFERENCES tailor_orders(id) ON DELETE CASCADE
   );
   ```
   - Notice: `assigned_tailor_id` is present, but there is **no `assigned_cutter_id`** column.
3. **Cutter Role Definition in Frontend (`src/pages/Staff.jsx:404-412`):**
   ```jsx
   <datalist id="roles-list">
     <option value="Cashier">كاشير</option>
     <option value="Admin">مدير نظام</option>
     <option value="tailor">خياط</option>
     <option value="cutter">فصال / قصاص</option>
     <option value="مطرز">مطرز</option>
     <option value="كاوي">كاوي</option>
   </datalist>
   ```
   - The word "cutter" appears only in `Staff.jsx` line 263 (role icon 📏), line 268 (badge label 'فصال'), and line 408 (datalist option).
4. **Backend Cutting Compensation Logic:**
   - Search across all `.cjs` and `.jsx` files confirms: There is **no function** named `getCutterPayroll`, `calculateCutterCommission`, or any query referencing cutting jobs.

---

### 1.2 Tailor Pay Rates and Total Compensation
1. **Tailor Payroll Calculation Function (`electron/database.cjs:3839-3861`):**
   ```javascript
   function getTailorPayroll({ start_date, end_date } = {}) {
       let sql = `
           SELECT g.assigned_tailor_id, s.name as tailor_name, s.piece_rate,
                  COUNT(g.id) as pieces_completed,
                  SUM(CASE WHEN o.rush_order = 1 THEN 10 ELSE 0 END) as rush_bonuses
           FROM tailor_order_garments g
           JOIN tailor_orders o ON g.tailor_order_id = o.id
           LEFT JOIN staff s ON g.assigned_tailor_id = s.id
           WHERE g.production_stage = 'ready'
       `;
       const params = [];
       if (start_date && end_date) {
           sql += ` AND date(o.order_date) BETWEEN ? AND ?`;
           params.push(start_date, end_date);
       }
       sql += ` GROUP BY g.assigned_tailor_id`;
       
       return db.prepare(sql).all(params).map(r => ({
           ...r,
           base_commission: r.pieces_completed * (r.piece_rate || 0),
           total_payout: (r.pieces_completed * (r.piece_rate || 0)) + r.rush_bonuses
       }));
   }
   ```
2. **Schema Mismatch on Rush Order (`electron/database.cjs:626-642`):**
   ```sql
   CREATE TABLE IF NOT EXISTS tailor_orders (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       customer_id INTEGER,
       sale_invoice_id INTEGER,
       order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
       target_delivery_date DATETIME,
       total_amount REAL,
       deposit_paid REAL,
       balance_due REAL,
       is_urgent INTEGER DEFAULT 0,
       urgent_fee REAL DEFAULT 0,
       is_gift INTEGER DEFAULT 0,
       recipient_name TEXT,
       recipient_phone TEXT,
       status TEXT DEFAULT 'pending',
       note TEXT
   );
   ```
   - The table column is named `is_urgent`, NOT `rush_order`. Executing `getTailorPayroll` causes SQLite to abort with: `SqliteError: no such column: o.rush_order`.
3. **IPC Preload Mapping vs Frontend Call (`electron/preload.cjs:382` vs `src/pages/Staff.jsx:60`):**
   - In `electron/preload.cjs:367-382`:
     ```javascript
     tailor: {
       ...
       getPayroll: (d) => ipcRenderer.invoke('tailor:getPayroll', d),
     }
     ```
   - In `src/pages/Staff.jsx:57-66`:
     ```javascript
     const fetchPayroll = async () => {
       setPayrollLoading(true);
       try {
         const data = await window.api.getPayroll({ start_date: startDate, end_date: endDate });
         setPayrollData(data || []);
       } catch (err) {
         console.error(err);
       }
       setPayrollLoading(false);
     };
     ```
   - `window.api.getPayroll` is `undefined`. Calling it throws: `TypeError: window.api.getPayroll is not a function`.
4. **Unassigned Garment Population (`src/hooks/useTailorPos.jsx:435-459` & `electron/database.cjs:3585-3589`):**
   - In `useTailorPos.jsx`:
     ```javascript
     const garmentsList = items.map(i => ({
         garment_type: ...,
         fabric_id: ...,
         measurements: ...,
         special_instructions: i.notes,
         fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5 
     }));
     // staff_id is passed at order level, not garment level
     ```
   - In `database.cjs:3587-3588`:
     ```javascript
     const garmentResult = insertGarment.run(
         orderId, g.garment_type, g.fabric_id || null,
         g.assigned_tailor_id || null, g.special_instructions || null
     );
     ```
   - Every inserted garment has `assigned_tailor_id = NULL`. Furthermore, `OrdersBoard.jsx` has no tailor assignment selector.
5. **Settlement Slip Printing (`src/pages/Staff.jsx:140-176`):**
   - Renders a purely transient browser print window:
     ```html
     <h2>مسير رواتب الخياط</h2>
     <p>عدد القطع المنجزة: ${tailor.pieces_completed || 0}</p>
     <p>العمولة الأساسية: ${(tailor.base_commission || 0).toFixed(2)} ر.س</p>
     <p>المكافآت: ${(tailor.bonuses || 0).toFixed(2)} ر.س</p>
     <div class="total">إجمالي المستحق: ${(tailor.total_payout || 0).toFixed(2)} ر.س</div>
     ```
   - No database record is inserted to record this payout, no date of payment is saved, and no accounting journal entry is created.

---

### 1.3 Deductions Due to Defective Items Made by Tailors
1. **Production Pipeline Stages (`src/pages/OrdersBoard.jsx:8-14`):**
   ```javascript
   const STAGES = [
     { id: 'cutting',   label: 'قص',    icon: '✂️' },
     { id: 'stitching', label: 'خياطة', icon: '🧵' },
     { id: 'finishing', label: 'تشطيب', icon: '🪡' },
     { id: 'ironing',   label: 'كوي',   icon: '♨️' },
     { id: 'ready',     label: 'جاهز',  icon: '✅' },
   ];
   ```
   - No "Quality Inspection / QC" stage exists in the pipeline.
2. **Alteration Tickets (`electron/database.cjs:606-623` & `src/pages/Alterations.jsx:256-263`):**
   ```sql
   CREATE TABLE IF NOT EXISTS alteration_tickets (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       customer_id INTEGER,
       linked_order_id INTEGER,
       total_fee REAL DEFAULT 0,
       deposit REAL DEFAULT 0,
       status TEXT DEFAULT 'pending',
       target_delivery_date TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```
   - There are no columns for: `responsible_tailor_id`, `defect_reason`, `is_shop_fault`, `deduction_amount`, or `dispute_status`.
3. **Refund Penalty Attribution (`electron/database.cjs:3738-3744`):**
   ```javascript
   function refundTailorOrder(order_id, is_cut, penalty_amount) {
       return db.transaction(() => {
           const order = db.prepare('SELECT * FROM tailor_orders WHERE id = ?').get(order_id);
           const refundAmount = order.deposit_paid - (is_cut ? penalty_amount : 0);
   ```
   - The penalty is subtracted from the customer refund, not deducted from worker compensation.

---

### 1.4 Tracking of Textile / Material Waste
1. **Fabric Schema Migration (`electron/database.cjs:697-698`):**
   ```javascript
   try { db.exec("ALTER TABLE products ADD COLUMN is_fabric INTEGER DEFAULT 0;"); } catch(e){}
   try { db.exec("ALTER TABLE products ADD COLUMN length_available REAL;"); } catch(e){}
   ```
   - Fabrics are simply records in `products` with a single scalar float `length_available`.
   - No `fabric_rolls` table exists.
2. **Purchase Receiving (`electron/database.cjs:1411-1414`):**
   ```javascript
   if (product?.is_fabric) {
       const metersToAdd = it.quantity * mpu;
       db.prepare('UPDATE products SET stock = stock + ?, length_available = IFNULL(length_available, 0) + ?, cost = ? WHERE id = ?')
         .run(it.quantity, metersToAdd, newCost, it.product_id);
   }
   ```
3. **Consumption Deduction on Order Placement (`src/hooks/useTailorPos.jsx:442` & `electron/database.cjs:3596-3599`):**
   ```javascript
   // In useTailorPos.jsx
   fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5
   
   // In database.cjs createTailorOrder
   if (g.fabric_id && g.fabric_length_used) {
       db.prepare(`UPDATE products SET length_available = MAX(0, IFNULL(length_available, 0) - ?) WHERE id = ?`)
         .run(g.fabric_length_used, g.fabric_id);
   }
   ```
   - Standard length is hardcoded to 3.5 meters for every garment, regardless of garment type (thobe, shirt, pants, bisht) or customer size.
   - The deduction occurs at order placement before fabric is ever cut.
   - Cutters have no UI or API to input actual cut length.
   - No tables exist for scrap remnants, unusable scraps, shrinkage adjustments, or damaged fabric write-offs.

---

### 1.5 Fraud Prevention & Role-based Integrity
1. **Cash Register Shift Schema & Discrepancy Calculation (`electron/database.cjs:379-391, 2880`):**
   ```sql
   CREATE TABLE IF NOT EXISTS shifts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       closed_at DATETIME,
       starting_cash REAL DEFAULT 0,
       actual_cash REAL DEFAULT 0,
       expected_cash REAL DEFAULT 0,
       cash_sales REAL DEFAULT 0,
       card_sales REAL DEFAULT 0,
       status TEXT DEFAULT 'open',
       staff_id INTEGER
   );
   ```
   - In `closeShift` (`database.cjs:2880`):
     ```javascript
     const expectedCash = (shift.starting_cash || 0) + cashSales;
     ```
     Expenditures paid out of the register (cash drops) are **not deducted** from `expectedCash`.
   - In `src/pages/Shift.jsx:46`:
     ```javascript
     await window.api.openShift({ cash: amount, staffId: null });
     ```
     `staffId` is hardcoded to `null` on shift open.
2. **Backend IPC Gating Vulnerability (`electron/main.cjs:336-343`):**
   ```javascript
   function _gated(fn) {
       return async (e, ...args) => {
           if (!_isLicenseActive()) {
               return { success: false, error: 'LICENSE_REQUIRED', message: 'الترخيص غير صالح أو منتهي الصلاحية — يرجى تجديد الاشتراك' };
           }
           return fn(e, ...args);
       };
   }
   ```
   - `_gated()` checks only if the commercial license is active. It performs **zero role or permission validation**. Any IPC call from the renderer is executed without checking if the user is an Admin or Cashier.
3. **Unprotected Price Overrides and Voids (`src/pages/Pos.jsx:2000-2022, 2137` & `src/pages/SalesHistory.jsx:114-122`):**
   - In `Pos.jsx`: "Agreed Total Override" allows entering any arbitrary total amount. No manager PIN or permission check is requested.
   - In `Pos.jsx:2137` and `SalesHistory.jsx:114-122`: `voidSale` is called directly upon clicking the button with no supervisor override.
4. **Audit Logging Attribution Failure (`electron/database.cjs:464-470, 2945-2947`):**
   ```sql
   CREATE TABLE IF NOT EXISTS audit_logs (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER,
       action TEXT NOT NULL,
       details TEXT,
       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```
   ```javascript
   function addAuditLog(action, details) {
       try { db.prepare('INSERT INTO audit_logs (action, details) VALUES (?,?)').run(action, details); } catch (e) {}
   }
   ```
   - `user_id` is never passed to `INSERT INTO audit_logs`. All entries are stored with `user_id = NULL`.
   - In `src/pages/AuditLogs.jsx:154`, the staff column displays `#?` for every single log record.
   - Price overrides and manual discount events are never passed to `addAuditLog`.

---

## 2. Logic Chain

1. **Cutter Compensation Gap:**
   - *Premise (Obs 1.1.1, 1.1.2):* `tailor_order_garments` only tracks `assigned_tailor_id` and lacks `assigned_cutter_id`.
   - *Premise (Obs 1.1.3, 1.1.4):* The string "cutter" is only present in a UI `<option>` tag and is never referenced in backend queries.
   - *Inference:* Cutting labor is unassigned, unmeasured, and untracked. Business owners cannot calculate piece-rates or hourly wages for cutters within this system.

2. **Tailor Compensation Broken State:**
   - *Premise (Obs 1.2.2):* `getTailorPayroll` executes SQL querying `o.rush_order = 1`.
   - *Premise (Obs 1.2.2):* Table `tailor_orders` defines `is_urgent`, not `rush_order`.
   - *Inference:* Any call to `getTailorPayroll` immediately throws a fatal SQLite column error.
   - *Premise (Obs 1.2.3):* `preload.cjs` exposes the method under `window.api.tailor.getPayroll`, while `Staff.jsx` calls `window.api.getPayroll`.
   - *Inference:* Even if the SQL were valid, the frontend call fails with a JavaScript TypeError.
   - *Premise (Obs 1.2.4):* POS garment creation leaves `assigned_tailor_id` NULL.
   - *Inference:* Even if errors are resolved, the query groups by `assigned_tailor_id` and returns zero completed pieces for any staff member.
   - *Premise (Obs 1.2.5):* Payout vouchers print via window HTML without saving a settlement record or posting a journal entry.
   - *Inference:* The system cannot prevent double-payouts or reconcile labor expenses with the general ledger.

3. **Absence of Defect & Penalty Accounting:**
   - *Premise (Obs 1.3.1, 1.3.2):* Neither `OrdersBoard` nor `alteration_tickets` provides a quality control inspection gate, defect taxonomy, or tailor attribution field.
   - *Premise (Obs 1.3.3):* The only penalty in the codebase is deducted from customer refunds upon order cancellation (`refundTailorOrder`).
   - *Inference:* When a tailor makes an error requiring rework or scrapping fabric, the owner absorbs 100% of the cost. The system provides zero mechanism to track, attribute, or penalize worker defects.

4. **Inaccuracy of Textile Waste Tracking:**
   - *Premise (Obs 1.4.1):* Fabric stock is tracked solely as an aggregate floating-point total (`products.length_available`) without individual roll tracking.
   - *Premise (Obs 1.4.3):* Order placement deducts a hardcoded 3.5 meters regardless of garment dimensions, and cutters cannot record actual yardage cut.
   - *Inference:* The system cannot compute material yield, fabric shrinkage, or remnant scrap. Inventory records inevitably diverge from physical stock, concealing textile theft or excessive cutting waste.

5. **Security and Fraud Exposure:**
   - *Premise (Obs 1.5.2):* Backend IPC wrapper `_gated()` validates only software licensing, not user authentication or authorization.
   - *Premise (Obs 1.5.3):* The frontend permits arbitrary price overrides ("Agreed Total Override") and invoice voids without requiring manager PINs.
   - *Premise (Obs 1.5.4):* `addAuditLog` discards `user_id`, leaving all audit records anonymous (`user_id = NULL`).
   - *Inference:* A malicious cashier can void completed cash sales, pocket the cash, or discount items to 0 SAR with zero manager authorization and complete anonymity in audit logs.
   - *Premise (Obs 1.5.1):* Register closing calculations ignore petty cash expenditures paid from the till.
   - *Inference:* Legitimate cash drops trigger false register shortage alerts, degrading trust in shift reconciliation.

---

## 3. Caveats

1. **General Accounting Modules:** The codebase includes sophisticated general accounting engines (`electron/accounting.cjs` and `electron/accounting_p2.cjs`) supporting double-entry bookkeeping, fixed assets, and generic monthly payroll (`payroll_runs`). These modules operate independently of the tailoring and garment production workflow.
2. **ZATCA Phase 2 Compliance:** Invoice signing, XML hashing, and cryptographic chaining for sales and credit notes are deeply implemented. The lack of cryptographic immutability noted in this report applies specifically to the internal `audit_logs` table, not to the ZATCA compliance pipeline.
3. **No Code Modifications Made:** In accordance with the Explorer persona and read-only constraints, no application code was altered. Findings represent the verbatim state of `my-pos/V4`.

---

## 4. Conclusion

The tailor POS application (`my-pos/V4`) is **not production-ready** for multi-worker commercial tailor shops. While core POS sales and ZATCA Phase 2 invoicing are mature, the operational metrics and business integrity layers suffer from fundamental gaps:

1. **Worker Compensation:** Cutter compensation is completely nonexistent. Tailor compensation contains three compounding defects (schema mismatch, preload namespace mismatch, unpopulated assignment IDs) and lacks settlement persistence.
2. **Defect Management:** Completely absent. The shop owner has no tool to record defects, mandate rework, or enforce labor deductions.
3. **Textile Inventory:** Fabric is treated as generic retail stock with a hardcoded 3.5m consumption rate. True roll-level inventory, cutting waste tracking, and shrinkage calculations are missing.
4. **Fraud Prevention:** Critical operational actions (price overrides, voids, discounts) lack backend role-based access control. The audit log is anonymous (`user_id = NULL`), leaving the business vulnerable to internal cash skimming.

---

## 5. Verification Method

To independently verify the observations and findings documented above, execute the following steps:

### 5.1 Verifying Tailor Payroll SQL & Namespace Bugs
1. Inspect `electron/database.cjs` at line 3843:
   ```bash
   # Look for rush_order in query
   Get-Content electron/database.cjs | Select-String "o.rush_order" -Context 2,2
   ```
   *Expected:* Shows `SUM(CASE WHEN o.rush_order = 1 THEN 10 ELSE 0 END) as rush_bonuses`.
2. Compare with `tailor_orders` DDL at line 635 of `electron/database.cjs`:
   *Expected:* Shows `is_urgent INTEGER DEFAULT 0` and no `rush_order` column.
3. Inspect `src/pages/Staff.jsx` at line 60:
   ```bash
   Get-Content src/pages/Staff.jsx | Select-String "window.api.getPayroll"
   ```
   *Expected:* Calls `window.api.getPayroll(...)`.
4. Inspect `electron/preload.cjs` at lines 367-382:
   *Expected:* Method is nested under `tailor: { getPayroll: ... }`, proving `window.api.getPayroll` is `undefined`.

### 5.2 Verifying Anonymous Audit Logs
1. Inspect `electron/database.cjs` at lines 2945-2947:
   ```bash
   Get-Content electron/database.cjs | Select-String "function addAuditLog" -Context 0,4
   ```
   *Expected:* Shows `db.prepare('INSERT INTO audit_logs (action, details) VALUES (?,?)').run(action, details);`, omitting `user_id`.

### 5.3 Verifying Shift Petty Cash Bug
1. Inspect `electron/database.cjs` at line 2880:
   ```bash
   Get-Content electron/database.cjs | Select-String "expectedCash" -Context 2,2
   ```
   *Expected:* Shows `const expectedCash = (shift.starting_cash || 0) + cashSales;`, with no subtraction of expenditures.

### 5.4 Invalidation Conditions
This evaluation would be invalidated if:
- A separate database migration added `rush_order` to `tailor_orders` and `assigned_cutter_id` to `tailor_order_garments`.
- `main.cjs` implemented an IPC authorization middleware verifying staff session tokens against role permissions before invoking database handlers.
- Fabric inventory was refactored into a dedicated `fabric_rolls` table tracking roll barcodes, initial meters, remaining meters, and cut job scraps.
