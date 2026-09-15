# Customer Lifecycle Evaluation Report (Requirement R1)
**Target Application:** `my-pos/V4` (Smart Touch POS / البصمة الذكية - مسار المعلم والخياطة)  
**Evaluator:** `teamwork_preview_explorer_review_1`  
**Working Directory:** `c:\my-pos\V4\.agents\teamwork_preview_explorer_review_1`  
**Report File:** `handoff.md`  
**Date:** 2026-09-11  

---

## 1. Observation

A forensic codebase inspection was conducted across the frontend React components (`src/pages`, `src/hooks`, `src/components`), the Electron main and preload processes (`electron/main.cjs`, `electron/preload.cjs`), the database layer (`electron/database.cjs`, SQLite schema), and compliance engines (`electron/zatca_phase2_impl.cjs`, `src/utils/qr-gen.js`).

The evaluation maps out the complete day-to-day customer journey across five core stages:
1. Walk-in & Customer Registration / Profile Lookup
2. Measurement Profiles & Selection
3. Tailoring & Cutting Job Assignment
4. Invoicing, Payment & ZATCA Compliance
5. Fitting, Quality Check & Final Collection

---

### STAGE 1: Walk-in & Customer Registration / Profile Lookup

#### 1. Implementation Details
* **Frontend Routing & Views**:
  * The primary walk-in order creation screen is `src/pages/TailorPos.jsx` (Route: `/tailor-pos`, declared in `src/App.jsx:337`), backed by the custom hook `src/hooks/useTailorPos.jsx`.
  * The CRM management view is `src/pages/Customers.jsx` (Route: `/customers`, `src/App.jsx:332`).
* **Customer Search Logic**:
  * In `src/hooks/useTailorPos.jsx` (lines 230–258), customer search is triggered through a phone number effect `handlePhoneSearch(searchPhone)`:
    ```javascript
    // src/hooks/useTailorPos.jsx:230-247
    const handlePhoneSearch = useCallback(async (searchPhone) => {
        if (searchPhone.length >= 10) {
            try {
                const res = await window.api?.getCustomers?.({ search: searchPhone });
                if (res && res.length > 0) {
                    const c = res[0];
                    setCustomer(c);
                    setName(c.name);
                    const profiles = await window.api?.tailor?.getMeasurements?.({ customer_id: c.id });
                    if (profiles && profiles.length > 0) {
                        const sorted = profiles.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                        setLatestProfile(sorted[0]);
                        setProfileLoaded(false);
                        showToast({ type: 'info', message: 'تم العثور على مقاسات سابقة للعميل' });
                    }
                ...
    ```
  * In `src/pages/Customers.jsx` (lines 60–69, 210–229), search is performed via `window.api.getCustomers({ search, tier })`.
* **Database & IPC Implementation**:
  * In `electron/database.cjs` (lines 2596–2609):
    ```sql
    SELECT * FROM customers WHERE 1=1 
    AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR tags LIKE ?)
    ```
  * Customer deduplication is provided in `electron/database.cjs` (lines 3681–3709) via `mergeCustomers(primary_id, duplicate_id)`, which transfers sales, orders, measurements, and appointments before deleting the duplicate customer record.
  * In `src/pages/Customers.jsx` (lines 323–325), a `GitMerge` icon button invokes `setMergePrimary(c)`, allowing a cashier to select a secondary candidate and execute `tailor.mergeCustomers`.

#### 2. Gaps, Broken Workflows & UX Friction
* **Strict 10-Digit Threshold Gate in Walk-in POS**:
  * In `src/hooks/useTailorPos.jsx:231`, `if (searchPhone.length >= 10)` prevents searching for standard 9-digit Saudi local inputs (e.g., `501234567` without leading zero). If typed as 9 digits, the system remains idle and customer lookup never fires.
* **Absence of Name Search in POS Walk-in**:
  * In `TailorPos.jsx`, the customer name field (`setName`) is a plain text input with no autocomplete or query hook. Walk-in customers who do not remember their registered phone number cannot be found by name from the POS terminal.
