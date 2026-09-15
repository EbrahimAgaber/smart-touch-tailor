# Comprehensive Production Readiness Review & Benchmark Evaluation: Tailor POS (`my-pos/V4`)

**System Evaluated:** Smart Touch POS (`my-pos/V4` / البصمة الذكية - مسار المعلم والخياطة)  
**Evaluation Type:** Full-Scope Production Readiness, Lifecycle & Operational Integrity Audit  
**Target Category:** Enterprise Tailor & Apparel POS (Saudi Arabian & GCC Bespoke Retail Market)  
**Auditor / Consortium:** Senior Engineering Team (PM, Lead UI/UX Architect, Senior Full-Stack Engineer, Lead QA Auditor)  
**Deliverable File:** `c:\my-pos\V4\comprehensive_app_review.md`  
**Date of Audit:** September 11, 2026  

---

## Table of Contents
1. [Executive Summary & Production Readiness Scorecard](#1-executive-summary--production-readiness-scorecard)
2. [Customer Lifecycle Evaluation (Requirement R1)](#2-customer-lifecycle-evaluation-requirement-r1)
   - [Stage 1: Walk-in & Customer Registration / Profile Lookup](#stage-1-walk-in--customer-registration--profile-lookup)
   - [Stage 2: Measurement Profiles & Garment Selection](#stage-2-measurement-profiles--garment-selection)
   - [Stage 3: Tailoring & Cutting Job Assignment](#stage-3-tailoring--cutting-job-assignment)
   - [Stage 4: Invoicing, Payment & ZATCA Compliance](#stage-4-invoicing-payment--zatca-compliance)
   - [Stage 5: Fitting, Quality Check & Final Collection](#stage-5-fitting-quality-check--final-collection)
3. [Business Operations & Integrity Evaluation (Requirement R2)](#3-business-operations--integrity-evaluation-requirement-r2)
   - [3.1 Cutter Pay Rates and Total Compensation](#31-cutter-pay-rates-and-total-compensation)
   - [3.2 Tailor Pay Rates and Total Compensation](#32-tailor-pay-rates-and-total-compensation)
   - [3.3 Deductions Due to Defective Items Made by Tailors](#33-deductions-due-to-defective-items-made-by-tailors)
   - [3.4 Tracking of Textile / Material Waste](#34-tracking-of-textile--material-waste)
   - [3.5 Fraud Prevention, Cash Management & Role-Based Integrity](#35-fraud-prevention-cash-management--role-based-integrity)
4. [Technical Architecture, Security & Code Health Audit (Requirement R3 Foundations)](#4-technical-architecture-security--code-health-audit-requirement-r3-foundations)
   - [4.1 Architecture & Stack Overview](#41-architecture--stack-overview)
   - [4.2 Critical Security Vulnerabilities](#42-critical-security-vulnerabilities)
   - [4.3 Broken IPC Endpoints & Hardware Handlers](#43-broken-ipc-endpoints--hardware-handlers)
   - [4.4 Financial Accounting Disconnects & Transaction Gaps](#44-financial-accounting-disconnects--transaction-gaps)
   - [4.5 Testing, Build Health & CI/CD Pipeline Audit](#45-testing-build-health--cicd-pipeline-audit)
5. [Comprehensive Gap & Defect Matrix](#5-comprehensive-gap--defect-matrix)
6. [Actionable Benchmark Recommendations & Remediation Roadmap](#6-actionable-benchmark-recommendations--remediation-roadmap)
   - [Phase 1: Security & Financial Integrity Emergency Hotfixes](#phase-1-security--financial-integrity-emergency-hotfixes)
   - [Phase 2: Domain Schema & Workforce Modernization (Cutters, Tailors, QC & Deductions)](#phase-2-domain-schema--workforce-modernization-cutters-tailors-qc--deductions)
   - [Phase 3: Textile Inventory & Smart Wastage Engine](#phase-3-textile-inventory--smart-wastage-engine)
   - [Phase 4: Customer Lifecycle & Tailoring UX Hardening](#phase-4-customer-lifecycle--tailoring-ux-hardening)
   - [Phase 5: Hardware & Production Engineering](#phase-5-hardware--production-engineering)

---

# 1. Executive Summary & Production Readiness Scorecard

### Executive Evaluation & Verdict
**VERDICT: NOT PRODUCTION-READY (CRITICAL BLOCKERS DETECTED)**

Following an exhaustive forensic inspection of the `my-pos/V4` codebase—encompassing the React frontend (`src/`), Electron main and preload processes (`electron/main.cjs`, `electron/preload.cjs`), the database layer (`electron/database.cjs`), compliance modules (`electron/zatca_phase2_impl.cjs`), and the financial accounting engines—the audit panel unanimously concludes that **the application cannot be deployed to commercial tailor establishments in its current state**.

While `my-pos/V4` exhibits exceptional breadth (boasting dual-entry General Ledger accounting, sophisticated ZATCA Phase 2 ECDSA cryptographic signing engines, offline-capable CRDT sync prototypes, and visually appealing Kanban boards), it is compromised by **five fatal systemic deficiencies**:
1. **Critical Regulatory Non-Compliance in Tailor Receipts**: The Tailor POS checkout module bypasses the system's own compliant ZATCA engine and prints a raw, non-compliant thermal receipt lacking the mandatory Phase 2 TLV QR code, omitting the seller's 15-digit VAT number, and using invalid header titles. In the Kingdom of Saudi Arabia, deploying this POS exposes shop owners to immediate administrative fines and regulatory shutdown by ZATCA.
2. **Critical Security Backdoors & Exposure**: On every boot, `database.cjs` unconditionally resets the Administrator PIN to `'1234'` and the Cashier PIN to `'0000'`, completely erasing owner-configured security credentials. Combined with an arbitrary local file read vulnerability in `main.cjs`, hardcoded license secrets, and lack of backend IPC role authorization, the application provides zero defense against malicious staff or external compromise.
3. **Severe Financial Accounting Disconnects ("Accounting Black Holes")**: 100% of alteration revenue and all final balance payments collected upon garment pickup are completely omitted from the general ledger and cash till. Staff collect cash from customers without generating sales receipts, without debiting cash accounts, and without booking VAT output.
4. **Fatal Crashes in Worker Compensation**: The payroll function crashes upon execution due to an invalid SQL column query (`o.rush_order` instead of `is_urgent`), the frontend calls an undefined API namespace, and garment records lack tailor/cutter assignment from the POS. Cutters are completely unrepresented in the database schema.
5. **Absence of Core Tailoring Domain Logic**: Fabric consumption is hardcoded to a static 3.5 meters for all garments regardless of size or type, roll-level inventory tracking is nonexistent, quality control checkpoints are absent, and temporary measurement adjustments destructively overwrite customers' permanent profiles.

---

### Core Architectural Achievements vs. Critical Commercial Blockers

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE ARCHITECTURAL ACHIEVEMENTS                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Complete ZATCA Phase 2 Engine (UBL 2.1 XML generation, ECDSA secp256k1 signing, 9-tag BER-TLV). │
│ • Robust Double-Entry Accounting Core (Chart of Accounts, Journal Entries, Trial Balance, P&L).    │
│ • Rich Interactive Workshop Kanban (5 distinct production stages with batch advance capabilities). │
│ • Customer Deduplication Engine with multi-table transaction merging (sales, orders, profiles).   │
│ • Modern Local-First Desktop Shell (Electron 22 + React 18 SPA + SQLite WAL mode persistence).    │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CRITICAL COMMERCIAL BLOCKERS                                      │
├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ❌ Thermal Tailor Receipt completely omits ZATCA QR codes, VAT numbers, and valid tax headers.      │
│ ❌ Emergency boot backdoor in database.cjs forcibly overwrites Admin PIN to '1234' on every launch.│
│ ❌ Final balance collections and alteration revenues vanish from accounting books (Zero GL entry). │
│ ❌ Tailor payroll queries fatal missing column 'rush_order' and calls undefined API namespace.      │
│ ❌ Schema completely omits Cutters (المفصل); zero tracking, rate matrix, or payroll for cutting.  │
│ ❌ Fabric inventory lacks roll tracking; consumption is blindly hardcoded to 3.5m per garment.    │
│ ❌ Pos item submission collapses multi-garment bespoke orders into a single generic lump-sum item.  │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Comprehensive Production Readiness Scorecard

| Evaluation Dimension | Score (0–10) | Readiness Status | Summary Rationale |
| :--- | :---: | :---: | :--- |
| **1. Customer Lifecycle (Walk-in to Delivery)** | **4.2 / 10** | **Critical Gaps** | Visually polished Kanban and measurement capture, but crippled by a 10-digit phone search gate, rigid 8-field measurements, destructive master profile overwrites, and unlinked alterations. |
| **2. Business Operations & Workforce** | **2.0 / 10** | **Failing** | Cutters are completely omitted from the schema. Tailor payroll crashes on missing column `rush_order`, calls an undefined frontend API, and assigns no tailor IDs. Defect tracking is absent. |
| **3. ZATCA Phase 2 Compliance** | **3.5 / 10** | **Failing (Illegal Slip)** | Although retail POS features compliant cryptographic signing, Tailor POS prints a raw HTML slip with NO QR code, NO VAT number, invalid header, and a fake random invoice number. |
| **4. Security & Access Control** | **1.5 / 10** | **Critical Risk** | Hardcoded boot script resets Admin PIN to `1234`. Arbitrary local file read vulnerability in `main.cjs`. Plaintext HMAC secret. Zero backend IPC role-based access control. |
| **5. Financial Integrity & Accounting** | **3.8 / 10** | **Severe Leakage** | Dual asynchronous order creation lacks atomic transactions. Order pickup balance settlements and alteration tickets are 100% off-the-books (no ledger entries, no cash drawer sync). |
| **6. Hardware, Stability & Build Quality** | **4.0 / 10** | **Needs Refactoring** | Native module ABI mismatch breaks unit testing. Barcode/label printer IPC handlers are never registered. Cash drawer functions are missing. Monolithic 1.89MB bundle without code splitting. |
| **OVERALL PRODUCTION READINESS** | **3.1 / 10** | **NOT PRODUCTION READY** | **Unfit for commercial deployment until Phase 1 and Phase 2 remediation roadmaps are executed.** |

---

# 2. Customer Lifecycle Evaluation (Requirement R1)

The customer lifecycle was audited across five consecutive stages, mapping the operational workflow from walk-in customer reception to final garment collection.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 5 CUSTOMER LIFECYCLE STAGES                                      │
├─────────────────┬─────────────────┬──────────────────┬──────────────────┬──────────────────────────────┤
│    STAGE 1      │     STAGE 2     │     STAGE 3      │     STAGE 4      │           STAGE 5            │
│  Walk-in POS &  │   Measurement   │    Cutting &     │ Invoicing, Pay & │      Fitting, Quality &      │
│ Customer Search │ Profiles & Spec │  Job Assignment  │ ZATCA Compliance │       Final Collection       │
└─────────────────┴─────────────────┴──────────────────┴──────────────────┴──────────────────────────────┘
```

---

### Stage 1: Walk-in & Customer Registration / Profile Lookup

#### 1. Architecture & Codebase Map
* **Frontend POS Entrypoint:** `src/pages/TailorPos.jsx` (Route `/tailor-pos`, declared in `src/App.jsx:337`).
* **Search & State Hook:** `src/hooks/useTailorPos.jsx` (Customer state and lookup logic).
* **Dedicated CRM Directory:** `src/pages/Customers.jsx` (Route `/customers`, `src/App.jsx:332`).
* **Database Queries:** `electron/database.cjs:2596–2609` (`getCustomers`), `database.cjs:3681–3709` (`mergeCustomers`), `database.cjs:2625–2637` (`getCustomerHistory`).

#### 2. Forensic Breakdown of Gaps & UX Friction
* **The 10-Digit Phone Gate (`src/hooks/useTailorPos.jsx:230–232`):**
  Customer search is executed via a `useCallback` hook that explicitly checks:
  ```javascript
  // src/hooks/useTailorPos.jsx:230-232
  const handlePhoneSearch = useCallback(async (searchPhone) => {
      if (searchPhone.length >= 10) {
          try {
              const res = await window.api?.getCustomers?.({ search: searchPhone });
  ```
  In Saudi Arabia, local phone numbers are routinely entered as 9 digits without the leading zero (e.g., `501234567`). Because the hook enforces `searchPhone.length >= 10`, entering 9 digits causes the system to remain completely dormant. No database query is triggered, leading cashiers to believe the customer is unregistered and creating duplicate profiles.
* **Absence of Customer Name Autocomplete (`src/pages/TailorPos.jsx`):**
  In the walk-in POS view, the customer name field (`setName`) is a passive text input. If a returning customer cannot recall the registered mobile number, the cashier cannot search by customer name. The cashier must navigate away from the POS to `/customers`, look up the customer, copy the phone number, and return to `/tailor-pos`.
* **Arbitrary Customer Collision Selection (`src/hooks/useTailorPos.jsx:235-238`):**
  When multiple customer records match a phone number (common with family accounts sharing a landline or mobile, or existing unmerged duplicates), the hook executes:
  ```javascript
  // src/hooks/useTailorPos.jsx:235-236
  if (res && res.length > 0) {
      const c = res[0];
      setCustomer(c);
      setName(c.name);
  ```
  The system arbitrarily binds the first record (`res[0]`) without displaying a disambiguation list. If a father and son share a number, the son's garment measurements risk being booked under the father's account.
* **Customer CRM History Tailoring Blind Spot (`electron/database.cjs:2625–2637`):**
  In `database.cjs`, `getCustomerHistory(customerId)` only queries the retail tables:
  ```sql
  -- electron/database.cjs:2626
  SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC
  ```
  The query completely omits `tailor_orders`, `tailor_order_garments`, and `alteration_tickets`. When viewing a customer's profile in `/customers`, their tailoring history, active orders, and past alteration records are completely invisible.
* **Missing Phone Number Normalization (`electron/database.cjs:2611`, `src/hooks/useTailorPos.jsx:411`):**
  Neither the POS hook nor `addCustomer` sanitizes phone inputs. Entries such as `+966501234567`, `0501234567`, and `501234567` are inserted as distinct string values, defeating the database unique constraints and splintering customer purchase histories.

---

### Stage 2: Measurement Profiles & Garment Selection

#### 1. Architecture & Codebase Map
* **Measurement Studio:** `src/pages/MeasurementCapture.jsx` (Route `/measurements`, `src/App.jsx:340`).
* **Embedded POS Measurement Grid:** `src/pages/TailorPos.jsx:20–42`.
* **Master Profile Persistence:** `electron/database.cjs:660–671` (`measurement_profiles` table), `database.cjs:3661–3669` (`saveTailorProfile`).
* **Order Creation Hook:** `src/hooks/useTailorPos.jsx:467–474`.

#### 2. Forensic Breakdown of Gaps & Domain Flaws
* **Rigid, One-Size-Fits-All 8-Field Schema (`src/pages/MeasurementCapture.jsx:5–22`):**
  The system hardcodes 8 normalized fields for all garment types:
  ```javascript
  // src/pages/MeasurementCapture.jsx:14-22
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
  * **Men's Suits (`suit`) are Un-tailorable:** The schema lacks jacket half-chest, lapel width, sleeve crown, jacket drop, trouser outseam, trouser inseam, crotch rise, thigh circumference, and knee width. A bespoke suit cannot be cut using these 8 fields.
  * **Undergarments / Sirwal (`sirwal`) Display Irrelevant Anatomy:** When tailoring a traditional Sirwal, the UI displays Neck, Shoulder, and Sleeve fields, while omitting crotch rise, hip, and ankle elastic dimensions.
  * **Authentic Saudi Thobe Specifications Missing:** Traditional Gulf tailoring requires parameters for Al-Khaban (الخبن - hem allowance), Jabzor (الجبزور - front chest pocket reinforcement), Bottom Flare / Da'er (وسع الجلال / وسع الدائر), Collar Height (ارتفاع القلاب), and pocket layout (pen pocket, watch pocket, secret inner pocket). None of these exist in the data model.
* **Total Absence of Ready-to-Wear (RTW) Sizing Standards:**
  The system lacks standard sizing matrices (e.g., Thobe sizes 52S, 54M, 56L, 58XL, 60XXL). For walk-in customers buying pre-cut standard garments, the cashier must manually input all 8 fields from scratch.
* **Destructive Master Profile Overwrite (`src/hooks/useTailorPos.jsx:467–474`):**
  When submitting an order, the hook automatically and unconditionally overwrites the customer's permanent master profile:
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
  If a customer orders a winter thobe and requests a temporary 1-inch sleeve extension to accommodate heavy wool shrinkage, this temporary modification **permanently destroys** their standard summer baseline profile.
* **No Named Profiles or Family Dependent Tracking:**
  The `measurement_profiles` table lacks a `profile_name` or `dependent_name` column. A customer cannot maintain distinct profiles for "Comfort Fit", "Slim Fit", "Formal Bisht", or family members (e.g., "Son: Mohammed").

---

### Stage 3: Tailoring & Cutting Job Assignment

#### 1. Architecture & Codebase Map
* **Workshop Kanban Board:** `src/pages/OrdersBoard.jsx` (Route `/orders-board`, `src/App.jsx:339`).
* **Printable Physical Ticket:** `src/components/TailorWorkOrder.jsx`.
* **Production Schema Tables:** `electron/database.cjs:626–656` (`tailor_orders`, `tailor_order_garments`).
* **Stage Mutation API:** `electron/database.cjs:3643–3650` (`updateGarmentStage`).

#### 2. Forensic Breakdown of Gaps & Workflow Breakdowns
* **Complete Omission of the Cutter Role (`electron/database.cjs:646–656`):**
  In bespoke tailoring, cutting (التفصيل) is a master craft separate from sewing (الخياطة). Yet `tailor_order_garments` only defines:
  ```sql
  -- electron/database.cjs:653
  assigned_tailor_id INTEGER,
  ```
  There is **no `assigned_cutter_id`** column anywhere in the database schema. In `TailorPos.jsx:29`, only one worker (`tailorId`) can be selected. The master pattern cutter receives zero system assignment, zero task dispatching, and zero labor compensation.
* **Absence of Scannable Barcode/QR on Physical Work Tickets (`src/components/TailorWorkOrder.jsx:484–487`):**
  The workshop travel ticket renders a text-only header:
  ```jsx
  // src/components/TailorWorkOrder.jsx:484-486
  <div className="text-xl font-mono font-bold text-gray-800">
      # {invoiceNumber}
  </div>
  ```
  There is no barcode (Code 128) or 2D DataMatrix. As physical garments move between cutting tables, sewing stations, and ironing presses, workers cannot scan the garment bundle to look up specifications or log stage completions. Workers must manually hunt through cards on a touchscreen terminal.
* **Static Worker Assignment Across Multi-Stage Production:**
  A garment traverses 5 production stages (`cutting` -> `stitching` -> `finishing` -> `ironing` -> `ready`), but worker assignment is static. The system cannot assign Cutter A for cutting, Tailor B for body stitching, Tailor C for embroidery/collar finishing, and Worker D for pressing.
* **Unauthenticated Stage Transitions (Zero Accountability) (`src/pages/OrdersBoard.jsx:444`):**
  Any user can click "نقل إلى..." (Advance Stage) on any garment card without entering a worker PIN or scanning an employee badge. The system logs no worker ID in `audit_logs`, making it impossible to identify who completed a stage or who was responsible for a flaw.
* **No Defect or Rework Workflow on the Shop Floor:**
  If a garment fails inspection during finishing, the board's only mechanism is a generic "↩️ رجوع" (Revert) button (`OrdersBoard.jsx:468`). It creates no defect record, captures no rework reason, and logs no penalty against the responsible worker.

---

### Stage 4: Invoicing, Payment & ZATCA Compliance

#### 1. Architecture & Codebase Map
* **POS Calculation & Checkout Hook:** `src/hooks/useTailorPos.jsx:41–60, 418–432`.
* **Thermal Receipt Generator:** `src/hooks/useTailorPos.jsx:481–548` (`handlePrintInvoice`).
* **Retail ZATCA Invoice Reference:** `src/pages/Pos.jsx:896–1050`.
* **Backend Sale & Tax Engine:** `electron/database.cjs:1624–1800` (`saveSale`).
* **ZATCA Cryptographic Engine:** `electron/zatca_phase2_impl.cjs`, `src/utils/qr-gen.js:235–301`.

#### 2. Forensic Breakdown of Legal & Accounting Violations
* **CRITICAL ZATCA VIOLATION: Illegal Thermal Slip in Tailor POS (`src/hooks/useTailorPos.jsx:481–548`):**
  While the standard retail module (`src/pages/Pos.jsx`) generates compliant ZATCA Phase 2 tax invoices with TLV-encoded QR codes and cryptographic hashes, `useTailorPos.jsx` builds a standalone raw HTML string for tailoring receipts:
  ```javascript
  // src/hooks/useTailorPos.jsx:500-538
  const printWindow = window.open('', '', 'width=350,height=600');
  printWindow.document.write(`
      <html>
      <body class="p-2">
          <div class="text-center font-bold mb-2">${businessName}</div>
          <div class="text-center border-b">فاتورة خياطة تفصيل</div>
          <div class="flex mt-2"><span>رقم الفاتورة:</span> <span>#${res?.order_id || invoiceNumber}</span></div>
          ...
          <div class="flex"><span>الضريبة (15%):</span> <span>${vat.toFixed(2)} SAR</span></div>
          <div class="flex font-bold"><span>الإجمالي:</span> <span>${total.toFixed(2)} SAR</span></div>
  `);
  ```
  **Direct Violations of ZATCA E-Invoicing Regulations:**
  1. **NO QR CODE:** The receipt contains **zero QR code** (neither Phase 1 5-tag TLV nor Phase 2 9-tag BER-TLV).
  2. **OMISSION OF VAT NUMBER:** The seller's mandatory 15-digit Tax Identification Number (TIN) is completely omitted.
  3. **ILLEGAL HEADER TITLE:** Uses "فاتورة خياطة تفصيل" instead of the legally required "فاتورة ضريبية مبسطة" (Simplified Tax Invoice).
  4. **OMISSION OF CRYPTOGRAPHIC STAMP & UUID:** The ECDSA digital signature, invoice hash, and cryptographic stamp generated by `saveSale` are discarded and never printed.
  5. **FICTITIOUS INVOICE NUMBER:** Prints `#${res?.order_id || invoiceNumber}` (a random math integer or internal tailor order ID) rather than the sequential, tamper-proof ZATCA tax invoice sequence number.
* **Lump-Sum Single Item Distortion in Sales Registry (`src/hooks/useTailorPos.jsx:430`):**
  When recording the financial transaction in `saveSale`, the hook collapses the entire order:
  ```javascript
  // src/hooks/useTailorPos.jsx:430
  items: [{ item_name: 'تفصيل خياطة', quantity: 1, item_price: finalSubtotal }]
  ```
  Even if a customer orders 5 bespoke thobes, 2 sirwals, luxury Japanese fabric, and custom mother-of-pearl buttons, the official sales record and general ledger record only a single generic item named "تفصيل خياطة". Line-item tax audits and sales analytics are rendered impossible.
* **Deposit vs. Final Balance Tax Timing Mismatch:**
  When an order is created with a 200 SAR deposit on a 1,000 SAR total, `saveSale` books the entire 1,000 SAR as revenue and recognizes the full 150 SAR VAT liability immediately. When the customer pays the remaining 800 SAR weeks later upon collection, no tax invoice or payment receipt is generated, distorting monthly cash and tax reconciliation.
* **Unhandled Crash on 'NO_OPEN_SHIFT' (`electron/database.cjs:1646`):**
  If a cashier has not explicitly opened a shift in `/shift`, `saveSale` throws an uncaught error `NO_OPEN_SHIFT`. `TailorPos.jsx` does not pre-validate shift status, causing order placement to fail abruptly without a helpful error dialog.
* **Orphaned Backend Refund Logic (`electron/database.cjs:3738`):**
  `refundTailorOrder` exists in `database.cjs`, but **no UI exists anywhere in the frontend** to trigger it. Furthermore, the backend implementation fails to generate a ZATCA Credit Note (Invoice Type 381 with `billingRef`).

---

### Stage 5: Fitting, Quality Check & Final Collection

#### 1. Architecture & Codebase Map
* **Order Handover & Pickup Modal:** `src/pages/OrdersBoard.jsx:569–676`.
* **Alteration & Rework Module:** `src/pages/Alterations.jsx` (Route `/alterations`, `src/App.jsx:338`).
* **Backend Order Settlement:** `electron/database.cjs:3786–3795` (`completeTailorOrder`).
* **Alteration Data Layer:** `electron/database.cjs:606–623, 3864–3905` (`alteration_tickets`, `createAlterationTicket`).
* **Fitting Appointment Schema:** `electron/database.cjs:685–694` (`tailor_appointments`).

#### 2. Forensic Breakdown of Gaps & Financial Leakage
* **The "Accounting Black Hole" on Final Balance Collection (`electron/database.cjs:3786–3795`):**
  When a customer picks up their finished garments and pays the remaining balance, `OrdersBoard.jsx:145–164` calls `completeTailorOrder`. The backend execution is:
  ```javascript
  // electron/database.cjs:3786-3795
  function completeTailorOrder({ order_id }) {
      return db.transaction(() => {
          const res = db.prepare(`
              UPDATE tailor_orders 
              SET status = 'delivered', balance_due = 0, deposit_paid = total_amount 
              WHERE id = ?
          `).run(order_id);
          return { success: res.changes > 0 };
      })();
  }
  ```
  **Critical Defect:** While `addTailorPayment` (`database.cjs:3711`) correctly debits Cash/Bank and credits Accounts Receivable, `completeTailorOrder` executes a bare SQL UPDATE on `tailor_orders` and **POSTS ZERO GENERAL LEDGER ENTRIES**. All cash or card payments collected at pickup vanish from the financial ledger. The cash drawer is out of balance, Accounts Receivable remains uncredited, and business owners have no record of final revenue collections.
* **False Delivery Invoice Promise (`src/pages/OrdersBoard.jsx:672`):**
  The delivery modal's primary confirmation button is labeled:
  ```jsx
  // src/pages/OrdersBoard.jsx:672
  <button ...>✓ تأكيد التسليم وإصدار الفاتورة</button>
  ```
  When clicked, the modal simply calls `completeTailorOrder` and displays a toast. **No invoice is generated, no receipt is printed, and no ZATCA document is produced**. The customer leaves the premises with zero proof of final payment.
* **Completely Dead Fitting Appointments Module (`electron/database.cjs:685–694`):**
  The database contains a full schema for `tailor_appointments` (`id`, `customer_id`, `appointment_date`, `stage`, `status`), and `getTailorDashboardStats` (`database.cjs:3820`) counts today's fittings. However, **there is no frontend page or component** to schedule, view, manage, or check-in fitting appointments. Mid-way fittings (بروفة) are untracked.
* **Unlinked Alteration Tickets (Broken Rework Traceability):**
  While `alteration_tickets` has a `linked_order_id` column in SQLite (`database.cjs:609`), `createAlterationTicket` (`database.cjs:3866–3884`) **omits `linked_order_id` from the SQL INSERT statement**. Furthermore, `src/pages/Alterations.jsx` has no field to search for or attach an existing order. All alteration tickets are created as isolated orphans, preventing management from determining whether an alteration is due to tailor error or customer preference.
* **Zero Automated Customer Notifications:**
  When garments transition to `ready` on the Kanban board, no SMS or WhatsApp webhook is triggered. Front-desk staff must manually place phone calls to notify customers that orders are ready for pickup.

---

# 3. Business Operations & Integrity Evaluation (Requirement R2)

---

### 3.1 Cutter Pay Rates and Total Compensation

#### 1. Schema & Backend Analysis
In traditional tailor shops, the Cutter (المفصل) drafts the chalk patterns, shapes collars and sleeves, and cuts the cloth. Cutters are typically compensated on a specialized piece-rate matrix (e.g., 20 SAR per standard thobe cut, 35 SAR per luxury silk or patterned fabric cut, 60 SAR per bespoke suit cut).

* **Database Schema Absence (`electron/database.cjs:646–656`):**
  The production table `tailor_order_garments` defines:
  ```sql
  -- electron/database.cjs:646-656
  CREATE TABLE IF NOT EXISTS tailor_order_garments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tailor_order_id INTEGER,
      garment_type TEXT,
      measurement_profile_id INTEGER,
      fabric_id INTEGER,
      production_stage TEXT DEFAULT 'measuring',
      assigned_tailor_id INTEGER,          -- Only Tailor ID exists!
      special_instructions TEXT,
      FOREIGN KEY (tailor_order_id) REFERENCES tailor_orders(id) ON DELETE CASCADE
  );
  ```
  `assigned_cutter_id` is completely absent.
* **Zero Cutting Compensation Functions:**
  A comprehensive search across all backend modules (`database.cjs`, `accounting.cjs`, `main.cjs`) confirms that there is no function named `getCutterPayroll`, `calculateCutterCommission`, or any logic tracking cut quantities.

#### 2. Frontend Interface Gaps
* In `src/pages/Staff.jsx:408`, the cutter role exists purely as a static `<option value="cutter">فصال / قصاص</option>` in an HTML datalist.
* In `src/pages/TailorPos.jsx:29`, the order creation drawer contains an input for `tailorId` only; no cutter assignment input exists.
* In `src/pages/OrdersBoard.jsx`, garment cards in the "Cutting" (`cutting`) column do not display or allow assigning a cutter.

#### 3. Operational & Commercial Impact
Shop owners cannot calculate cutter earnings within the software. Cutting compensation must be calculated manually on external paper ledgers, defeating the primary purpose of an automated POS system.

---

### 3.2 Tailor Pay Rates and Total Compensation

#### 1. Schema & Backend Analysis
Tailor compensation is intended to run on a piece-rate model via `piece_rate` in `staff` (`database.cjs:448`). However, the backend calculation engine is catastrophically broken:

* **Fatal SQL Column Error (`electron/database.cjs:3843`):**
  ```javascript
  // electron/database.cjs:3839-3850
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
  In table `tailor_orders` (`database.cjs:635`), the column is defined as `is_urgent INTEGER DEFAULT 0`. The query references `o.rush_order`. Executing `getTailorPayroll` causes SQLite to immediately crash with:
  `SqliteError: no such column: o.rush_order`.

#### 2. Frontend IPC Namespace Mismatch (`src/pages/Staff.jsx:60`)
* In `electron/preload.cjs:382`, the payroll handler is exposed under the `tailor` sub-namespace:
  ```javascript
  // electron/preload.cjs:382
  tailor: {
      getPayroll: (d) => ipcRenderer.invoke('tailor:getPayroll', d),
  }
  ```
* In `src/pages/Staff.jsx:60`, the component invokes:
  ```javascript
  // src/pages/Staff.jsx:60
  const data = await window.api.getPayroll({ start_date: startDate, end_date: endDate });
  ```
  Because `window.api.getPayroll` is `undefined`, clicking "عرض مسير الرواتب" (View Payroll) in the UI immediately throws:
  `TypeError: window.api.getPayroll is not a function`.

#### 3. Unassigned Garments in POS Checkout
* In `src/hooks/useTailorPos.jsx:435–459`, order submission builds the garment payload:
  ```javascript
  // src/hooks/useTailorPos.jsx:435-445
  const garmentsList = items.map(i => ({
      garment_type: i.garment_type || 'thobe',
      fabric_id: i.fabric_id,
      measurements: i.measurements,
      special_instructions: i.notes,
      fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5 
  }));
  ```
  `assigned_tailor_id` is never passed in the garment array. In `database.cjs:3587`, garments are inserted into SQLite with `assigned_tailor_id = NULL`. Even if the SQL and API errors are resolved, `getTailorPayroll` groups by `assigned_tailor_id` and returns zero completed pieces for all tailors.

#### 4. Lack of Payout Persistence & General Ledger Posting
In `src/pages/Staff.jsx:140–176`, generating a tailor payout simply opens a temporary browser print window with an HTML summary. The system **does not record the payout transaction in SQLite**, does not mark completed garments as "settled", and does not post double-entry journal entries (Debit: 5100 Direct Labor Expense, Credit: 1111 Cash). Running payroll twice will display the exact same completed garments, leading to duplicate wage payouts.

---

### 3.3 Deductions Due to Defective Items Made by Tailors

#### 1. Absence of Quality Control Checkpoints
In `src/pages/OrdersBoard.jsx:8–14`, the production pipeline transitions directly from `finishing` -> `ironing` -> `ready`. There is no dedicated Quality Control (QC / فحص الجودة) inspection stage. Garments bypass formal defect screening before being marked ready for customer pickup.

#### 2. Lack of Defect Tracking Architecture
* The database contains **no defect tables** (e.g., no `tailor_defects`, `qc_inspections`, or `rework_logs`).
* In `electron/database.cjs:606–623`, `alteration_tickets` lacks columns for `responsible_tailor_id`, `defect_type`, `defect_severity`, `penalty_amount`, and `is_tailor_fault`.
* If a customer returns a thobe because the collar was stitched off-center or the sleeves were cut 2 inches too short, the shop has no way to log the defect or link the rework to the tailor who made the mistake.

#### 3. Customer Penalized Instead of Worker in Cancellations (`electron/database.cjs:3738–3744`)
The only penalty calculation in the tailoring codebase occurs in `refundTailorOrder`:
```javascript
// electron/database.cjs:3744
const refundAmount = order.deposit_paid - (is_cut ? penalty_amount : 0);
```
If fabric has already been cut and an order is cancelled due to shop error, the penalty is deducted from the *customer's refund*, rather than deducted from the responsible worker's compensation.

---

### 3.4 Tracking of Textile / Material Waste

#### 1. Primitive Aggregate Inventory Model
In `electron/database.cjs:697–698`, fabric tracking is shoehorned into the standard retail `products` table via two scalar columns:
```sql
ALTER TABLE products ADD COLUMN is_fabric INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN length_available REAL;
```
* **No Roll-Level Tracking (`fabric_rolls`):** Fabrics arrive in physical bolts or rolls (طاقة قماش) with specific roll numbers, dye lots, and roll widths (e.g., عرض عرضين 58" vs عرض واحد 36"). The software treats 1,000 meters of fabric as an undifferentiated single pool, making it impossible to track individual roll remnants.

#### 2. Hardcoded 3.5-Meter Blind Consumption (`src/hooks/useTailorPos.jsx:442`)
When placing an order, fabric consumption is hardcoded in the frontend:
```javascript
// src/hooks/useTailorPos.jsx:442
fabric_length_used: i.fabric_code === 'BYOF' ? 0 : 3.5
```
Regardless of whether the garment is a child's thobe (requires ~1.8m), an adult thobe (requires ~3.5m), a pair of trousers (requires ~1.5m), or a ceremonial bisht (requires ~6.0m), the software blindly deducts exactly 3.5 meters from `products.length_available`.

#### 3. Zero Visibility into Cutting Scraps & Shrinkage
* Cutters have no interface to enter actual cloth consumed.
* The system provides no tracking for offcut remnants (فواضل القماش) or damaged bolt sections.
* Fabric shrinkage during pre-wash/ironing is unrecorded.
* Physical inventory audits inevitably reveal massive discrepancies between book stock and physical fabric bolts, opening major avenues for textile theft.

---

### 3.5 Fraud Prevention, Cash Management & Role-Based Integrity

#### 1. Zero Backend IPC Authorization (`electron/main.cjs:336–343`)
All backend operations are wrapped in a generic licensing check:
```javascript
// electron/main.cjs:336-343
function _gated(fn) {
    return async (e, ...args) => {
        if (!_isLicenseActive()) {
            return { success: false, error: 'LICENSE_REQUIRED', message: '...' };
        }
        return fn(e, ...args);
    };
}
```
`_gated()` checks **only if the software license is valid**. It performs **zero user authentication or role-based permission checks**. Role gates (`AdminRoute`, `FeatureGate`) exist solely in React frontend components. Any user can open Electron DevTools or emit IPC messages to execute `db:deleteStaff`, `settings:save`, `acct:postJournalEntry`, or `db:voidSale` with zero credentials.

#### 2. Unrestricted Cashier Price Overrides & Invoice Voids
* **Arbitrary Price Overrides (`src/pages/Pos.jsx:2000–2022`):** The "Agreed Total Override" feature allows cashiers to overwrite the total order price to any arbitrary number without requiring a manager PIN or supervisor override.
* **Unsupervised Voids (`src/pages/Pos.jsx:2137`, `src/pages/SalesHistory.jsx:114–122`):** Clicking "إلغاء الفاتورة" (Void Invoice) immediately voids the sale in SQLite without supervisor approval. A cashier can complete a cash transaction, pocket the physical money, and immediately void the invoice.

#### 3. Disconnected Register Shift Reconciliation (`electron/database.cjs:2880`)
In `closeShift`, the expected cash balance is calculated as:
```javascript
// electron/database.cjs:2880
const expectedCash = (shift.starting_cash || 0) + cashSales;
```
If a manager withdraws 500 SAR from the till for supplier delivery or petty cash, that expense is **not deducted** from `expectedCash`. At shift end, the system falsely reports a 500 SAR register shortage. Furthermore, `src/pages/Shift.jsx:46` hardcodes `staffId: null` when opening a shift, preventing attribution of register discrepancies to specific cashiers.

#### 4. Completely Anonymous Audit Logging (`electron/database.cjs:464–470, 2945–2947`)
```javascript
// electron/database.cjs:2945-2947
function addAuditLog(action, details) {
    try { 
        db.prepare('INSERT INTO audit_logs (action, details) VALUES (?,?)').run(action, details); 
    } catch (e) {}
}
```
Although table `audit_logs` defines a `user_id` column, `addAuditLog` accepts only `action` and `details`. `user_id` is **never passed** and defaults to `NULL`. In `src/pages/AuditLogs.jsx:154`, the staff column displays `#?` for every single entry. If fraudulent transactions occur, the audit trail cannot identify the culprit.

---

# 4. Technical Architecture, Security & Code Health Audit (Requirement R3 Foundations)

---

### 4.1 Architecture & Stack Overview
* **Runtime & Shell:** Electron v22.3.27 (`package.json:113`) running on Node.js v16.15.0 internal runtime.
* **Frontend Framework:** React v18.2.0 SPA configured with `react-router-dom: ^6.22.3` HashRouter.
* **Bundler & Build Verification:** Vite v4.4.5. `npx vite build` executes in 32.67s, producing a **monolithic 1.89MB bundle** (`dist/assets/index-c7dc42c9.js`) with zero lazy loading or code splitting.
* **Database Engine:** SQLite via `better-sqlite3: ^9.6.0` (`electron/database.cjs:217`) operating with WAL mode enabled (`PRAGMA journal_mode = WAL`).
* **ZATCA Phase 2 Engine:** Custom pure-JS implementation (`electron/zatca_phase2_impl.cjs`) utilizing ECDSA secp256k1 signing, SHA-256 UBL 2.1 XML digesting, and 9-tag BER-TLV QR generation.

---

### 4.2 Critical Security Vulnerabilities

#### 1. Hardcoded Boot Backdoor (`electron/database.cjs:869–886`)
```javascript
// electron/database.cjs:869-877
try {
    console.log('[Auth] Checking for emergency PIN resets...');
    const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
    if (adminUser) {
        db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
        console.log(`[Auth] Emergency: Admin '${adminUser.name}' (ID: ${adminUser.id}) PIN reset to '1234'`);
    }
```
**Impact:** On every single boot, the application forcibly resets the Administrator PIN to `'1234'` and Cashier PIN to `'0000'`. If a shop owner changes their PIN to protect business data, restarting the app immediately restores the default backdoor PINs.

#### 2. Static-Salt SHA-256 Password Storage (`electron/database.cjs:30–32`)
```javascript
// electron/database.cjs:30-32
function hashPin(pin) {
    return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
}
```
**Impact:** 4-digit PINs encompass only 10,000 combinations (0000–9999). With a static, hardcoded salt, a complete precomputed rainbow lookup table can be generated in under 50 milliseconds, rendering PIN hashing effectively useless against anyone with read access to `pos_data.db`.

#### 3. Arbitrary Local File Read Vulnerability (`electron/main.cjs:782–788`)
```javascript
// electron/main.cjs:782-788
ipcMain.handle('tailor:readAttachment', (e, filePath) => {
    try {
        return { success: true, base64: 'data:image/jpeg;base64,' + fs.readFileSync(filePath).toString('base64') };
    } catch(err) {
        return { success: false, error: err.message };
    }
});
```
**Impact:** The handler accepts any arbitrary `filePath` string from the renderer without directory containment or path validation. An attacker can read arbitrary operating system files (e.g., Windows SAM files, user documents, SSH keys) and exfiltrate them via base64 encoding.

#### 4. Plaintext Master HMAC License Secret (`electron/main.cjs:9`)
```javascript
// electron/main.cjs:9
const _LICENSE_SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b";
```
**Impact:** The cryptographic secret used to generate and validate commercial subscription licenses is hardcoded in plaintext in source code, allowing unrestricted generation of counterfeit enterprise licenses.

---

### 4.3 Broken IPC Endpoints & Hardware Handlers

```
┌──────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Broken Endpoint / Handler            │ Exact Failure Manifestation & Code Citation                            │
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `hw:getPrinters`                     │ Preload (`preload.cjs:215`) calls `hw:getPrinters`. Main process       │
│                                      │ fails to call `registerLabelIPC(db)`. Crashes with "No handler".       │
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `print:label` / `printLabelZPL`      │ Preload (`preload.cjs:217-218`) calls label printing handlers defined  │
│                                      │ in `registerLabelIPC(db)` which is never registered in `main.cjs`.     │
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `kickDrawer`                         │ Called in `useHardware.js:58`. Missing from `preload.cjs` and          │
│                                      │ `main.cjs`. Throws `TypeError: window.api.kickDrawer is not a function`.│
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `openCashDrawer`                     │ Called in `Alterations.jsx:146`. Missing from `preload.cjs` & `main.cjs`.│
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `onSessionExpired`                   │ Called in `src/App.jsx:249`. Missing from `preload.cjs`.               │
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `onSyncNotify`                       │ Called in `src/components/OfflineBanner.jsx:23-24`. Missing from IPC.  │
├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ `window.api.tailor` (Mock API)       │ `src/mockApi.js` completely omits `window.api.tailor`. Running in      │
│                                      │ browser preview crashes immediately on `/tailor-pos` or `/orders-board`│
└──────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Financial Accounting Disconnects & Transaction Gaps

1. **Non-Atomic Dual Asynchronous Order Creation (`src/hooks/useTailorPos.jsx:420–464`):**
   The POS frontend initiates checkout by making two separate IPC calls:
   * Call 1: `window.api.saveSale(...)` (inserts into `sales` and `ledger_entries`).
   * Call 2: `window.api.tailor.createOrder(...)` (inserts into `tailor_orders`).
   If `createOrder` fails (due to a database lock, schema constraint, or power loss), `saveSale` is **never rolled back**. The customer's money is recorded in accounting as an orphaned sale with no production order in the workshop.
2. **100% Off-The-Books Alteration Revenue (`src/pages/Alterations.jsx:264`, `database.cjs:3864`):**
   When creating an alteration ticket, `tailor.createAlteration` inserts records into `alteration_tickets` and `alteration_items`. It **never creates a sale in `sales` and posts zero entries to the general ledger**. When the customer pays the alteration balance upon pickup (`Alterations.jsx:140`), the money is never recorded in the cash drawer or sales journals.
3. **Untracked Order Pickup Balances (`electron/database.cjs:3786`):**
   As established in Stage 5, `completeTailorOrder` updates `balance_due = 0` without posting ledger entries or sales records.
4. **Fabric Inventory Deduction Disconnect (`electron/database.cjs:3597`):**
   When fabric is consumed for an order, `createTailorOrder` updates `products.length_available`, but **does not update `products.stock`** and **does not record a transaction in `stock_movements`**. Fabric consumption does not appear in inventory movement reports or Cost of Goods Sold (COGS) ledgers.

---

### 4.5 Testing, Build Health & CI/CD Pipeline Audit

* **Native Module Binary Incompatibility (ERR_DLOPEN_FAILED):**
  Running `node tests/unit_tests_db.cjs` fails immediately:
  ```
  CRITICAL: Database initialization failed: Error: The module '...better_sqlite3.node'
  was compiled against a different Node.js version using NODE_MODULE_VERSION 110.
  This version of Node.js requires NODE_MODULE_VERSION 127.
  ```
  `better-sqlite3` was compiled for Electron's bundled Node.js (Node 16 / ABI 110) and cannot execute under standard system Node (Node 22 / ABI 127).
* **Non-Idempotent Test Failure under Electron:**
  Running tests via Electron (`npx cross-env ELECTRON_RUN_AS_NODE=1 npx electron tests/unit_tests_db.cjs`) fails on line 35:
  ```
  ❌ TEST FAILED: UNIQUE constraint failed: products.name
  ```
  The test suite does not isolate its SQLite database and fails on subsequent runs due to unique constraint violations.
* **ESLint Code Health Violations:**
  Running `npm run lint` yields **1,864 problems (1,834 errors, 30 warnings)**, primarily due to unconfigured prop-types and lack of lint exclusions for root scripts.
* **Absence of CI/CD Pipeline:**
  The repository contains no `.github/workflows` directory, no automated build pipelines, and no test automation scripts.

---

# 5. Comprehensive Gap & Defect Matrix

The following master reference table catalogs every critical defect and missing feature identified during the audit:

| Category | Defect / Missing Feature | Severity | Codebase Citations | Operational & Financial Risk |
| :--- | :--- | :---: | :--- | :--- |
| **ZATCA Compliance** | Non-Compliant Tailor POS Thermal Receipt | **CRITICAL BLOCKER** | `src/hooks/useTailorPos.jsx:481–548` | Shop closure and heavy regulatory fines from ZATCA for missing QR, VAT number, and invalid header. |
| **Security** | Hardcoded PIN Reset to '1234' on Boot | **CRITICAL BLOCKER** | `electron/database.cjs:869–886` | Complete bypass of admin credentials; unauthorized staff gain full manager privileges on app restart. |
| **Accounting** | Final Balance Collection "Black Hole" | **CRITICAL BLOCKER** | `src/pages/OrdersBoard.jsx:145–164`, `electron/database.cjs:3786–3795` | Cash collected at garment delivery vanishes from GL; cash drawer variance; unreconciled Accounts Receivable. |
| **Workforce** | Tailor Payroll SQL Crash (`rush_order`) | **CRITICAL BLOCKER** | `electron/database.cjs:3843` | Application crashes when computing tailor payroll due to nonexistent column `o.rush_order`. |
| **Workforce** | Tailor Payroll Frontend Namespace Mismatch | **CRITICAL BLOCKER** | `src/pages/Staff.jsx:60`, `electron/preload.cjs:382` | Payroll screen crashes with `TypeError: window.api.getPayroll is not a function`. |
| **Accounting** | 100% Off-the-Books Alteration Revenue | **CRITICAL BLOCKER** | `src/pages/Alterations.jsx:140, 264`, `electron/database.cjs:3864–3905` | Alteration fee collections are completely unrecorded in sales registers, VAT output, and general ledger. |
| **Hardware** | Unregistered Label Printer IPC Handlers | **CRITICAL BLOCKER** | `electron/main.cjs:11`, `electron/hardware.cjs:355`, `preload.cjs:215` | Label/barcode printing crashes with unhandled rejection: `No handler registered for 'hw:getPrinters'`. |
| **Security** | Arbitrary Local File Read Vulnerability | **HIGH** | `electron/main.cjs:782–788` | Unsanitized file path allows exfiltration of arbitrary host OS files via base64 encoding. |
| **Workforce** | Schema Completely Omits Cutters (المفصل) | **HIGH** | `electron/database.cjs:646–656`, `src/pages/Staff.jsx:408` | No `assigned_cutter_id` in schema; zero cutting piece-rate matrix; cutting labor is untracked and unpaid. |
| **Workforce** | Unassigned Garments in POS Checkout | **HIGH** | `src/hooks/useTailorPos.jsx:435–459`, `electron/database.cjs:3587` | All garments created from POS have `assigned_tailor_id = NULL`; tailors receive zero piece-rate credits. |
| **Textile Inventory**| Hardcoded 3.5m Fabric Consumption | **HIGH** | `src/hooks/useTailorPos.jsx:442`, `electron/database.cjs:3597` | Fabric deducted at fixed 3.5m regardless of garment type/size; inventory records diverge from reality. |
| **Fraud Prevention** | Zero Role Authorization on Backend IPC | **HIGH** | `electron/main.cjs:336–343` | Cashiers can invoke admin IPC handlers (delete staff, void sales, edit settings) via DevTools. |
| **Fraud Prevention** | Unrestricted Agreed Total Price Overrides | **HIGH** | `src/pages/Pos.jsx:2000–2022` | Cashiers can discount transactions to 0 SAR or arbitrary amounts without manager PIN. |
| **Customer Journey** | Destructive Measurement Profile Overwrite | **HIGH** | `src/hooks/useTailorPos.jsx:467–474` | Temporary order adjustments permanently overwrite customer's master measurement profile. |
| **Customer Journey** | Unlinked Alteration Tickets | **HIGH** | `electron/database.cjs:3866–3884`, `src/pages/Alterations.jsx:27` | Alteration tickets cannot be linked to original orders; rework causes and tailor errors cannot be tracked. |
| **Customer Journey** | 10-Digit Phone Search Gate in POS | **MEDIUM** | `src/hooks/useTailorPos.jsx:230–232` | Prevents looking up 9-digit Saudi numbers (`50xxxxxxx`), causing redundant customer creation. |
| **Customer Journey** | Rigid 8-Field Measurement Schema | **MEDIUM** | `src/pages/MeasurementCapture.jsx:14–22` | Cannot tailor suits (missing lapel/trouser specs); thobe parameters (Al-Khaban, Jabzor) absent. |
| **Customer Journey** | Missing Barcode on Physical Work Tickets | **MEDIUM** | `src/components/TailorWorkOrder.jsx:484–487` | Physical workshop tickets have no scannable barcode/QR; workshop tracking requires manual search. |
| **Fraud Prevention** | Anonymous Audit Logging (`user_id = NULL`) | **MEDIUM** | `electron/database.cjs:464–470, 2945` | `addAuditLog` discards `user_id`; audit logs display `#?` for staff, defeating forensic investigation. |
| **Fraud Prevention** | Register Closing Ignores Petty Cash Payouts | **MEDIUM** | `electron/database.cjs:2880` | Petty cash drops are not deducted from `expectedCash`, causing false cash drawer shortage alerts. |
| **Testing / CI** | Native Module ABI Mismatch (ABI 110 vs 127) | **MEDIUM** | `tests/unit_tests_db.cjs` | Database tests cannot be run with standard Node.js without rebuilding `better-sqlite3`. |
| **Architecture** | Missing Cash Drawer Hardware Handlers | **LOW** | `useHardware.js:58`, `Alterations.jsx:146` | `kickDrawer` and `openCashDrawer` are missing from IPC, throwing JavaScript TypeErrors. |

---

# 6. Actionable Benchmark Recommendations & Remediation Roadmap

To elevate `my-pos/V4` from its current failing state to a category-defining benchmark for bespoke tailoring POS systems, the engineering team must execute a 5-phase remediation roadmap:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  PRIORITIZED REMEDIATION ROADMAP                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Security & Financial Integrity Hotfixes (Immediate Blocker Resolution)                        │
│ ├─ Remove database.cjs boot PIN backdoor.                                                              │
│ ├─ Integrate compliant ZATCA Phase 2 thermal slip in Tailor POS.                                       │
│ ├─ Fix "Accounting Black Hole" in completeTailorOrder (post GL entries for pickup balances).           │
│ └─ Fix SQL rush_order bug and preload namespace mismatch in tailor payroll.                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Domain Schema & Workforce Modernization (Cutters, Tailors, QC & Deductions)                   │
│ ├─ Add assigned_cutter_id to tailor_order_garments and implement cutting piece-rate matrix.            │
│ ├─ Create tailor_payout_records table to persist payroll settlements and prevent duplicate claims.     │
│ ├─ Introduce a dedicated "QC Inspection" stage on OrdersBoard.                                         │
│ └─ Build tailor defect attribution and penalty deduction engine linked to rework tickets.              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Textile Inventory & Smart Wastage Engine                                                      │
│ ├─ Introduce fabric_rolls table (roll barcodes, initial yardage, remaining yardage, roll width).       │
│ ├─ Replace hardcoded 3.5m consumption with dynamic calculation based on garment type and body length.  │
│ └─ Build cutter waste entry modal to capture remnant scraps and shrinkage adjustments.                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Customer Lifecycle & Tailoring UX Hardening                                                   │
│ ├─ Remove 10-digit phone gate; add instant customer name autocomplete in Tailor POS.                   │
│ ├─ Implement garment-specific measurement schemas (Suits, Thobes, Sirwals) and standard RTW sizing.   │
│ ├─ Add "Temporary Adjustment" toggle to protect master measurement profiles from destructive edits.    │
│ ├─ Fix createAlterationTicket to insert linked_order_id and book alteration revenues in sales/GL.     │
│ └─ Print scannable Code 128 barcodes on physical TailorWorkOrder tickets.                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Hardware, Security Architecture & Production Engineering                                      │
│ ├─ Register hardware.registerLabelIPC(db) in main.cjs; implement kickDrawer and openCashDrawer.       │
│ ├─ Add session-based role authorization middleware to all IPC handlers.                                │
│ ├─ Patch arbitrary file read vulnerability in tailor:readAttachment with path containment.             │
│ └─ Add Rollup manualChunks in vite.config.js to split monolithic 1.89MB bundle.                       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Security & Financial Integrity Emergency Hotfixes

1. **Eradicate Boot Backdoor (`electron/database.cjs`):**
   * Delete lines 869–886 in `database.cjs` that forcibly overwrite Admin and Cashier PINs to `'1234'` and `'0000'` on startup. Replace with a one-time database seed executed only if the `staff` table is completely empty.
2. **Implement Compliant ZATCA Thermal Receipt in Tailor POS (`src/hooks/useTailorPos.jsx`):**
   * Refactor `handlePrintInvoice` in `useTailorPos.jsx` to render the identical compliant thermal receipt component used in `src/pages/Pos.jsx:896–1050`.
   * Ensure every receipt includes:
     * Official title: "فاتورة ضريبية مبسطة" (Simplified Tax Invoice).
     * Seller's 15-digit Tax Identification Number (TIN).
     * Sequential ZATCA invoice sequence number from `sales.invoice_number`.
     * Valid Phase 2 9-tag BER-TLV QR code generated via `generateZatcaTLV9`.
3. **Eliminate the Pickup Balance "Accounting Black Hole" (`electron/database.cjs:3786`):**
   * Update `completeTailorOrder` to accept `payment_method`, `balance_paid`, and `shift_id`.
   * Within the database transaction, post double-entry journal entries:
     * **Debit:** Account 1111 (Cash) or 1112 (Bank Card) for `balance_paid`.
     * **Credit:** Account 1200 (Accounts Receivable) for `balance_paid`.
   * Update the active register shift's `cash_sales` or `card_sales` to keep the physical cash till in balance.
4. **Repair Tailor Payroll Backend & Frontend (`database.cjs`, `Staff.jsx`):**
   * In `database.cjs:3843`, replace `o.rush_order = 1` with `o.is_urgent = 1`.
   * In `src/pages/Staff.jsx:60`, change `window.api.getPayroll(...)` to `window.api.tailor.getPayroll(...)`.
   * In `src/hooks/useTailorPos.jsx:449`, pass `assigned_tailor_id: tailorId` when building `garmentsList`.

---

### Phase 2: Domain Schema & Workforce Modernization (Cutters, Tailors, QC & Deductions)

1. **Establish Cutter Entity & Compensation Matrix:**
   * Execute schema migration on `tailor_order_garments`:
     ```sql
     ALTER TABLE tailor_order_garments ADD COLUMN assigned_cutter_id INTEGER;
     ALTER TABLE staff ADD COLUMN cutter_piece_rate REAL DEFAULT 0;
     ```
   * Add a cutter selection dropdown in `TailorPos.jsx` and `OrdersBoard.jsx`.
   * Create `getCutterPayroll` in `database.cjs` calculating completed cuts multiplied by `cutter_piece_rate`.
2. **Persist Payroll Settlements & Ledger Integration:**
   * Create `tailor_payout_records` (`id`, `staff_id`, `role`, `period_start`, `period_end`, `pieces_count`, `total_amount`, `paid_at`, `journal_entry_id`).
   * Flag settled garments in `tailor_order_garments` (`is_settled INTEGER DEFAULT 0`) to prevent duplicate payouts.
   * Post journal entry upon payout: Debit Account 5100 (Direct Labor Expense), Credit Account 1111 (Cash/Bank).
3. **Introduce QC Inspection Stage & Defect Attribution:**
   * Update `STAGES` in `OrdersBoard.jsx` to insert `{ id: 'qc', label: 'فحص الجودة (QC)', icon: '🔍' }` between `finishing` and `ironing`.
   * Create `tailor_defects` table (`id`, `garment_id`, `tailor_id`, `cutter_id`, `defect_reason`, `rework_cost`, `penalty_deduction`, `status`).
   * Deduct logged penalties directly from worker net pay in `getTailorPayroll` and `getCutterPayroll`.

---

### Phase 3: Textile Inventory & Smart Wastage Engine

1. **Implement Roll-Level Fabric Inventory (`fabric_rolls`):**
   * Create table `fabric_rolls` (`id`, `product_id`, `roll_barcode`, `initial_meters`, `remaining_meters`, `roll_width_inches`, `dye_lot`, `status`).
   * Print barcode labels for physical fabric bolts upon purchase receipt.
2. **Dynamic Smart Consumption Engine:**
   * Replace the hardcoded `3.5` meters in `useTailorPos.jsx` with an algorithmic estimator:
     $$\text{Estimated Consumption (m)} = \left(\frac{\text{Body Length (cm)} + \text{Sleeve Length (cm)} + \text{Hem Allowance (15 cm)}}{100}\right) \times \text{Width Multiplier}$$
     *(e.g., standard adult thobe on 58" cloth $\approx 3.25\text{m}$; child thobe $\approx 1.80\text{m}$; sirwal $\approx 1.40\text{m}$).*
3. **Cutter Waste & Scrap Tracking Interface:**
   * When advancing a garment from `cutting` to `stitching` on the Kanban board, prompt the cutter to enter actual meters cut and categorize remnants:
     * **Usable Scrap (فواضل):** Returned to stock with secondary barcode for collars/pockets.
     * **True Waste / Offcuts (هالك):** Booked to Account 4110 / 5200 (Material Scrap Loss).

---

### Phase 4: Customer Lifecycle & Tailoring UX Hardening

1. **Streamline Walk-in Customer Lookup:**
   * Change `useTailorPos.jsx:231` to trigger search when `searchPhone.length >= 9`, and normalize inputs (stripping `+966`, leading `0`, and whitespace).
   * Add real-time customer name autocomplete with debounced queries.
   * If multiple customers match a phone number, display a modal dialog to select the intended customer profile.
2. **Garment-Specific Measurement Schemas & RTW Sizing Charts:**
   * Dynamically render measurement inputs based on `garment_type`:
     * **Thobe:** Length, Shoulder, Chest, Sleeve, Neck, Wrist, Bottom Flare (وسع الدائر), Khaban (الخبن), Jabzor (الجبزور), Collar Height.
     * **Suit:** Jacket Length, Half-Chest, Waist, Shoulder, Sleeve Crown, Lapel Width, Trouser Outseam, Trouser Inseam, Waist, Crotch Rise, Thigh, Knee.
     * **Sirwal:** Length, Waist, Hip, Crotch Rise, Ankle Elastic.
   * Provide pre-loaded Saudi standard Ready-to-Wear sizing templates (52, 54, 56, 58, 60, 62).
3. **Preserve Master Profiles via Temporary Order Adjustments:**
   * In `TailorPos.jsx`, add a toggle: `"تعديل مؤقت لهذا الطلب فقط (لا تعدل المقاس الأساسي)"` (Temporary Adjustment for this order only).
   * When enabled, save custom measurements strictly in `tailor_order_garments.measurements_json` and bypass `saveTailorProfile`.
4. **Link Alterations to Sales & Orders:**
   * In `Alterations.jsx`, provide an order lookup search box to populate `alteration_tickets.linked_order_id`.
   * Treat alteration ticket creation as a billable transaction (or free warranty rework if flagged as shop error), generating a sale in `sales` and printing a ZATCA simplified tax invoice.
5. **Physical Ticket Barcode Integration:**
   * In `TailorWorkOrder.jsx`, replace plain text `# {invoiceNumber}` with an SVG Code 128 barcode encoding `{order_id}-{garment_id}`, enabling fast USB barcode scanner workflows across workshop stations.

---

### Phase 5: Hardware & Production Engineering

1. **Register Hardware Handlers in Main Process:**
   * In `electron/main.cjs:11`, call `hardware.registerLabelIPC(db)` during startup.
   * Implement missing cash drawer handlers in `main.cjs` and `preload.cjs`:
     ```javascript
     ipcMain.handle('hw:kickDrawer', () => hardware.openCashDrawer());
     ```
2. **Enforce Backend IPC Role-Based Access Control:**
   * Refactor `_gated()` in `main.cjs` into an authenticated session middleware:
     ```javascript
     function _requireRole(allowedRoles, fn) {
         return async (event, sessionToken, ...args) => {
             const user = validateSession(sessionToken);
             if (!user || !allowedRoles.includes(user.role)) {
                 throw new Error('UNAUTHORIZED_ACTION');
             }
             return fn(event, ...args);
         };
     }
     ```
3. **Sanitize Local File Access:**
   * In `tailor:readAttachment` (`main.cjs:782`), restrict `filePath` to the application's dedicated `attachments` directory inside `app.getPath('userData')` to eliminate local file traversal vulnerabilities.
4. **Vite Bundle Optimization:**
   * Configure `manualChunks` in `vite.config.js` to split heavy dependencies (`recharts`, `lucide-react`, `better-sqlite3-fallback`, `i18next`) into asynchronous chunks, reducing the main bundle from 1.89MB to <300KB.

---

### Final Assessment & Benchmark Elevation Summary
Implementing the five phases outlined in this engineering blueprint will resolve every legal and financial vulnerability in `my-pos/V4`. By uniting the existing strengths of its ZATCA Phase 2 cryptographic engine and double-entry accounting core with genuine bespoke tailoring workflows (cutters, roll-level fabric management, defect attribution, and flexible measurement architectures), `my-pos/V4` will transcend standard retail adaptations and establish itself as the **gold standard benchmark for tailor enterprise systems across the GCC region**.
