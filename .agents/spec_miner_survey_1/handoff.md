# Handoff Report: Production Readiness Specification Mining (R1, R2, R3)

**Author:** Teamwork Spec Miner  
**Working Directory:** `c:\my-pos\V4\.agents\spec_miner_survey_1`  
**Target Application:** Smart Touch POS (`my-pos/V4`) — Tailor & Apparel POS  
**Date:** 2026-09-11  
**Authoritative Contracts:** `c:\my-pos\V4\comprehensive_app_review.md` & `c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md`

---

## 1. Observation

Direct forensic inspection of the codebase confirmed the following exact defects, line numbers, schema gaps, and architectural disconnects across Requirements R1, R2, and R3:

### 1.1 R1: ZATCA Compliance & Critical Security Fixes
* **Boot PIN Reset Backdoor (`electron/database.cjs:869–886`):**
  On every application startup, `initDatabase()` executes:
  ```javascript
  const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
  if (adminUser) {
      db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
  }
  const cashierUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'cashier'").get();
  if (cashierUser) {
      db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('0000'), cashierUser.id);
  }
  ```
  Every reboot unconditionally overwrites Admin PIN to `'1234'` and Cashier PIN to `'0000'`.
* **Weak Static-Salt PIN Hashing (`electron/database.cjs:30–32`):**
  ```javascript
  function hashPin(pin) {
      return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
  }
  ```
  Uses a single hardcoded salt across all users. For 4-digit PINs (0000–9999), a rainbow table can be precomputed in <50ms.
* **Arbitrary Local File Read Vulnerability (`electron/main.cjs:782–788`):**
  ```javascript
  ipcMain.handle('tailor:readAttachment', (e, filePath) => {
      try {
          return { success: true, base64: 'data:image/jpeg;base64,' + fs.readFileSync(filePath).toString('base64') };
      } catch(err) {
          return { success: false, error: err.message };
      }
  });
  ```
  Accepts raw `filePath` without directory sandboxing, path resolution checks, or permission validations, allowing full exfiltration of host OS files.
* **Plaintext Master HMAC License Secret (`electron/main.cjs:9`):**
  ```javascript
  const _LICENSE_SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b";
  ```
  Hardcoded cryptographic HMAC key in source code enables unauthorized offline generation of valid enterprise licenses.
* **Zero Backend Role-Based IPC Authorization (`electron/main.cjs:336–343`):**
  ```javascript
  function _gated(fn) {
      return async (e, ...args) => {
          if (!_isLicenseActive()) {
              return { success: false, error: 'LICENSE_REQUIRED', message: '...' };
          }
          return fn(e, ...args);
      };
  }
  ```
  `_gated` validates license presence only. No session token, user ID, or user role is checked on IPC handlers (`db:deleteStaff`, `settings:save`, `acct:postJournalEntry`, `db:voidSale`).
* **Non-Compliant Tailor POS Thermal Receipt (`src/hooks/useTailorPos.jsx:481–548`):**
  Tailor checkout builds a raw HTML string printed via `window.open` / `printHTML`:
  - Contains **NO QR code** (0 tags).
  - Omits seller's 15-digit Tax Identification Number (TIN).
  - Uses illegal header title `"فاتورة خياطة تفصيل"` instead of `"فاتورة ضريبية مبسطة"`.
  - Uses fake invoice sequence `#${res?.order_id || invoiceNumber}` instead of the official ZATCA sequential invoice number.
  - Omits cryptographic stamp, hash, and UUID.
  - Contrast: Standard retail POS (`src/pages/Pos.jsx:896–1050, 1400–1520`) renders full ZATCA Phase 2 compliance with 9-tag BER-TLV QR codes generated via `window.api.getZatcaTLV` and `window.api.generateQR`.