* **Silent Single-Match Bias (Arbitrary Customer Selection)**:
  * When multiple customer records exist with the same phone (e.g., family members sharing a mobile, or existing duplicates), `useTailorPos.jsx:235` unconditionally selects `res[0]`. There is no disambiguation modal or profile selection list.
* **Customer History Blind Spot in CRM**:
  * In `electron/database.cjs:2625-2637`, `getCustomerHistory(customerId)` only queries the `sales` and `sales_items` tables. It **does not join** `tailor_orders`, `tailor_order_garments`, or `alteration_tickets`. When a shop owner views a customer's history in `/customers`, tailoring orders, garment status, and past alterations are completely missing.
* **No Phone Normalization**:
  * Neither `addCustomer` (`database.cjs:2611`) nor `useTailorPos.jsx:411` normalizes phone numbers (stripping country prefixes `+966`, leading zeros, or spaces), resulting in duplicate records for the same customer.

#### 3. Real DB vs Mock/Hardcoded Operations
* **Real Database**:
  * Customer CRUD and search operate on the real SQLite `customers` table via better-sqlite3 in `electron/database.cjs`.
  * `mergeCustomers` executes a genuine multi-table database transaction.
* **Hardcoded / Mocked Behaviors**:
  * In `src/mockApi.js:39–43`, standalone browser development runs against a static in-memory array (`mockStaff`, `mockMenu`). `window.api.tailor` is completely omitted in `mockApi.js`, causing fatal runtime exceptions when running outside Electron.

---

### STAGE 2: Measurement Profiles & Selection

#### 1. Implementation Details
* **Frontend Routing & Views**:
  * The dedicated measurement file and history ledger is `src/pages/MeasurementCapture.jsx` (Route: `/measurements`, `src/App.jsx:340`).
  * In `TailorPos.jsx`, measurements are embedded within the order items grid (lines 20–42).
* **Garment Schemas and Fields**:
  * In `src/pages/MeasurementCapture.jsx:5-22`, garment types and measurement fields are defined:
    ```javascript
    const GARMENT_TYPES = [
      { id: 'thobe',   label: 'ثوب رجالي', icon: '✂️' },
      { id: 'sirwal',  label: 'سروال',     icon: '👖' },
      { id: 'shirt',   label: 'قميص',      icon: '👔' },
      { id: 'bisht',   label: 'بشت',       icon: '🧥' },
      { id: 'suit',    label: 'بدلة',      icon: '🤵' },
    ];
    const NORMALIZED_FIELDS = [
      { key: 'length',       label: 'الطول (Length)' },
      { key: 'shoulder',     label: 'الكتف (Shoulder)' },
      { key: 'chest',        label: 'الصدر (Chest)' },
      { key: 'waist',        label: 'الوسط (Waist)' },
      { key: 'sleeve',       label: 'الكم (Sleeve)' },
      { key: 'neck',         label: 'الرقبة (Neck)' },
      { key: 'wrist',        label: 'الزند (Wrist)' },
      { key: 'hand_opening', label: 'وسع الكم / الرجل (Opening)' },
    ];
    ```
* **Historical Delta & Comparison**:
  * `MeasurementCapture.jsx:728–795` implements a comparison modal (`showHistory`) that displays previous versions of saved profiles side-by-side.
* **Database & IPC Implementation**:
  * SQLite table `measurement_profiles` (`electron/database.cjs:660–671`):
    `id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, garment_type TEXT, measurements_json TEXT, status TEXT DEFAULT 'complete', updated_at DATETIME`
  * `saveTailorProfile` (`database.cjs:3661–3669`): inserts profile rows into SQLite with timestamp `datetime('now')`.
  * `customer_attachments` (`database.cjs:674–681`): stores model sketches or customer photos.

