# Handoff Report: Financial Integrity, Workforce Schema, Customer Lifecycle & Domain Logic (R2 & R3)

**Author**: Financial & Domain Explorer  
**Working Directory**: `c:\my-pos\V4\.agents\explorer_survey_domain_1`  
**Target Milestone**: R2 (Financial & Workforce) and R3 (Customer Lifecycle & Domain Logic) Forensic Review  
**Date**: September 11, 2026  

---

## 1. Observation

Direct forensic inspection across the codebase (`electron/database.cjs`, `electron/preload.cjs`, `electron/main.cjs`, `src/hooks/useTailorPos.jsx`, `src/pages/OrdersBoard.jsx`, `src/pages/TailorPos.jsx`, `src/pages/Staff.jsx`, `src/pages/MeasurementCapture.jsx`, and `src/pages/Alterations.jsx`) reveals the exact failure points and structural gaps across all 7 mandated investigation items:

### Item 1: Final Balance Collection Accounting & Missing GL Double-Entry
* **Frontend Order Settlement Call (`src/pages/OrdersBoard.jsx:145–153`):**
  When a customer collects completed garments, the pickup modal calls:
  ```javascript
  // src/pages/OrdersBoard.jsx:149-153
  const res = await window.api?.tailor?.completeOrder?.({
      order_id: showPickup.id,
      payment_method: payMethod,
      balance_paid: showPickup.balance_due,
  });
  ```
* **IPC Main Handler (`electron/main.cjs:754`):**
  ```javascript
  ipcMain.handle('tailor:completeOrder', _gated((e, d) => { try { return db.completeTailorOrder(d); } catch(err) { return { success: false, error: err.message }; } }));
  ```
* **Backend Implementation in `electron/database.cjs:3786–3795`:**
  ```javascript
  function completeTailorOrder({ order_id, payment_method, balance_paid }) {
      const order = db.prepare(`SELECT * FROM tailor_orders WHERE id = ?`).get(order_id);
      if (!order) throw new Error('Order not found: ' + order_id);

      db.prepare(
          `UPDATE tailor_orders SET status = 'delivered', balance_due = 0, deposit_paid = total_amount WHERE id = ?`
      ).run(order_id);

      return { success: true };
  }
  ```
  **Direct Observation:** Although `{ payment_method, balance_paid }` are passed from the UI, `completeTailorOrder` discards them completely. It performs a single bare SQL `UPDATE` on `tailor_orders`. It posts **zero** records to `ledger_entries`, makes **zero** calls to `accounting.postJournalEntry`, updates **zero** rows in `accounts`, and adds **zero** revenue to the active shift in `shifts`. All cash and network card payments collected at pickup completely vanish from the books.