### 1.2 R2: Financial Integrity & Workforce Schema
* **Pickup Balance "Accounting Black Hole" (`electron/database.cjs:3786–3795`):**
  When garments are marked delivered in `OrdersBoard.jsx:145–164`, `completeTailorOrder` executes:
  ```javascript
  function completeTailorOrder({ order_id, payment_method, balance_paid }) {
      const order = db.prepare(`SELECT * FROM tailor_orders WHERE id = ?`).get(order_id);
      if (!order) throw new Error('Order not found: ' + order_id);
      db.prepare(`UPDATE tailor_orders SET status = 'delivered', balance_due = 0, deposit_paid = total_amount WHERE id = ?`).run(order_id);
      return { success: true };
  }
  ```
  `balance_paid` and `payment_method` are completely ignored. **ZERO General Ledger entries are posted**. Cash accounts are not debited, Accounts Receivable is not credited, and active cash drawer shifts are not updated.
* **False Delivery Invoice Promise (`src/pages/OrdersBoard.jsx:672`):**
  Modal button is labeled `"✓ تأكيد التسليم وإصدار الفاتورة"`, but triggers no invoice generation, no thermal printing, and no ZATCA document.
* **100% Off-the-Books Alteration Revenue (`electron/database.cjs:3864–3905`, `src/pages/Alterations.jsx:140, 264`):**
  `createAlterationTicket` inserts into `alteration_tickets` and `alteration_items` only. It generates no record in `sales`, no entry in `ledger_entries`, no VAT output booking, and no cash drawer update upon balance settlement.
* **Tailor Payroll SQL Crash (`electron/database.cjs:3843`):**
  `getTailorPayroll` queries:
  ```sql
  SUM(CASE WHEN o.rush_order = 1 THEN 10 ELSE 0 END) as rush_bonuses
  ```
  In `tailor_orders` (`database.cjs:635`), the column name is `is_urgent INTEGER DEFAULT 0`. Calling `getTailorPayroll` immediately throws `SqliteError: no such column: o.rush_order`.
* **Frontend Payroll API Namespace Mismatch (`src/pages/Staff.jsx:60` vs `preload.cjs:382`):**
  In `preload.cjs:382`, the handler is `tailor: { getPayroll: (d) => ipcRenderer.invoke('tailor:getPayroll', d) }`. But `Staff.jsx:60` invokes `window.api.getPayroll(...)`. Throws `TypeError: window.api.getPayroll is not a function`.
* **Unassigned Garments at POS Checkout (`src/hooks/useTailorPos.jsx:435–459`, `database.cjs:3587`):**
  `garmentsList` omits `assigned_tailor_id`. Garments are saved with `assigned_tailor_id = NULL`. As a result, piece-rate calculation groups by NULL and yields zero completed pieces for all tailors.
* **Complete Absence of the Cutter (المفصل) Role:**
  In `database.cjs:646–656` (`tailor_order_garments`), only `assigned_tailor_id` exists. There is no `assigned_cutter_id`. In `database.cjs:448` (`staff`), there is no `cutter_piece_rate`. In `TailorPos.jsx:29`, only tailor assignment exists. Cutters cannot be assigned, tracked, or paid.
* **Absence of Payroll Settlement Persistence:**
  Generating payroll in `Staff.jsx:140–176` opens a temporary print window without persisting settlements to a database table or flagging garments with `is_settled`. Rerunning payroll recalculates already paid garments, risking double payouts. No labor expense journal entry is booked (Debit 5100 Direct Labor, Credit 1111 Cash).
* **Hardcoded 3.5m Fabric Consumption & No Roll-Level Tracking (`src/hooks/useTailorPos.jsx:442`, `database.cjs:3597`):**
  ```javascript
  fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5
  ```
  Deducts 3.5m regardless of garment type (child thobe ~1.8m, trousers ~1.5m, bisht ~6.0m). There is no `fabric_rolls` table for roll barcodes, dye lots, or roll width. Deductions update `products.length_available` but never update `products.stock` or `stock_movements`.

### 1.3 R3: Customer Lifecycle & Domain Logic Refactoring
* **10-Digit Phone Search Gate & Arbitrary First Match (`src/hooks/useTailorPos.jsx:230–238`):**
  ```javascript
  if (searchPhone.length >= 10) {
      const res = await window.api?.getCustomers?.({ search: searchPhone });
      if (res && res.length > 0) {
          const c = res[0];
          setCustomer(c);
  ```
  Local 9-digit Saudi numbers (`50xxxxxxx`) do not trigger search. Multiple matches arbitrarily select `res[0]` without a user disambiguation prompt.