#### 2. Gaps, Broken Workflows & UX Friction
* **Rigid One-Size-Fits-All Schema**:
  * Every garment type (`thobe`, `sirwal`, `shirt`, `bisht`, `suit`) is forced into the identical 8 generic dimensions.
  * Traditional Saudi/Gulf Thobe parameters are missing: Al-Khaban (الخبن), Jabzor (الجبزور), Bottom Flare / Da'er (وسع الجلال / وسع الدائر), Pocket style & placements (pen pocket, phone pocket, internal hidden), Collar height (ارتفاع القلاب).
  * Men's Suits (`suit`) are completely un-tailorable: zero fields for jacket chest, half-chest, sleeve crown, jacket length, lapel width, trouser outseam, inseam, waist, crotch rise, or knee width.
  * Sirwal (`sirwal`) presents irrelevant fields (neck, shoulder, sleeve) while omitting crotch rise and thigh circumference.
* **Total Absence of Ready-to-Wear Standard Sizing**:
  * The system possesses no sizing charts (e.g., standard Thobe sizes 52L, 54M, 56XL, or standard shirt collar sizes). The POS forces manual numeric entry for every single piece, failing basic bulk walk-in workflows.
* **Destructive Profile Overwrite on Temporary Adjustments (Scenario 14)**:
  * In `src/hooks/useTailorPos.jsx:467–474`, when an order is submitted:
    ```javascript
    for (const item of items) {
        await window.api?.tailor?.saveProfile?.({
            customer_id: customerId,
            garment_type: gType,
            measurements: { ...item.measurements, ...item.config }
        });
    }
    ```
  * If a returning customer asks for a 1-inch temporary shortening for one specific order, the system **automatically and permanently overwrites** the customer's master profile. There is no toggle for "Temporary order-only measurement override".
* **No Named Profile Profiles / Family Sub-Profiles**:
  * Because `measurement_profiles` lacks a `profile_name` or `tag` column, a customer cannot save separate profiles such as "Summer Loose Fit", "Winter Heavy Fit", or profiles for family dependents ("Son: Ahmed").

#### 3. Real DB vs Mock/Hardcoded Operations
* **Real Database**:
  * Profile saving, fetching, and attachments are persisted to SQLite in `measurement_profiles` and `customer_attachments`.
* **Hardcoded / Mocked Behaviors**:
  * The 8 measurement field definitions and garment style options (`collar`: classic/mandarin/chanel, `cuff`: single/double/plain, `pocket`: normal/hidden/double) are static arrays hardcoded in the frontend components, with no schema configurability from shop settings.

---

### STAGE 3: Tailoring & Cutting Job Assignment

#### 1. Implementation Details
* **Frontend Routing & Views**:
  * Workshop Kanban board: `src/pages/OrdersBoard.jsx` (Route: `/orders-board`, `src/App.jsx:339`).
  * Printable work ticket: `src/components/TailorWorkOrder.jsx` (rendered via `TailorPos.jsx` print drawer).
* **Kanban Workflow Stages**:
  * `OrdersBoard.jsx:8–14` defines 5 sequential production stages:
    1. `cutting` (قص)
    2. `stitching` (خياطة)
    3. `finishing` (تشطيب)
    4. `ironing` (كوي)
    5. `ready` (جاهز)
* **Stage Progression Operations**:
  * Single-garment advance/revert via `handleStageChange` (`OrdersBoard.jsx:83–105`), calling IPC `tailor:updateStage`.
  * Batch advance via `handleBatchAdvance` (`OrdersBoard.jsx:108–142`), advancing all unfinished garments in an order to the next stage simultaneously.
* **Database & IPC Implementation**:
  * `tailor_orders` (`electron/database.cjs:626–643`) and `tailor_order_garments` (`database.cjs:646–656`).
  * `updateGarmentStage({ garment_id, stage })` (`database.cjs:3643–3650`): verifies valid stage and updates `production_stage`.
  * `getTailorPayroll` (`database.cjs:3839–3861`):
    ```sql
    SELECT g.assigned_tailor_id, s.name as tailor_name, s.piece_rate,
           COUNT(g.id) as pieces_completed,
           SUM(CASE WHEN o.rush_order = 1 THEN 10 ELSE 0 END) as rush_bonuses
    FROM tailor_order_garments g
    JOIN tailor_orders o ON g.tailor_order_id = o.id
    LEFT JOIN staff s ON g.assigned_tailor_id = s.id
    WHERE g.production_stage = 'ready'
    GROUP BY g.assigned_tailor_id
    ```