* **Contrast with Working Deposit Payment (`electron/database.cjs:3711–3736`):**
  In `addTailorPayment`, the system properly executes:
  ```javascript
  const acct = (payment_method === 'Cash' || payment_method === 'نقدي') ? 1111 : 1112;
  const ref = `دفعة لطلب خياطة #${order_id}`;
  db.prepare(`INSERT INTO ledger_entries (account_code, description, debit, credit, reference) VALUES (?, ?, ?, ?, ?)`).run(acct, ref, amount_paid, 0, ref);
  db.prepare(`INSERT INTO ledger_entries (account_code, description, debit, credit, reference) VALUES (?, ?, ?, ?, ?)`).run(1200, ref, 0, amount_paid, ref);
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE account_code = ?').run(amount_paid, acct);
  db.prepare('UPDATE accounts SET balance = balance - ? WHERE account_code = 1200').run(amount_paid);
  ```
* **Order Creation Cash Distortion (`electron/database.cjs:1870–1891` & `src/hooks/useTailorPos.jsx:420–432`):**
  When an order is created, `useTailorPos.jsx` calls `saveSale` with `total: total`, `paid: depositAmount`, `payment: finalPaymentMethod`. In `database.cjs:1872–1877`, `saveSale` assigns `drAcct = 1111` whenever `payment === 'Cash'`, and debits `finalTotal` (the FULL order total) to Cash (1111), even if the customer only paid a partial deposit (e.g. 200 SAR on a 1000 SAR order). This prematurely over-debits Cash by 800 SAR instead of splitting between Cash and Accounts Receivable (1200).

---

### Item 2: Cutter Role (المفصل) Schema & Frontend Gaps
* **Database Schema Absence (`electron/database.cjs:646–656`):**
  ```sql
  CREATE TABLE IF NOT EXISTS tailor_order_garments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tailor_order_id INTEGER,
      garment_type TEXT,
      measurement_profile_id INTEGER,
      fabric_id INTEGER,
      production_stage TEXT DEFAULT 'measuring',
      assigned_tailor_id INTEGER,         -- Tailor column exists
      special_instructions TEXT,          -- assigned_cutter_id is ABSENT!
      FOREIGN KEY (tailor_order_id) REFERENCES tailor_orders(id) ON DELETE CASCADE
  );
  ```
* **Staff Role Storage (`electron/database.cjs:437–449`):**
  `staff` table defines `role TEXT DEFAULT 'Cashier'` and `piece_rate REAL DEFAULT 0`. There is no `cutter_piece_rate` column or separate commission tracking for cutters.
* **Frontend Staff Management (`src/pages/Staff.jsx:263, 268, 408`):**
  `cutter` exists solely as an aesthetic option in `<option value="cutter">فصال / قصاص</option>` and an icon mapping (`📏`).
* **Frontend POS Assignment (`src/pages/TailorPos.jsx:320–346`):**
  The POS checkout drawer contains only a single staff selector: "المعلم المشرف" bound to `tailorId`. No Cutter selector exists.
* **Garment Insertion Disconnect (`src/hooks/useTailorPos.jsx:435–459`):**
  `garmentsList` in `useTailorPos.jsx` passes `fabric_id`, `garment_type`, `measurements`, and `special_instructions`, but **omits `assigned_tailor_id`**. In `database.cjs:3587`, garments are inserted into SQLite with `assigned_tailor_id = NULL`.
* **Kanban Board Blindness (`src/pages/OrdersBoard.jsx:415–487`):**
  Garment cards display garment type and fabric name, but do not show assigned tailor or cutter, and provide no interface to assign a cutter during the `cutting` stage.

---

### Item 3: Tailor Payroll SQL Crash & Namespace Mismatch
* **Fatal SQL Column Error (`electron/database.cjs:3843`):**
  ```javascript
  // electron/database.cjs:3839-3848
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
  ```
  In `electron/database.cjs:635`, the `tailor_orders` column is defined as:
  `is_urgent INTEGER DEFAULT 0, urgent_fee REAL DEFAULT 0`.
  The column `o.rush_order` DOES NOT EXIST. Calling `getTailorPayroll` immediately throws:
  `SqliteError: no such column: o.rush_order`.
* **Bonus Field Name Mismatch (`electron/database.cjs:3843` vs `src/pages/Staff.jsx:160, 343`):**
  `database.cjs:3843` aliases the column as `rush_bonuses`. But `Staff.jsx:160` and `Staff.jsx:343` read `row.bonuses`. As a result, bonuses display as `0.00 ر.س` in the UI.
* **Frontend IPC Namespace Mismatch (`src/pages/Staff.jsx:60` vs `electron/preload.cjs:382`):**
  - In `electron/preload.cjs:382`, the payroll handler is exposed as:
    `tailor: { getPayroll: (d) => ipcRenderer.invoke('tailor:getPayroll', d) }`
  - In `src/pages/Staff.jsx:60`, the component invokes:
    `const data = await window.api.getPayroll({ start_date: startDate, end_date: endDate });`
    `window.api.getPayroll` is `undefined`. Clicking the "رواتب الخياطين" tab throws:
    `TypeError: window.api.getPayroll is not a function`.
* **Zero Garments Attributed:** Because POS order creation leaves `assigned_tailor_id = NULL` on all garments, `GROUP BY g.assigned_tailor_id` yields 0 completed pieces for all staff.
* **No Payout Records:** Generating payroll in `Staff.jsx:140–176` merely opens an ephemeral HTML window for printing. No table exists to record payout dates, settled piece counts, or general ledger labor expense entries.

---

### Item 4: Fabric Roll-Level Inventory & Variable Consumption
* **Primitive Flat Inventory (`electron/database.cjs:697–698`):**
  Fabric inventory is stored directly on `products` via two scalar columns:
  ```sql
  ALTER TABLE products ADD COLUMN is_fabric INTEGER DEFAULT 0;
  ALTER TABLE products ADD COLUMN length_available REAL;
  ```
  There is no table for individual fabric rolls (`fabric_rolls`), dye lots (`dye_lot`), roll barcodes, or bolt widths.
* **Blind Hardcoded 3.5m Consumption (`src/hooks/useTailorPos.jsx:442`):**
  ```javascript
  // src/hooks/useTailorPos.jsx:442
  fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5
  ```
  Every garment blindly deducts exactly 3.5m from `products.length_available`, whether it is a child's thobe (requires ~1.8m), adult thobe (requires ~3.25m), sirwal (requires ~1.4m), or bisht (requires ~5.5m).
* **Inventory Movement Black Hole (`electron/database.cjs:3597–3599`):**
  `createTailorOrder` updates `products.length_available`, but does **not** update `products.stock` and does **not** insert a record into `stock_history` or `stock_movements`. Fabric consumption is untracked in inventory ledger reports.

---

### Item 5: Customer Phone Search 10-Digit Gate & Multi-Match Collision
* **The 10-Digit Validation Gate (`src/hooks/useTailorPos.jsx:230–257`):**
  ```javascript
  // src/hooks/useTailorPos.jsx:230-233, 254-257
  const handlePhoneSearch = useCallback(async (searchPhone) => {
      if (searchPhone.length >= 10) {
          try {
              const res = await window.api?.getCustomers?.({ search: searchPhone });
              ...
      } else {
          setCustomer(null);
          setLatestProfile(null);
      }
  ```
  In Saudi Arabia, local numbers are entered as 9 digits (`501234567`). Because the hook enforces `searchPhone.length >= 10`, entering 9 digits causes the hook to remain dormant and actively set `customer = null`.
* **Arbitrary Multi-Match Collision (`src/hooks/useTailorPos.jsx:234–237`):**
  ```javascript
  if (res && res.length > 0) {
      const c = res[0];
      setCustomer(c);
      setName(c.name);
  ```
  When multiple customers match a number (shared landlines, family accounts, or existing duplicate records), the hook automatically binds `res[0]` without prompt, risking booking one customer's garments under another's profile.
* **Unsanitized Backend Query (`electron/database.cjs:2599–2602`):**
  `getCustomers` uses `LIKE %${filters.search}%` without phone normalization. A search for `0501234567` will fail to match a customer registered as `501234567` or `+966501234567`.

---

### Item 6: Rigid 8-Field Measurement Schema & Destructive Profile Overwrites
* **Rigid 8-Field Array (`src/pages/MeasurementCapture.jsx:13–22` & `src/pages/TailorPos.jsx:821–830`):**
  Only 8 fields exist: `length`, `shoulder`, `chest`, `waist`, `sleeve`, `neck`, `wrist`, and `hand_opening`.
  - **Suits are un-tailorable**: Missing lapel width, jacket half-chest, sleeve crown, jacket drop, trouser outseam, trouser inseam, crotch rise, thigh, knee.
  - **Saudi Bespoke Thobe parameters missing**: Al-Khaban (الخبن), Jabzor (الجبزور), Bottom Flare / Da'er (وسع الدائر), Collar Height (ارتفاع الياقة), pocket configuration.
  - **Sirwal anatomy distorted**: Neck and sleeve fields are shown, while hip and crotch rise are missing.
* **Destructive Master Profile Overwrite (`src/hooks/useTailorPos.jsx:467–474` & `electron/database.cjs:3571–3574`):**
  Both `useTailorPos.jsx` and `createTailorOrder` unconditionally overwrite `measurement_profiles`:
  ```javascript
  // src/hooks/useTailorPos.jsx:467-474
  for (const item of items) {
      await window.api?.tailor?.saveProfile?.({
          customer_id: customerId,
          garment_type: gType,
          measurements: { ...item.measurements, ...item.config }
      });
  }
  ```
  In `database.cjs:3656` and `useTailorPos.jsx:240`, the newest profile by `updated_at` becomes the baseline profile. If a customer orders a winter thobe with temporary sleeve/chest allowance for heavy fabric, that temporary modification destroys their standard baseline profile.

---

### Item 7: QA & Defect Tracking Absence
* **Zero Defect Architecture:** The database contains **no defect tables** (e.g. `tailor_defects` is completely missing).
* **Missing QC Stage (`src/pages/OrdersBoard.jsx:8–14`):**
  Production stages skip from `finishing` -> `ironing` -> `ready`. There is no Quality Control inspection stage.
* **Unrecorded Rework ("↩️ رجوع"):**
  Reverting a stage on the board (`OrdersBoard.jsx:468`) executes a silent `updateGarmentStage` back to the previous stage with zero defect reason, zero defect logging, and zero worker accountability.
* **Orphaned Alteration Tickets (`electron/database.cjs:3866–3884`):**
  `alteration_tickets` has a `linked_order_id` column in SQLite (`database.cjs:609`), but `createAlterationTicket` (`database.cjs:3867`) **omits `linked_order_id` from the SQL INSERT**. Furthermore, alteration ticket fees are not recorded in `sales` or the general ledger.

---

## 2. Logic Chain

```
[Observation 1: completeTailorOrder executes bare UPDATE without journal entry]
     │
     ▼
[Finding 1.1: Pickup cash/card balances never hit General Ledger (Accounts 1111/1112/1200)]
[Finding 1.2: Cash till has permanent cash discrepancies at shift close]
     │
     ▼
[Observation 2: tailor_order_garments has assigned_tailor_id, no assigned_cutter_id]
[Observation 3: POS checkout drawer only has tailorId dropdown, never sets assigned_tailor_id on garments]
     │
     ▼
[Finding 2.1: Master pattern cutters cannot be tracked, assigned, or paid]
[Finding 2.2: All garments inserted with assigned_tailor_id = NULL; tailors earn 0 commission]
     │
     ▼
[Observation 4: database.cjs:3843 queries o.rush_order instead of o.is_urgent]
[Observation 5: Staff.jsx:60 calls window.api.getPayroll instead of window.api.tailor.getPayroll]
     │
     ▼
[Finding 3.1: Tailor payroll crashes with SqliteError: no such column: o.rush_order]
[Finding 3.2: Staff payroll tab crashes with TypeError: window.api.getPayroll is not a function]
     │
     ▼
[Observation 6: products.length_available is scalar; useTailorPos hardcodes 3.5m]
     │
     ▼
[Finding 4.1: Book inventory diverges rapidly from physical bolts (child thobes vs adult vs sirwal)]
[Finding 4.2: Lack of fabric_rolls prevents tracking dye lots, bolt remnants, and waste]
     │
     ▼
[Observation 7: useTailorPos checks searchPhone.length >= 10; Saudi numbers are 9 digits]
[Observation 8: res[0] is blindly assigned on multi-match]
     │
     ▼
[Finding 5.1: 9-digit local phone entries produce no search results, causing duplicate customer creation]
[Finding 5.2: Shared family numbers result in silent data corruption across customer accounts]
     │
     ▼
[Observation 9: Measurement schema is rigid 8 fields; saveProfile called unconditionally on checkout]
     │
     ▼
[Finding 6.1: Bespoke suits and Saudi Thobe specifications cannot be captured]
[Finding 6.2: Temporary order-specific alterations permanently destroy customer master baseline]
     │
     ▼
[Observation 10: No tailor_defects table, OrdersBoard lacks QC stage, alteration_tickets drops linked_order_id]
     │
     ▼
[Finding 7.1: Zero quality assurance traceability; defect penalties cannot be deducted from payroll]
```

---

## 3. Caveats

1. **ZATCA Integration Scope**: This report focuses on R2 and R3. While ZATCA compliance on tailor receipts was identified in `comprehensive_app_review.md` (and observed in `useTailorPos.jsx:500–538`), the cryptographic signing engine (`zatca_phase2_impl.cjs`) belongs to R1 and is assumed to be handled by the ZATCA explorer/implementer.
2. **Backward Compatibility**: Migrating `tailor_order_garments` to include `assigned_cutter_id` and `measurements_json` must use `try { db.exec(...) } catch(e) {}` blocks so existing customer SQLite databases upgrade without schema loss.
3. **No External Microservices**: All proposed solutions preserve the local-first, self-contained architecture of the desktop app (Electron + SQLite + React).

---

## 4. Conclusion & Proposed Implementation Blueprint

To make R2 and R3 production-ready, the implementer must make the following surgical changes:

### 4.1 Financial Integrity Fix (`completeTailorOrder`)
In `electron/database.cjs:3786–3795`, replace `completeTailorOrder` with an atomic double-entry transaction:
```javascript
function completeTailorOrder({ order_id, payment_method, balance_paid, staff_id }) {
    return db.transaction(() => {
        const order = db.prepare('SELECT * FROM tailor_orders WHERE id = ?').get(order_id);
        if (!order) throw new Error('Order not found: ' + order_id);

        const amountToPay = balance_paid !== undefined ? parseFloat(balance_paid) : parseFloat(order.balance_due || 0);

        // Update tailor_orders balances and delivery status
        db.prepare(`
            UPDATE tailor_orders 
            SET status = 'delivered',
                balance_due = MAX(0, balance_due - ?),
                deposit_paid = deposit_paid + ?
            WHERE id = ?
        `).run(amountToPay, amountToPay, order_id);

        // Post Double-Entry Journal Entry if balance settled
        if (amountToPay > 0) {
            const isCash = !payment_method || ['cash', 'نقدي', 'نقد', 'Cash'].includes(payment_method);
            const debitAccount = isCash ? 1111 : 1112; // 1111 Cash in Hand, 1112 Bank / Mada
            const ref = `سداد رصيد استلام طلب خياطة #${order_id}`;
            const today = new Date().toISOString().split('T')[0];

            // Insert into ledger_entries
            db.prepare(`
                INSERT INTO ledger_entries (account_code, description, debit, credit, reference)
                VALUES (?, ?, ?, 0, ?)
            `).run(debitAccount, ref, amountToPay, ref);

            db.prepare(`
                INSERT INTO ledger_entries (account_code, description, debit, credit, reference)
                VALUES (1200, ?, 0, ?, ?)
            `).run(ref, amountToPay, ref);

            // Update account balances
            db.prepare('UPDATE accounts SET balance = balance + ? WHERE account_code = ?').run(amountToPay, debitAccount);
            db.prepare('UPDATE accounts SET balance = balance - ? WHERE account_code = 1200').run(amountToPay);

            // Update open shift if one exists
            const openShift = getOpenShift();
            if (openShift) {
                if (isCash) {
                    db.prepare('UPDATE shifts SET cash_sales = IFNULL(cash_sales, 0) + ? WHERE id = ?').run(amountToPay, openShift.id);
                } else {
                    db.prepare('UPDATE shifts SET card_sales = IFNULL(card_sales, 0) + ? WHERE id = ?').run(amountToPay, openShift.id);
                }
            }
        }

        return { success: true };
    })();
}
```

### 4.2 Cutter Role Schema & Assignment
1. **Schema Migration in `electron/database.cjs`:**
   ```javascript
   try { db.exec(`ALTER TABLE tailor_order_garments ADD COLUMN assigned_cutter_id INTEGER REFERENCES staff(id)`); } catch(e) {}
   try { db.exec(`ALTER TABLE tailor_order_garments ADD COLUMN measurements_json TEXT`); } catch(e) {}
   try { db.exec(`ALTER TABLE staff ADD COLUMN cutter_piece_rate REAL DEFAULT 0`); } catch(e) {}
   ```
2. **Update `createTailorOrder` (`database.cjs:3565–3589`):**
   ```javascript
   const insertGarment = db.prepare(`
       INSERT INTO tailor_order_garments
           (tailor_order_id, garment_type, fabric_id, production_stage, assigned_tailor_id, assigned_cutter_id, special_instructions, measurements_json)
       VALUES (?, ?, ?, 'cutting', ?, ?, ?, ?)
   `);
   ...
   insertGarment.run(
       orderId, g.garment_type, g.fabric_id || null,
       g.assigned_tailor_id || null, g.assigned_cutter_id || null,
       g.special_instructions || null,
       g.measurements ? JSON.stringify(g.measurements) : null
   );
   ```
3. **Expose `assignGarmentWorker` in `database.cjs` and `preload.cjs`:**
   ```javascript
   function assignGarmentWorker({ garment_id, tailor_id, cutter_id }) {
       return db.prepare(`
           UPDATE tailor_order_garments
           SET assigned_tailor_id = COALESCE(?, assigned_tailor_id),
               assigned_cutter_id = COALESCE(?, assigned_cutter_id)
           WHERE id = ?
       `).run(tailor_id || null, cutter_id || null, garment_id);
   }
   ```
4. **Update `useTailorPos.jsx:435–459`:**
   Pass `assigned_tailor_id: tailorId || null` and `assigned_cutter_id: cutterId || null` in each item of `garmentsList`.
5. **Update `TailorPos.jsx` and `OrdersBoard.jsx`:**
   Add Cutter dropdown in `TailorPos.jsx` alongside Tailor, and render worker badges on Kanban cards in `OrdersBoard.jsx`.

### 4.3 Tailor & Cutter Payroll Hotfixes
1. **Fix SQL in `electron/database.cjs:3843`:**
   ```javascript
   function getTailorPayroll({ start_date, end_date } = {}) {
       let sql = `
           SELECT g.assigned_tailor_id, s.name as tailor_name, s.piece_rate,
                  COUNT(g.id) as pieces_completed,
                  SUM(CASE WHEN o.is_urgent = 1 THEN COALESCE(o.urgent_fee, 10) ELSE 0 END) as bonuses
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
           base_commission: (r.pieces_completed || 0) * (r.piece_rate || 0),
           bonuses: r.bonuses || 0,
           total_payout: ((r.pieces_completed || 0) * (r.piece_rate || 0)) + (r.bonuses || 0)
       }));
   }
   ```
2. **Add `getCutterPayroll` in `electron/database.cjs`:**
   ```javascript
   function getCutterPayroll({ start_date, end_date } = {}) {
       let sql = `
           SELECT g.assigned_cutter_id, s.name as cutter_name, 
                  COALESCE(s.cutter_piece_rate, s.piece_rate, 0) as piece_rate,
                  COUNT(g.id) as pieces_completed,
                  SUM(CASE WHEN o.is_urgent = 1 THEN 5 ELSE 0 END) as bonuses
           FROM tailor_order_garments g
           JOIN tailor_orders o ON g.tailor_order_id = o.id
           LEFT JOIN staff s ON g.assigned_cutter_id = s.id
           WHERE g.assigned_cutter_id IS NOT NULL
       `;
       const params = [];
       if (start_date && end_date) {
           sql += ` AND date(o.order_date) BETWEEN ? AND ?`;
           params.push(start_date, end_date);
       }
       sql += ` GROUP BY g.assigned_cutter_id`;
       return db.prepare(sql).all(params).map(r => ({
           ...r,
           name: r.cutter_name,
           base_commission: (r.pieces_completed || 0) * (r.piece_rate || 0),
           bonuses: r.bonuses || 0,
           total_payout: ((r.pieces_completed || 0) * (r.piece_rate || 0)) + (r.bonuses || 0)
       }));
   }
   ```
3. **IPC Bridge Alignment (`electron/preload.cjs`):**
   In `preload.cjs`, expose `getPayroll: (d) => ipcRenderer.invoke('tailor:getPayroll', d)` directly on `window.api` as well as under `window.api.tailor`.
4. **Update `src/pages/Staff.jsx:60`:**
   Change to `const data = await (window.api?.tailor?.getPayroll || window.api?.getPayroll)?.({ start_date: startDate, end_date: endDate });`.

### 4.4 Fabric Roll-Level Inventory & Dynamic Consumption
1. **Schema Addition (`fabric_rolls` table in `electron/database.cjs`):**
   ```sql
   CREATE TABLE IF NOT EXISTS fabric_rolls (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       roll_code TEXT UNIQUE NOT NULL,
       dye_lot TEXT,
       roll_width_inches REAL DEFAULT 58.0,
       initial_meters REAL NOT NULL,
       remaining_meters REAL NOT NULL,
       status TEXT DEFAULT 'active',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. **Dynamic Consumption Formula (`src/hooks/useTailorPos.jsx`):**
   Replace hardcoded `3.5` with:
   ```javascript
   function estimateFabricConsumption(garmentType, measurements, fabricWidth = 58) {
       const len = parseFloat(measurements?.length || 58);
       const sleeve = parseFloat(measurements?.sleeve || 24);
       const widthFactor = fabricWidth >= 54 ? 1.0 : 1.45; // 58" double width vs 36" single width

       if (garmentType === 'sirwal' || garmentType === 'سروال') {
           return parseFloat(((len + 15) / 39.37 * 1.1).toFixed(2)); // ~1.3-1.5m
       }
       if (garmentType === 'shirt' || garmentType === 'قميص') {
           return parseFloat(((len + sleeve + 10) / 39.37 * 1.0).toFixed(2)); // ~2.0-2.2m
       }
       if (garmentType === 'bisht' || garmentType === 'بشت') {
           return 5.5;
       }
       // Standard Thobe: (Length + Sleeve + Hem Allowance 15cm) / 100 * widthFactor
       // Assuming input in inches: 1 inch = 2.54 cm
       const totalInches = len + sleeve + 6;
       const meters = (totalInches * 0.0254) * widthFactor;
       return parseFloat(Math.max(1.8, Math.min(6.0, meters)).toFixed(2));
   }
   ```
3. Record fabric movement in `stock_history` when consumed.

### 4.5 Customer Phone Search Normalization
1. **Relax Gate in `src/hooks/useTailorPos.jsx:230–232`:**
   ```javascript
   const handlePhoneSearch = useCallback(async (searchPhone) => {
       const clean = (searchPhone || '').replace(/\D/g, '');
       if (clean.length >= 7) { // Support 9-digit Saudi mobile, 10-digit with 0, and landlines
           try {
               const res = await window.api?.getCustomers?.({ search: clean });
               if (res && res.length === 1) {
                   setCustomer(res[0]);
                   setName(res[0].name);
                   ...
               } else if (res && res.length > 1) {
                   setMultiMatches(res); // Present disambiguation picker
               }
           ...
   ```
2. **Sanitize Query in `electron/database.cjs:2596–2609` (`getCustomers`):**
   When `filters.search` contains digits, strip leading zero and search for both `clean` and `0${clean}`:
   ```javascript
   const digits = filters.search.replace(/\D/g, '').replace(/^0+/, '');
   if (digits.length >= 5) {
       sql += ' AND (phone LIKE ? OR phone LIKE ? OR phone LIKE ?)';
       params.push(`%${digits}%`, `%0${digits}%`, `%966${digits}%`);
   }
   ```

### 4.6 Bespoke Measurement Schema & Baseline Protection
1. **Garment-Specific Schemas (`src/pages/MeasurementCapture.jsx` and `TailorPos.jsx`):**
   Define schemas per garment:
   - **Thobe:** `length`, `shoulder`, `chest`, `waist`, `sleeve`, `neck`, `wrist`, `bottom_flare` (وسع الدائر), `khaban` (الخبن), `collar_height` (ارتفاع القلاب), `jabzor` (الجبزور).
   - **Suit:** `jacket_length`, `chest_half`, `waist`, `shoulder`, `sleeve_crown`, `lapel_width`, `lapel_type`, `trouser_outseam`, `trouser_inseam`, `crotch_rise`, `thigh`, `knee`.
   - **Sirwal:** `length`, `waist`, `hip`, `crotch_rise`, `ankle_opening`.
2. **Master Profile Protection Toggle (`src/pages/TailorPos.jsx`):**
   Add a checkbox:
   `[x] تعديل مؤقت لهذا الطلب فقط (لا تعدل المقاس الأساسي للعميل)` (`isTempAdjustment`).
   When checked:
   - Save measurements ONLY in `tailor_order_garments.measurements_json`.
   - Skip `saveTailorProfile` call so the customer's permanent baseline is never altered.

### 4.7 QA / Defect Tracking Workflow
1. **Schema Migration (`tailor_defects` table in `electron/database.cjs`):**
   ```sql
   CREATE TABLE IF NOT EXISTS tailor_defects (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       garment_id INTEGER NOT NULL REFERENCES tailor_order_garments(id) ON DELETE CASCADE,
       order_id INTEGER REFERENCES tailor_orders(id),
       stage TEXT NOT NULL,
       defect_type TEXT NOT NULL,
       description TEXT,
       responsible_staff_id INTEGER REFERENCES staff(id),
       responsible_role TEXT,
       severity TEXT DEFAULT 'minor',
       penalty_amount REAL DEFAULT 0,
       rework_status TEXT DEFAULT 'pending',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       resolved_at DATETIME
   );
   ```
2. **QC Stage in Kanban (`src/pages/OrdersBoard.jsx`):**
   Insert `{ id: 'qc', label: 'فحص الجودة', icon: '🔍', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: '#06b6d4' }` between `finishing` and `ironing`.
3. **Defect Modal:** When moving backward from QC or logging a flaw, open a modal capturing `defect_type`, `responsible_staff_id`, and `penalty_amount`.
4. **Payroll Deduction:** In `getTailorPayroll` and `getCutterPayroll`, deduct penalties from net commission.
5. **Fix Alteration Tickets (`database.cjs:3866–3884`):**
   Include `linked_order_id` in `createAlterationTicket`.

---

## 5. Verification Method

To independently verify these findings and confirm subsequent implementation:

1. **Verify Database File & Syntax:**
   Inspect SQLite schema in `electron/database.cjs:626–656` and `electron/database.cjs:3786–3795`:
   - Run grep for `completeTailorOrder`: confirm zero references to `ledger_entries` or `accounts`.
   - Run grep for `rush_order`: confirm line 3843 queries nonexistent column `o.rush_order`.
2. **Verify Frontend Preload / API Mismatch:**
   - Check `electron/preload.cjs:382`: confirms `getPayroll` is inside `tailor: {}`.
   - Check `src/pages/Staff.jsx:60`: confirms naked call `window.api.getPayroll`.
3. **Verify Phone Search Gate:**
   - Check `src/hooks/useTailorPos.jsx:231`: confirm `if (searchPhone.length >= 10)`.
4. **Verify Dynamic Measurement & Profile Protection:**
   - Check `src/hooks/useTailorPos.jsx:467–474`: confirm unconditional `saveProfile` loop.
   - Check `src/pages/MeasurementCapture.jsx:13–22`: confirm rigid 8-field array.
5. **Post-Implementation Test Execution:**
   - Execute database unit tests:
     `npx cross-env ELECTRON_RUN_AS_NODE=1 npx electron tests/unit_tests_db.cjs`
   - Test order delivery balance posting: call `db.completeTailorOrder({ order_id: 1, payment_method: 'cash', balance_paid: 50 })` and verify `SELECT * FROM ledger_entries WHERE reference LIKE '%طلب خياطة #1%'` returns 2 balanced lines (Dr 1111 50, Cr 1200 50).
   - Test payroll query execution: call `db.getTailorPayroll()` and verify it executes cleanly without `SqliteError`.