* **Missing Name Autocomplete in Tailor POS (`src/pages/TailorPos.jsx`):**
  Customer name input is a static text field without search/autocomplete, forcing cashiers to navigate away to `/customers`.
* **Tailoring CRM Blind Spot (`electron/database.cjs:2625–2637`):**
  `getCustomerHistory(customerId)` only selects from `sales`, ignoring `tailor_orders`, `tailor_order_garments`, and `alteration_tickets`.
* **Destructive Master Profile Overwrite (`src/hooks/useTailorPos.jsx:467–474`, `database.cjs:3590`):**
  Every order submission automatically invokes `saveProfile`, overwriting the permanent baseline profile with temporary garment adjustments.
* **Rigid 8-Field Measurement Schema (`src/pages/MeasurementCapture.jsx:14–22`):**
  Hardcoded 8 fields for all garments. Suits lack lapel, jacket length, sleeve crown, trouser outseam/inseam, rise, thigh, knee. Thobes lack bottom flare (وسع الدائر), Khaban (الخبن), Jabzor (الجبزور), collar height. Sirwals display irrelevant neck/shoulder fields.
* **Missing Barcodes on Physical Work Tickets (`src/components/TailorWorkOrder.jsx:484–487`):**
  Ticket renders plain text `# {invoiceNumber}` without scannable Code 128 or QR barcode.
* **Absence of Quality Control (QC) Checkpoint (`src/pages/OrdersBoard.jsx:8–14`):**
  Pipeline jumps from `finishing` -> `ironing` -> `ready`. No QC stage exists. No defect tracking (`tailor_defects`) or worker penalty deduction mechanism exists.
* **Unlinked Alteration Tickets (`electron/database.cjs:3866–3884`, `src/pages/Alterations.jsx`):**
  `createAlterationTicket` omits `linked_order_id` in SQL INSERT. UI does not provide order search/linking.
* **Unregistered Label Printer IPC Handlers (`electron/main.cjs:11`, `electron/hardware.cjs:352`):**
  `main.cjs` imports `./hardware.cjs` but never calls `hardware.registerLabelIPC(db)`. Frontend calls to `hw:getPrinters` throw unhandled exceptions.
* **Missing Cash Drawer Handlers (`src/features/pos/hooks/useHardware.js:58`, `src/pages/Alterations.jsx:146`):**
  `window.api.kickDrawer` and `window.api.openCashDrawer` are called in frontend components but do not exist in `preload.cjs` or `main.cjs`.
* **Shift Closing Ignores Petty Cash (`electron/database.cjs:2880`):**
  `expectedCash = (shift.starting_cash || 0) + cashSales;` fails to subtract petty cash payouts, reporting false cash shortages.
* **Anonymous Audit Logs (`electron/database.cjs:464, 2945`):**
  `addAuditLog` accepts only `action` and `details`, omitting `user_id`. Audit log UI displays `#?` for staff.

---

## 2. Logic Chain

1. **Regulatory Non-Compliance Risk:**
   - Under ZATCA Phase 2 electronic invoicing regulations in Saudi Arabia, B2C thermal tax invoices must include the seller's 15-digit TIN, simplified tax invoice header, sequential tax invoice number, and a 9-tag BER-TLV QR code containing cryptographic hash and signature.
   - Because `useTailorPos.jsx` generates a non-compliant slip lacking these fields while the retail engine already implements them, refactoring `useTailorPos.jsx` to utilize the shared ZATCA generator (`getZatcaTLV` / `generateZatcaTLV9`) immediately brings the tailoring module into regulatory compliance.
2. **Security Vulnerability Exploitation Path:**
   - The boot script unconditionally resetting Admin PIN to `'1234'` guarantees that any staff member with physical or remote access can restart the app and gain full administrative privileges.
   - The uncontained file read in `tailor:readAttachment` combined with lack of IPC role checks allows an unprivileged client to read sensitive database and OS files.
   - Removing the boot overwrite and wrapping IPC handlers in session-based role checks eliminates this entire attack surface.