#### 2. Gaps, Broken Workflows & UX Friction
* **Architectural Omission: Complete Exclusion of the Cutter (المفصل)**:
  * In commercial tailoring, Cutting and Sewing are distinct specialized crafts with separate labor rates and queues.
  * In `tailor_order_garments` (database.cjs:653), there is **only** an `assigned_tailor_id` column. There is **no `assigned_cutter_id`**.
  * In `TailorPos.jsx:29`, the operator can select only one worker (`tailorId`).
  * In `database.cjs:3841`, piece-rate compensation is credited exclusively to `assigned_tailor_id`. Cutters receive zero automated payroll tracking, zero piece-rate attribution, and zero productivity tracking.
* **Missing Barcode on Physical Work Tickets**:
  * In `src/components/TailorWorkOrder.jsx:484–487`, the printed ticket displays a textual invoice ID `# {invoiceNumber}`.
  * There is **no scannable barcode or QR code** on the ticket. When physical garments move across cutting tables and sewing machines, workers cannot scan the ticket to pull up or advance the job. Workers must manually scroll through cards on a screen.
* **No Dynamic Station Assignment**:
  * A garment passes through 5 stages, but worker assignment cannot change between stages (e.g., assigning Tailor A for cutting, Tailor B for sewing, and Tailor C for ironing). The single assigned tailor ID remains static throughout all stages.
* **Unauthenticated Stage Transitions (Zero Shop Floor Accountability)**:
  * In `OrdersBoard.jsx:444`, any user can click "نقل إلى..." on any garment. There is no worker PIN verification, badge swipe, or audit logging in `audit_logs` to verify who completed each stage.
* **No Defect / Rework Flow in the Board**:
  * If an inspector flags a sewing defect, the only option is the generic "↩️ رجوع" (revert) button (`OrdersBoard.jsx:468`). The system logs no defect ticket, records no defect reason, and tracks no penalty deduction against the offending worker.

#### 3. Real DB vs Mock/Hardcoded Operations
* **Real Database**:
  * Garment stage updates, order retrieval, and garment lists run live against SQLite tables `tailor_orders` and `tailor_order_garments`.
  * Fabric length deduction occurs during `createTailorOrder` (`database.cjs:3597`).
* **Hardcoded / Mocked Behaviors**:
  * Fabric length deduction is hardcoded to a fixed `3.5` meters in `useTailorPos.jsx:442` (`fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5`), completely ignoring garment size (child vs tall adult) or garment type (sirwal requires ~1.5m, bisht requires ~6m).

---

### STAGE 4: Invoicing, Payment & ZATCA Compliance

#### 1. Implementation Details
* **Frontend Implementation**:
  * Financial calculations are performed in `src/hooks/useTailorPos.jsx:41–44, 418–426, 600–604`:
    `subtotalBeforeDiscount`, `discount`, `vat` (calculated at 15%), `total`, `paid` (deposit), and `balance`.
  * Payment tender selection supports `Cash`, `Card`, and `Split` (cash + card) (`useTailorPos.jsx:47–50, 54–60`).
  * Sale creation invokes `window.api.saveSale` (`useTailorPos.jsx:420–432`).
  * Additional partial payments are captured in `OrdersBoard.jsx:679–780` (`showPayment` modal), calling `window.api.tailor.addPayment`.
* **Backend Database & Accounting**:
  * In `electron/database.cjs:1624–1800`, `saveSale` enforces open shifts, calculates VAT, generates ZATCA UBL 2.1 XML (`generateUBL21XML`), signs the XML via ECDSA (`zatca.signAndPackageInvoice`), and records the transaction into `sales` and `sales_items`.
  * In `electron/database.cjs:3711–3736`, `addTailorPayment` updates `tailor_orders.deposit_paid` and `balance_due`, and posts journal entries:
    * Debit: Cash/Bank (1111 / 1112)
    * Credit: Accounts Receivable (1200)