3. **Financial Accounting Leakage:**
   - When a tailor order is created with a deposit, `saveSale` records the transaction. However, when the final balance is paid upon pickup, `completeTailorOrder` sets `balance_due = 0` without debiting Cash or crediting Accounts Receivable.
   - Similarly, alteration fees are never passed through `saveSale` or posted to revenue accounts.
   - Unifying `completeTailorOrder` and `createAlterationTicket` with double-entry journal entries restores complete financial integrity to the General Ledger and register shifts.
4. **Workforce Compensation Breakdown:**
   - Piece-rate payroll calculation relies on grouping `tailor_order_garments` by worker ID and checking urgency bonuses.
   - Because garments are saved with `assigned_tailor_id = NULL`, the query checks nonexistent `o.rush_order` instead of `o.is_urgent`, and the UI calls an undefined namespace, payroll fails at every layer.
   - Correcting the SQL column name, fixing the preload IPC namespace, capturing worker assignments at POS, adding the Cutter role, and persisting payroll settlement records resolves the entire compensation pipeline.
5. **Tailoring Domain Architecture:**
   - Bespoke tailoring differs fundamentally from fixed-SKU retail. Fabrics are cut dynamically from physical bolts; measurements differ by garment type; and order-specific adjustments must not corrupt permanent customer profiles.
   - Introducing roll-level inventory, garment-specific measurement schemas, temporary adjustment flags, workshop barcodes, and QC defect tracking elevates `my-pos/V4` into a domain-native bespoke solution.

---

## 3. Caveats

1. **Hardware Device Availability:** Physical thermal printers (ESC/POS 80mm), ZPL label printers, and RJ11 cash drawers were audited via software interfaces and IPC handlers. Physical hardware verification requires connecting actual USB/serial peripherals.
2. **Native Module Rebuild for CLI Tests:** `better-sqlite3` is currently compiled for Electron ABI 110 (Node 16). Running tests via standard system Node (Node 22 / ABI 127) requires either executing tests within the Electron runtime (`ELECTRON_RUN_AS_NODE=1 npx electron tests/unit_tests_db.cjs`) or running `npm run rebuild`.
3. **Third-Party Integrations:** SMS/WhatsApp notifications currently rely on URI schemes (`wa.me/`). Direct server-side API dispatch requires external gateway credentials.

---

## 4. Conclusion

`my-pos/V4` possesses a sophisticated architectural core (ZATCA Phase 2 ECDSA signing engine, double-entry accounting ledger, CRDT sync foundation, and rich UI components), but suffers from critical integration disconnects and hardcoded shortcuts that render it commercial non-viable.

By executing the targeted 5-Phase remediation blueprint outlined below—eliminating security backdoors, unifying tailor receipts with the compliant ZATCA engine, closing financial black holes in pickup balances and alterations, formalizing the Cutter and QC roles, and implementing dynamic fabric and measurement schemas—the application will achieve full production readiness and benchmark status.

---

## 5. Verification Method

### 5.1 Automated & Scripted Verification Commands
```bash
# 1. Verify build health
npx vite build

# 2. Execute unit tests within Electron runtime (matching Node ABI 110)
npx cross-env ELECTRON_RUN_AS_NODE=1 npx electron tests/unit_tests_db.cjs

# 3. Verify ZATCA Phase 2 TLV-9 and cryptographic signing test suite
node tests/zatca_compliance_test.js
```

### 5.2 Specific Files & Invalidation Conditions to Inspect
* **Boot Backdoor Elimination:** Inspect `electron/database.cjs:869–886`. Verify no unconditional `UPDATE staff SET pin = ...` runs during `initDatabase`.
* **ZATCA Thermal Receipt:** Inspect `src/hooks/useTailorPos.jsx:481–548`. Verify receipt includes `generateQR`, seller VAT number, and "فاتورة ضريبية مبسطة".
* **Pickup Settlement Ledger Entry:** Inspect `electron/database.cjs:3786–3795`. Verify `completeTailorOrder` inserts into `ledger_entries` (Dr. 1111/1112, Cr. 1200).
* **Tailor Payroll SQL Query:** Inspect `electron/database.cjs:3843`. Verify query uses `o.is_urgent` instead of `o.rush_order`.
* **Frontend Payroll Invocation:** Inspect `src/pages/Staff.jsx:60`. Verify call invokes `window.api.tailor.getPayroll`.
* **Cutter Schema:** Inspect `electron/database.cjs:646–656`. Verify `assigned_cutter_id INTEGER` is present on `tailor_order_garments`.
* **Arbitrary File Access Sandbox:** Inspect `electron/main.cjs:782–788`. Verify `tailor:readAttachment` validates that paths reside inside `app.getPath('userData')/attachments`.

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Security | Emergency PIN Reset Backdoor | Hardcoded startup script resetting Admin to '1234' and Cashier to '0000' | App launch event | Overwritten PIN hashes in `staff` | Erases user-configured security credentials silently | `electron/database.cjs:869–886` |
| 2 | Security | Static Salt PIN Hasher | Hashes 4-digit PINs with single static string `'pos-salt-2026-'` | 4-digit PIN string | 64-char SHA-256 hex | Trivial rainbow table vulnerability | `electron/database.cjs:30–32` |
| 3 | Security | Attachment File Server | IPC handler reading host files and returning Base64 data URL | Arbitrary `filePath` | `{ success: true, base64 }` | Arbitrary local file traversal vulnerability | `electron/main.cjs:782–788` |
| 4 | Security | IPC License Gate | Gating middleware checking active software subscription | IPC call, license cache | Proceeds or returns `LICENSE_REQUIRED` | Performs zero user authentication or role checks | `electron/main.cjs:336–343` |
| 5 | Compliance | Tailor Thermal Receipt | Generates raw HTML thermal receipt for tailor orders | Order details, customer info | Printed HTML window | Non-compliant: 0 QR tags, missing VAT number, illegal header | `src/hooks/useTailorPos.jsx:481–548` |
| 6 | Compliance | Retail ZATCA Receipt | Compliant 80mm & A4 tax invoice generator | `invoiceObj`, `settings` | Formatted invoice with 9-tag QR | Fully compliant reference implementation | `src/pages/Pos.jsx:896–1050, 1400–1520` |
| 7 | Accounting | Final Order Pickup Completion | Marks tailor order delivered upon final balance payment | `{ order_id, payment_method, balance_paid }` | `{ success: true }` | Accounting black hole: zero GL journal entries posted | `electron/database.cjs:3786–3795` |
| 8 | Accounting | Partial Order Payment | Records deposit/payment for tailor orders | `order_id, amount_paid, payment_method` | `{ success: true }` | Properly posts Dr 1111/1112, Cr 1200 | `electron/database.cjs:3711–3735` |
| 9 | Accounting | Alteration Ticket Creation | Records alteration tickets and fee items | `customer_id, items, total_fee, deposit` | `{ success: true, ticket_id }` | Off-the-books: zero sales, zero GL entries, omits `linked_order_id` | `electron/database.cjs:3864–3884` |
| 10 | Workforce | Tailor Payroll Engine | Aggregates completed pieces and rush bonuses per tailor | `start_date, end_date` | Array of tailor payout summaries | Fatal crash: `SqliteError: no such column: o.rush_order` | `electron/database.cjs:3839–3860` |
| 11 | Workforce | Staff Payroll UI | Frontend view displaying tailor piece-rate earnings | Date range filters | Rendered payroll table | Fatal crash: calls undefined `window.api.getPayroll` | `src/pages/Staff.jsx:60` |
| 12 | Workforce | Cutter Role Assignment | Role for master pattern cutters in bespoke shops | Staff role selection | Cutter profile | Schema gap: omitted from `tailor_order_garments` | `src/pages/Staff.jsx:408`, `database.cjs:646` |
| 13 | Inventory | Fabric Meter Tracking | Scalar fabric meter counter in products table | `length_available` float | Deducted meter balance | Hardcoded 3.5m consumption; no roll tracking; no stock movements | `database.cjs:697, 3597`, `useTailorPos.jsx:442` |
| 14 | Customer | Phone Search Gate | Lookup customer by phone number | `searchPhone` string | Customer object & profiles | Gate enforces `>= 10` digits; dormant on 9-digit Saudi numbers | `src/hooks/useTailorPos.jsx:230–238` |
| 15 | Customer | Master Profile Auto-Save | Auto-saves measurements on order creation | `customer_id, garment_type, measurements` | Saved profile | Destructive: overwrites permanent customer master profile | `src/hooks/useTailorPos.jsx:467–474` |
| 16 | Domain | Garment Measurement Grid | 8-field measurement capture form | Length, shoulder, chest, waist, etc. | Measurement object | Rigid schema: unusable for suits, lacks thobe/sirwal specific fields | `src/pages/MeasurementCapture.jsx:14–22` |
| 17 | Workshop | Tailor Work Order Traveler | Physical job ticket printed for tailors | Order, customer, garment config | Printed paper card | Missing Code 128 / QR barcode for scanner workflows | `src/components/TailorWorkOrder.jsx:484–487` |
| 18 | Workshop | Orders Kanban Board | 5-stage workshop production board | Stage drag-and-drop / advance | Updated garment stage | Missing QC stage; unauthenticated stage advances | `src/pages/OrdersBoard.jsx:8–14` |
| 19 | Hardware | Label Printer Integration | Direct ZPL / ESC-POS barcode and shelf label printing | ZPL payload, printer name | Hardware print job | Unregistered: `hardware.registerLabelIPC` never called in `main.cjs` | `electron/hardware.cjs:352`, `main.cjs:11` |
| 20 | Hardware | Cash Drawer Trigger | Sends kick signal to RJ11 cash drawer via printer | Kick command | Drawer open pulse | Missing IPC endpoints (`kickDrawer`, `openCashDrawer`) | `useHardware.js:58`, `Alterations.jsx:146` |
| 21 | Operations | Register Shift Closing | Closes register shift and compares expected vs counted cash | Counted cash amount | Shift summary & variance | Ignores petty cash expenditures; false cash shortages | `electron/database.cjs:2880` |
| 22 | Security | Audit Logger | Inserts event records into audit log | `action, details` | DB record | Anonymous: ignores `user_id`, staff appears as `#?` in UI | `electron/database.cjs:464, 2945` |
| 23 | Operations | Invoice Voiding | Voids completed sales in database | `invoiceId, reason` | Voided sale status | Unrestricted: cashiers can void sales without manager PIN | `src/pages/Pos.jsx:610, 2137` |
| 24 | Operations | Agreed Total Price Override | Manual discount overriding final transaction total | Custom total price | Adjusted total | Unrestricted: cashiers can discount to 0 SAR without supervisor | `src/pages/Pos.jsx:2000–2022` |
| 25 | Domain | Fitting Appointments | Scheduling mid-production garment fittings | `customer_id, appointment_date, stage` | Appointment record | Dead feature: table exists in DB, zero UI implementation | `electron/database.cjs:685–694` |