* **ZATCA Compliance Engines**:
  * `electron/zatca_phase2_impl.cjs`: Full ZATCA Phase 2 ECDSA cryptographic signing, UBL 2.1 invoice generation, and clearance/reporting API payloads.
  * `src/utils/qr-gen.js:235–301`: `generateZatcaTLV9` implementing 9-tag BER-TLV encoding for Phase 2 verification.

#### 2. Gaps, Broken Workflows & UX Friction
* **CRITICAL ZATCA VIOLATION: Non-Compliant Thermal Slip in Tailor POS**:
  * While standard retail POS (`src/pages/Pos.jsx:896–1050`) renders a compliant ZATCA simplified tax invoice with a Phase 2 TLV QR code, `src/hooks/useTailorPos.jsx:481–548` generates an independent, handcrafted HTML slip:
    ```html
    <!-- src/hooks/useTailorPos.jsx:500-538 -->
    <div class="text-center font-bold mb-2">${businessName}</div>
    <div class="text-center border-b">فاتورة خياطة تفصيل</div>
    <div class="flex mt-2"><span>رقم الفاتورة:</span> <span>#${res?.order_id || invoiceNumber}</span></div>
    ...
    <div class="flex"><span>الضريبة (15%):</span> <span>${vat.toFixed(2)} SAR</span></div>
    <div class="flex font-bold"><span>الإجمالي:</span> <span>${total.toFixed(2)} SAR</span></div>
    ```
  * **Violations**:
    1. **NO QR CODE**: Does not render any ZATCA QR code (neither Phase 1 5-tag TLV nor Phase 2 9-tag BER-TLV).
    2. **NO VAT REGISTRATION NUMBER**: Omits the seller's 15-digit Tax Identification Number.
    3. **INVALID HEADER**: Uses "فاتورة خياطة تفصيل" instead of the mandatory "فاتورة ضريبية مبسطة" (Simplified Tax Invoice).
    4. **NO UUID / CRYPTOGRAPHIC STAMP**: The signed ZATCA hash and UUID produced by `saveSale` are discarded and never printed.
    5. **WRONG INVOICE NUMBER**: Prints `#${res?.order_id || invoiceNumber}` (a random integer or tailor order ID), rather than the official serial invoice number logged in the ZATCA registry.
* **Lump-Sum Single Item Distortion in Sales Registry**:
  * In `useTailorPos.jsx:430`, `saveSale` is called with:
    `items: [{ item_name: 'تفصيل خياطة', quantity: 1, item_price: finalSubtotal }]`
  * Even if the order consists of 4 distinct garments with different fabrics, tailoring fees, and embroidery, the official tax invoice is collapsed into a single generic item.
* **Tax Accounting Mismatch on Deposits**:
  * When an order is booked with a 100 SAR deposit on a 1,000 SAR total, `saveSale` registers the full 1,000 SAR total and 150 SAR VAT output immediately.
  * When the remaining 900 SAR is collected later via `addTailorPayment` or `completeTailorOrder`, **no sales invoice is generated and no ZATCA document is issued**.
* **Orphaned Backend Refund Function**:
  * `refundTailorOrder` exists in `electron/database.cjs:3738`, but is **never called anywhere in the frontend codebase**. Cashiers have zero UI controls to process a tailor order refund or cancellation.
  * Furthermore, `refundTailorOrder` performs internal ledger reversals but does not generate a ZATCA Credit Note (typeCode 381 with `billingRef`).
* **Hidden Crash on 'NO_OPEN_SHIFT'**:
  * If a cashier has not explicitly opened a shift in `/shift`, `saveSale` throws `NO_OPEN_SHIFT` (`database.cjs:1646`). `TailorPos.jsx` does not pre-validate shift status, causing the order submission to fail abruptly with an unhandled exception.