---

## 7. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Phone Search | `501234567` (9 digits, standard Saudi mobile without 0) | Hook condition `searchPhone.length >= 10` is not met; system remains completely idle; zero DB queries fired; cashier creates duplicate profile. |
| 2 | Phone Search | Multiple customer records share the same phone number (family/duplicates) | Hook blindly binds `res[0]`; cashier cannot disambiguate; son's garment measurements booked under father's profile. |
| 3 | Order Creation | Cashier attempts checkout without an open register shift | `saveSale` throws uncaught exception `NO_OPEN_SHIFT`; order placement fails abruptly with no helpful dialog. |
| 4 | Order Creation | Multi-garment order (e.g., 3 thobes, 2 sirwals, custom buttons) | Order saved in `sales_items` as single generic line item `'تفصيل خياطة'` with lump-sum price; itemized reporting impossible. |
| 5 | Order Creation | Winter thobe with temporary 1-inch sleeve extension | Order creation auto-invokes `saveProfile`; customer's permanent standard summer baseline profile is destructively overwritten. |
| 6 | Tailor Payroll | Shop owner clicks "عرض مسير الرواتب" (View Payroll) in `/staff` | Frontend throws `TypeError: window.api.getPayroll is not a function` because handler is nested in `tailor` sub-namespace. |
| 7 | Tailor Payroll | Direct backend call to `getTailorPayroll()` | SQLite engine crashes with `SqliteError: no such column: o.rush_order` due to schema mismatch with `o.is_urgent`. |
| 8 | Tailor Payroll | Tailor completes 10 garments booked through Tailor POS | `useTailorPos.jsx` omitted `assigned_tailor_id`; all garments have `assigned_tailor_id = NULL`; tailor earnings show 0.00 SAR. |
| 9 | Tailor Payroll | Payroll generated and printed twice in the same month | Garments lack `is_settled` flag; second run displays identical garments; workers can claim duplicate payouts. |
| 10 | Order Pickup | Customer pays remaining 800 SAR balance upon garment collection | `completeTailorOrder` sets `balance_due = 0` but posts zero GL entries; 800 SAR vanishes from general ledger and cash drawer. |
| 11 | Alteration Ticket | Customer brings back thobe for sleeve shortening and pays 30 SAR | Ticket created in `alteration_tickets` but never recorded in `sales` or GL; 30 SAR collected off-the-books. |
| 12 | Alteration Ticket | Alteration created for existing workshop order | `createAlterationTicket` omits `linked_order_id` in SQL INSERT; alteration becomes an orphan record unlinked from original order. |
| 13 | Fabric Inventory | Order placed for a small child's thobe (requires 1.8 meters) | POS deducts hardcoded 3.5m from `products.length_available`; 1.7m phantom inventory deducted; stock diverges from physical bolt. |
| 14 | Fabric Inventory | Order placed for ceremonial royal bisht (requires 6.0 meters) | POS deducts hardcoded 3.5m; physical bolt consumed 6.0m; 2.5m unrecorded fabric shortage. |
| 15 | Label Printing | User clicks "طباعة الباركود" (Print Label) on product or garment | Electron main process throws unhandled rejection `No handler registered for 'hw:getPrinters'`. |
| 16 | Cash Drawer | Cashier settles alteration and toggles "فتح درج النقود" | Throws `TypeError: window.api.openCashDrawer is not a function`; cash drawer fails to open. |
| 17 | Shift Closing | Manager withdraws 200 SAR from cash drawer for petty cash / delivery | `expectedCash` does not deduct petty cash; system reports 200 SAR register shortage. |
| 18 | File Reading | Attacker invokes `tailor:readAttachment('C:\\Windows\\win.ini')` | Main process reads and Base64 encodes system file without error; arbitrary file exfiltration succeeds. |
| 19 | Security Auth | Cashier emits `ipcRenderer.invoke('db:deleteStaff', 1)` from DevTools | Backend executes deletion with zero authentication or role validation; Admin user deleted. |
| 20 | System Reboot | Shop owner updates Admin PIN to strong password and restarts app | Startup script forcibly resets Admin PIN to `'1234'` and Cashier to `'0000'`. |