#### 3. Real DB vs Mock/Hardcoded Operations
* **Real Database**:
  * `saveSale` writes to `sales`, `sales_items`, `ledger_entries`, and `zatca_device`.
  * `addTailorPayment` updates `tailor_orders` and writes journal entries to `ledger_entries`.
* **Hardcoded / Mocked Behaviors**:
  * In `useTailorPos.jsx:24`, `invoiceNumber` is initialized with `Math.floor(Math.random() * 10000)`.
  * In `useTailorPos.jsx:417`, the invoice string is hardcoded to `Date.now().toString()`.

---

### STAGE 5: Fitting, Quality Check & Final Collection

#### 1. Implementation Details
* **Frontend Routing & Views**:
  * Order handover and balance settlement: `src/pages/OrdersBoard.jsx` (lines 569–676, `showPickup` modal).
  * Alterations and rework lifecycle: `src/pages/Alterations.jsx` (Route: `/alterations`, `src/App.jsx:338`).
* **Pickup & Collection Flow**:
  * When an order is in stage `ready` and all garments are ready, `OrdersBoard.jsx:569` displays `📦 تسليم للعميل`.
  * The pickup modal calculates `balance_due = total_amount - deposit_paid`, prompts for payment method (`cash`, `card`, `transfer`), and executes `handleCompleteOrder` (`OrdersBoard.jsx:145–164`).
* **Alteration Lifecycle Management**:
  * In `src/pages/Alterations.jsx`, tickets track 4 states: `pending` -> `in_progress` -> `ready` -> `delivered`.
  * Delivery settlement modal (`Alterations.jsx:115–155`): collects remaining alteration fee upon delivery.
  * Thermal alteration ticket printing (`Alterations.jsx:160–220`) includes barcode rendering via `generateBarcodeSVG`.
* **Database & IPC Implementation**:
  * `completeTailorOrder({ order_id })` (`electron/database.cjs:3786–3795`):
    `UPDATE tailor_orders SET status = 'delivered', balance_due = 0, deposit_paid = total_amount WHERE id = ?`
  * `alteration_tickets` and `alteration_items` (`database.cjs:606–623, 3864–3905`).
  * `tailor_appointments` (`database.cjs:685–694`): appointment schema.

#### 2. Gaps, Broken Workflows & UX Friction
* **The "Accounting Black Hole" on Final Balance Collection**:
  * In `OrdersBoard.jsx:145–164`, `handleCompleteOrder` calls `completeTailorOrder`.
  * In `database.cjs:3786–3795`, `completeTailorOrder` sets `balance_due = 0, deposit_paid = total_amount`.
  * **IT POSTS ZERO LEDGER ENTRIES**: Unlike `addTailorPayment` (which debits Cash/Bank and credits Accounts Receivable), `completeTailorOrder` contains no journal entries. When a customer pays an outstanding 300 SAR at collection, that money completely vanishes from the general ledger—Accounts Receivable is never credited, and Cash/Bank is never debited.
* **Delivery Confirmation Generates Zero Invoices or Receipts**:
  * In `OrdersBoard.jsx:672`, the primary button is labeled `✓ تأكيد التسليم وإصدار الفاتورة` ("Confirm Delivery and Issue Invoice").
  * When clicked, the modal closes and shows a toast. **No invoice is generated and no receipt is printed**. The customer leaves the shop with no receipt or document proving final payment and handover.
* **Completely Dead Fitting Appointments Module**:
  * The schema table `tailor_appointments` (`database.cjs:685–694`) exists, and `getTailorDashboardStats` (`database.cjs:3820`) counts today's fittings.
  * However, there is **no user interface anywhere in the application** to book, view, reschedule, or check-in fitting appointments. Mid-way fittings (بروفة) have no workflow tracking.
* **Unlinked Alterations (Broken Rework Traceability)**:
  * While `alteration_tickets` has a `linked_order_id` column in SQLite, `createAlterationTicket` (`database.cjs:3866–3884`) **omits `linked_order_id` from the SQL INSERT statement**.
  * In `Alterations.jsx`, there is no field to search or attach an existing order.
  * If a thobe fails quality check or needs alterations post-pickup, the alteration ticket is created in total isolation. Management cannot track which tailor caused the rework or measure rework rates per employee.
* **No Defect Attribution or Free Alteration Classification**:
  * Alterations do not distinguish between "Shop Error / Tailor Negligence" (which should be free of charge and logged as a defect deduction) versus "Customer Request / Fit Change" (which is billed).
* **Zero Automated Customer Notification**:
  * When an order or alteration is moved to `ready` (جاهز), no automated SMS or WhatsApp message is sent to the customer. Shop personnel must manually contact the customer.

#### 3. Real DB vs Mock/Hardcoded Operations
* **Real Database**:
  * Alteration ticket creation, item lists, and status progression persist to SQLite.
  * Final status update of orders to `delivered` updates the SQLite `tailor_orders` table.
* **Hardcoded / Mocked Behaviors**:
  * Final collection receipt and invoice generation promised by the UI is completely mocked / nonexistent.

---

## 2. Logic Chain

```
[Observation 1: useTailorPos.jsx:481-548 prints raw HTML slip without QR code, VAT ID, or UUID]
        │
        ▼
[Step 1: ZATCA Phase 1 & 2 regulations strictly mandate a Simplified Tax Invoice to feature a TLV-encoded QR code, 15-digit VAT number, and specific tax headers]
        │
        ▼
[Conclusion 1: Tailor POS is legally non-compliant for commercial operation in Saudi Arabia; receipts generated directly incur regulatory penalties]

[Observation 2: tailor_order_garments schema (database.cjs:653) has only assigned_tailor_id; getTailorPayroll (database.cjs:3841) credits only assigned_tailor_id]
        │
        ▼
[Step 2: Traditional and modern tailor operations divide labor between pattern cutters (فصالين) and stitchers (خياطين)]
        │
        ▼
[Conclusion 2: The system cannot track cutter compensation, piece-rate wages, or cutter productivity; cutter metrics are totally unrecorded]

[Observation 3: OrdersBoard.jsx:145-154 executes completeTailorOrder; database.cjs:3786-3795 updates tailor_orders balance_due=0 without inserting into ledger_entries or sales]
        │
        ▼
[Step 3: A sale requires double-entry recognition when cash/card is collected upon final delivery to clear accounts receivable and balance the cash till]
        │
        ▼
[Conclusion 3: Collecting order balances at pickup creates an accounting black hole, corrupting shift cash balances, the general ledger, and trial balance]

[Observation 4: alteration_tickets.linked_order_id is ignored during insert (database.cjs:3866-3884); Alterations.jsx has no order linking]
        │
        ▼
[Step 4: Quality control and warranty management require attributing alterations and customer complaints to the original order and the specific craftsman who produced it]
        │
        ▼
[Conclusion 4: Rework loops operate in total isolation; owners cannot calculate defect rates, apply tailor deductions, or enforce quality control]

[Observation 5: useTailorPos.jsx:231 gates phone lookup strictly at >=10 chars; customer name input triggers no query]
        │
        ▼
[Step 5: Front-desk operations require rapid lookup by 9-digit numbers (5xxxxxxxx) or customer name when lines form at walk-in]
        │
        ▼
[Conclusion 5: Walk-in counter UX suffers severe friction, frequently prompting redundant customer creation and fractured customer profiles]
```

---

## 3. Caveats

1. **Standalone Desktop vs Cloud Sync**:
   * The codebase contains synchronization hooks (`electron/syncEngine.cjs`), but this evaluation focused on the local single-store Electron application workflow (`pos_data.db`).
2. **Fabric Unit of Measure (UOM)**:
   * The system currently treats fabrics as inventory items with `length_available` decremented by a hardcoded 3.5m. The investigation did not evaluate rolls tracking, roll widths (عرض عرضين vs عرض واحد), or shrinkage allowances.
3. **Retail vs Tailor Coexistence**:
   * `my-pos/V4` is a hybrid POS supporting retail, restaurant, and tailor modes. Retail POS (`src/pages/Pos.jsx`) has a fully compliant ZATCA Phase 2 engine; this evaluation strictly scoped the tailor customer lifecycle pipeline (`TailorPos`, `OrdersBoard`, `Alterations`, `MeasurementCapture`).