---

## 8. Acceptance Criteria Mapping

| ID | User Acceptance Criterion | Target Modules / Files | Spec Status & Verification Plan |
|---|---|---|---|
| **AC-1** | Application launches without overwriting Admin PIN to '1234' or Cashier PIN to '0000'. | `electron/database.cjs:869–886` | **Mined & Mapped:** Remove lines 869–886; verify that setting a custom PIN persists across application restarts. |
| **AC-2** | Printing a Tailor POS receipt generates a compliant ZATCA Phase 2 format containing a valid BER-TLV QR code and seller VAT number. | `src/hooks/useTailorPos.jsx:481–548`, `electron/zatca_utils.cjs` | **Mined & Mapped:** Integrate `generateZatcaTLV9` and `generateQR`; verify printed receipt includes "فاتورة ضريبية مبسطة", 15-digit TIN, sequential invoice number, and 9-tag QR code. |
| **AC-3** | `ipcMain.handle('tailor:readAttachment', ...)` restricts file reads to permitted directories only. | `electron/main.cjs:782–788` | **Mined & Mapped:** Enforce `path.resolve` containment within `path.join(app.getPath('userData'), 'attachments')`; reject parent traversal (`..`). |
| **AC-4** | Completing a tailor order with a final balance payment correctly inserts double-entry records into the general ledger. | `electron/database.cjs:3786–3795`, `src/pages/OrdersBoard.jsx:145` | **Mined & Mapped:** Refactor `completeTailorOrder` to post Dr 1111/1112 (Cash/Bank) and Cr 1200 (Accounts Receivable) and update shift cash totals. |
| **AC-5** | Generating payroll for tailors executes without `SqliteError: no such column` exceptions. | `electron/database.cjs:3843`, `src/pages/Staff.jsx:60` | **Mined & Mapped:** Replace `o.rush_order` with `o.is_urgent` in SQL; update `Staff.jsx` to call `window.api.tailor.getPayroll`. |
| **AC-6** | The `tailor_order_garments` schema and frontend UI allow assigning a specific Cutter to a garment. | `electron/database.cjs:646`, `src/pages/TailorPos.jsx`, `src/pages/OrdersBoard.jsx` | **Mined & Mapped:** Execute schema migration adding `assigned_cutter_id INTEGER`; add cutter dropdown in POS and OrdersBoard. |
| **AC-7** | Searching for a customer by a 9-digit phone number correctly queries the database and returns matches. | `src/hooks/useTailorPos.jsx:230–232` | **Mined & Mapped:** Update search gate to `searchPhone.length >= 9`; apply phone normalization stripping leading zeros and international codes. |
| **AC-8** | Modifying a garment's measurements for a single order does not permanently overwrite the customer's baseline measurement profile. | `src/hooks/useTailorPos.jsx:467–474`, `electron/database.cjs:3590` | **Mined & Mapped:** Add temporary adjustment toggle; store custom measurements in `tailor_order_garments.measurements_json` without modifying `measurement_profiles`. |

---

## 9. Recommendations for Architecture and Milestones

To ensure maximum stability and zero regression during implementation, execution should be divided into 5 sequential milestones:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                RECOMMENDED IMPLEMENTATION ROADMAP                                │
├───────────────┬──────────────────────────────────────────────────────────────────────────────────┤
│ Milestone 1   │ Security & Financial Integrity Emergency Hotfixes                                │
│ (Immediate)   │ • Remove database.cjs boot backdoor PIN reset.                                   │
│               │ • Unify Tailor POS thermal receipt with compliant ZATCA Phase 2 engine.          │
│               │ • Fix pickup balance "accounting black hole" in completeTailorOrder.             │
│               │ • Fix tailor payroll SQL column (o.is_urgent) and frontend namespace.            │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Milestone 2   │ Workforce Schema & Operational Integrity (Cutters, QC & Deductions)             │
│               │ • Add assigned_cutter_id to tailor_order_garments and cutter piece-rate matrix.  │
│               │ • Create tailor_payout_records table to persist payroll settlements.             │
│               │ • Add dedicated "QC Inspection" stage on OrdersBoard.                            │
│               │ • Build tailor defect attribution and penalty deduction schema.                  │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Milestone 3   │ Textile Inventory & Dynamic Consumption Engine                                   │
│               │ • Create fabric_rolls table (roll barcodes, dye lot, width, yardage).            │
│               │ • Replace hardcoded 3.5m consumption with dynamic formula based on measurements. │
│               │ • Implement cutting waste entry modal for usable scrap vs. offcut waste.         │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Milestone 4   │ Customer Lifecycle & Bespoke Tailoring UX Hardening                              │
│               │ • Remove 10-digit phone gate; add debounced customer name autocomplete.          │
│               │ • Implement garment-specific measurement schemas (Suits, Thobes, Sirwals).       │
│               │ • Add temporary adjustment toggle to safeguard master profiles.                  │
│               │ • Link alteration tickets to orders and book alteration revenue in GL.           │
│               │ • Print scannable Code 128 barcodes on physical TailorWorkOrder traveler tickets.│
├───────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Milestone 5   │ Hardware IPC, Production Hardening & CI/CD                                       │
│               │ • Call hardware.registerLabelIPC(db) in main.cjs; implement cash drawer IPC.     │
│               │ • Enforce session-based role authorization on all sensitive IPC handlers.        │
│               │ • Sandbox tailor:readAttachment with path containment.                           │
│               │ • Optimize Vite bundle with manualChunks code splitting (<300KB initial chunk).  │
└───────────────┴──────────────────────────────────────────────────────────────────────────────────┘
```

This completes the specification survey. All findings are fully documented and verified against the authoritative codebase and review specifications.