---

## 4. Conclusion

The tailoring pipeline in `my-pos/V4` possesses high-quality UI foundations (such as `OrdersBoard`'s Kanban board, `TailorWorkOrder`'s A4 printable layout, and `MeasurementCapture`'s unit conversion and comparison views). 

However, from an end-to-end customer lifecycle standpoint, **the application is NOT production-ready for commercial tailor shops in Saudi Arabia**. Five critical architectural and compliance defects prevent deployment:

1. **ZATCA Non-Compliance in Tailor POS**: The tailor thermal receipt bypasses the app's own ZATCA engine, printing an invalid receipt without QR codes, VAT numbers, or tax headers.
2. **Missing Cutter Assignment & Compensation**: The workforce model only recognizes a single tailor per garment; cutters cannot be assigned, tracked, or paid.
3. **Accounting Black Hole on Balance Collection**: Collecting outstanding balances at delivery marks the order complete in SQLite but fails to book the transaction into the general ledger or cash till.
4. **Decoupled Alteration and Rework Lifecycle**: Alterations cannot be linked to the original order, rendering warranty claims, defect tracking, and tailor penalties impossible.
5. **Rigid Measurement Schemas & Broken Overrides**: Garments like suits and sirwals are forced into thobe fields, and temporary order modifications destructively overwrite customers' permanent profiles.

---

## 5. Verification Method

To independently verify all findings in this report, inspect the following exact files, routes, and lines of code:

### 1. Verification of ZATCA Non-Compliance
* **Files to Inspect**:
  * `src/hooks/useTailorPos.jsx:481–548`
  * `src/pages/Pos.jsx:896–1050` (Compare with standard retail receipt)
* **Verification**:
  Observe that `useTailorPos.jsx` builds a raw HTML string with no `<svg>` QR code, no call to `QRCode.generateZatcaTLV9`, no seller VAT number, and prints `#${res?.order_id || invoiceNumber}` instead of the official ZATCA serial invoice.

### 2. Verification of Missing Cutter in Schema & Payroll
* **Files to Inspect**:
  * `electron/database.cjs:646–656` (`CREATE TABLE tailor_order_garments`)
  * `electron/database.cjs:3839–3861` (`function getTailorPayroll`)
* **Verification**:
  Confirm that `tailor_order_garments` only defines `assigned_tailor_id`. Note that `getTailorPayroll` groups strictly by `assigned_tailor_id` and has zero references to cutters.

### 3. Verification of Balance Collection Accounting Black Hole
* **Files to Inspect**:
  * `src/pages/OrdersBoard.jsx:145–164` (`handleCompleteOrder`)
  * `electron/database.cjs:3786–3795` (`completeTailorOrder`)
  * `electron/database.cjs:3711–3736` (`addTailorPayment`)
* **Verification**:
  Observe that while `addTailorPayment` correctly writes `INSERT INTO ledger_entries`, `completeTailorOrder` merely executes an `UPDATE tailor_orders SET balance_due = 0` and exits without creating any ledger entries or sales records.

### 4. Verification of Unlinked Alterations
* **Files to Inspect**:
  * `electron/database.cjs:606–615` (Table definition with `linked_order_id`)
  * `electron/database.cjs:3864–3884` (`createAlterationTicket`)
  * `src/pages/Alterations.jsx:27–30, 132–155`
* **Verification**:
  Confirm that `createAlterationTicket` in `database.cjs` does not accept or insert `linked_order_id`, and that the `Alterations.jsx` modal has no input or selection for linked order IDs.

### 5. Verification of Phone Search Gate
* **File to Inspect**:
  * `src/hooks/useTailorPos.jsx:230–232`
* **Verification**:
  Check line 231: `if (searchPhone.length >= 10)`. Enter a 9-digit number (`501234567`) in the search input and observe that `window.api.getCustomers` is never called.
