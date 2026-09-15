# Mulam (??????) Experience Pipeline — Comprehensive Codebase & Route Map
**Project:** Mulam Pipeline Redesign  
**Explorer:** Explorer 1 (Codebase & Route Mapper)  
**Date:** 2026-09-10  
**Workspace:** `c:\my-pos\V4`  

---

## 1. Executive Summary & Context

In the Saudi/Gulf tailoring and thobe context, **"Al-Mulam" (?????? / Maulam)** refers to the master tailor and production supervisor. The Mulam experience within Smart Touch POS (`smart-touch-pos` v1.8.5) encompasses the end-to-end lifecycle of custom garments and alterations:
1. **Intake & Profiling:** Customer measurements capture, body adjustments, style configuration (collars, cuffs, pockets), fabric calculation.
2. **Order Creation & Financials:** Deposit collection, balance calculation, ZATCA simplified tax invoice generation, draft/quote options.
3. **Workshop Production Board:** Multi-stage Kanban tracking (`cutting` ? `stitching` ? `finishing` ? `ironing` ? `ready`) across individual garments.
4. **Alterations & After-Sales:** Specialized intake for garment adjustments, instructions, separate tickets, thermal barcode slips, status progression (`pending` ? `in_progress` ? `ready` ? `delivered`).
5. **Control Center Dashboard:** Operational KPIs (today orders, revenue, ready for pickup, overdue alerts, fabric shortages, fittings schedule).

Currently, this pipeline suffers from severe architectural fragmentation:
- **Navigation Disconnects & Dead Ends:** Critical pages (especially `/alterations`) lack layout wrappers, back buttons, and sidebar visibility.
- **Inconsistent Navigation Patterns:** Header links in `/tailor-pos`, `/orders-board`, and `/measurements` navigate unpredictably to `/dashboard` instead of `/home`, and use completely disjoint header styles.
- **UI Clutter & Rigid Layouts:** 3-column desktop layout in `/tailor-pos` forces a permanent 33% screen print-preview sheet, crushing the measurement fields.
- **Broken Data Bridges:** Measurement profiles in `/measurements` cannot directly launch a new tailoring order in `/tailor-pos`.

---

## 2. Complete Inventory of Mulam Pages & Routes

| Route / Screen | File Path | Entry Points & Visibility | Main Purpose & Responsibilities | Layout Wrapper |
|---|---|---|---|---|
| **`/tailor-pos`** | `src/pages/TailorPos.jsx` | Quick Launch on `/home`; Fallback route for non-admin tailor staff in `App.jsx` (line 81, 89); Button in `/orders-board` | Primary tailoring POS screen: customer search, measurement capture, fabric selection, garment options, live draft preview, order & invoice generation. | **Custom Header** (No `AppLayout`) |
| **`/alterations`** | `src/pages/Alterations.jsx` | Single button in `/tailor-pos` header (line 89) | Alterations Kanban & ticket creator: intake of thobes/shirts/pants for alteration, instruction logging, fee/deposit, print barcode ticket, status transitions. | **None** (No header, No `AppLayout`, Dead-end) |
| **`/orders-board`** | `src/pages/OrdersBoard.jsx` | Sidebar (`AppLayout.jsx` line 29); Quick launch on `/home`; Button in `/tailor-pos` | Production Kanban board: 5 stages (??? ?????? ?????? ???? ????), per-garment advancement, delayed deposit modal, delivery modal. | **Custom Header** (No `AppLayout`) |
| **`/measurements`** | `src/pages/MeasurementCapture.jsx` | Sidebar (`AppLayout.jsx` line 32); URL query `?customer_id=X` | Measurement book: customer lookup directory, profile editor, inch/cm unit toggle, history comparison with delta diffs, reference photo attachments, print. | **Custom Header** (No `AppLayout`) |
| **`/home`** (Mulam Mode) | `src/pages/Home.jsx` | Default route on login; Sidebar (`/home`) | Operational Control Center: Tailor KPI summary cards, Mulam Control Center widgets (low fabric alert, today fittings, recent deliveries), quick launch tiles. | `<AppLayout>` |
| **`/settings`** (Tab `tailor`) | `src/pages/Settings.jsx` (lines 1096-1145) | Sidebar (`/settings`); Tab "??????? ???????" | Tailor shop settings: fabric units (meter/yard/inch/cm), default delivery days, thobe calculation method (fixed vs formula), garment consumption standards. | `<AppLayout>` |

---

## 3. Supporting Components, Hooks & Backend Modules

### 3.1 Frontend Components & Styles
- **`src/components/TailorWorkOrder.jsx`** (587 lines):
  - A4 printable cutting sheet / work order for workshop cutting masters.
  - Implements silhouettes (`ThobeSilhouette`, `SirwalSilhouette`, `BishtSilhouette`, `ShirtSilhouette`).
  - Renders detailed measurement matrix (?????? ?????? ?????? ?????? ??????? ????? ???) and style check-cells (????? ???? ???? ?????).
- **`src/components/GarmentIcons.jsx`** (127 lines):
  - Inline scalable SVG silhouettes for traditional garments.
- **`src/components/AppLayout.jsx`** (491 lines):
  - Application sidebar and navigation bar.
  - Gated by `businessType === 'tailor'`: filters out retail POS (`/pos`, `/services`), displays `/orders-board` and `/measurements`.
  - **Critical Gap:** Neither `/tailor-pos` nor `/alterations` is defined in `LINKS` array!
- **`src/pages/TailorPos.css`** (304 lines):
  - Custom styles for `tailor-pos-page`, pills, measurement inputs, category pills, preview scaling.

### 3.2 Frontend Hooks & Business Logic
- **`src/hooks/useTailorPos.jsx`** (501 lines):
  - State manager for tailoring POS workflow:
    - Customer search by phone (`handlePhoneSearch`, fetches customer and latest measurement profile).
    - Multi-piece order support (`items` array with `addItem`, `cloneItem`, `removeItem`).
    - Urgent order calculation (`isUrgent`, `urgentFee`).
    - Gift order handling (`isGift`, `recipientName`, `recipientPhone`).
    - Fabric selection & pricing (in-house fabric vs BYOF "?? ???? ?????").
    - VAT computation (`15%`) and multi-tender split payments (Cash, Card, Split).
    - Order submission: invokes `window.api.saveSale`, `window.api.tailor.createOrder`, and `window.api.tailor.saveProfile`.
    - Thermal receipt HTML generator.

### 3.3 Electron IPC Backend Layer
- **Preload API (`electron/preload.cjs` lines 367-391):**
  - Exposes `window.api.tailor`:
    - `createAlteration(payload)`
    - `getAlterations()`
    - `updateAlterationStatus({ ticket_id, status })`
    - `createOrder(payload)`
    - `saveProfile(payload)`
    - `getOrderBySale(invoiceId)`
    - `getOrders(filters)`
    - `getGarments(orderId)`
    - `updateStage({ garment_id, stage })`
    - `getMeasurements({ customer_id, garment_type })`
    - `completeOrder({ order_id, payment_method, balance_paid })`
    - `getDashboardStats()`
    - `getPayroll({ start_date, end_date })`
    - `getAttachments(customer_id)`
    - `saveAttachment(payload)`
    - `mergeCustomers({ primary_id, duplicate_id })`
    - `addPayment({ order_id, amount_paid, payment_method })`
    - `refundOrder({ order_id, is_cut, penalty_amount })`
- **Main IPC Handlers (`electron/main.cjs` lines 743-785):**
  - Bridges IPC channels directly to `database.cjs` with license feature gating (`_gated`).
- **Database Architecture (`electron/database.cjs`):**
  - Tables:
    1. `tailor_orders`: Master tailoring orders (status: `pending`, `delivered`, `draft`, `quote`, `cancelled`).
    2. `tailor_order_garments`: Individual pieces tied to an order with `production_stage` (`cutting`, `stitching`, `finishing`, `ironing`, `ready`).
    3. `alteration_tickets`: Independent alteration tickets with `status` (`pending`, `in_progress`, `ready`, `delivered`).
    4. `alteration_items`: Garment items per alteration ticket with instructions and fees.
    5. `measurement_profiles`: Customer measurement records (`measurements_json`, `status`).
    6. `customer_attachments`: Image and document attachments per customer.
    7. `tailor_appointments`: Scheduled fittings/trials (`appointment_date`, `purpose`).

---

## 4. Current Navigation & Workflow Connectivity Graph

```
                        +-------------------------------+
                        ¦      Login & Onboarding       ¦
                        +-------------------------------+
                                        ¦
                                        ?
+-------------------------------------------------------------------------------+
¦                          Home Screen (`/home`)                                ¦
¦  - KPI Cards: Today Orders, Today Revenue, Ready for Pickup, Overdue Orders   ¦
¦  - Mulam Control Center: Low Fabrics, Scheduled Fittings, Recent Deliveries   ¦
¦  - Modules Grid: Tailor POS, Orders Board, Customers, Stock, Dashboard, Sett. ¦
+-------------------------------------------------------------------------------+
                ¦                               ¦
       (Click: New Order)            (Click: Ready / Orders Board)
                ¦                               ¦
                ?                               ?
+-------------------------------+               +-------------------------------+
¦   Tailor POS (`/tailor-pos`)  ¦               ¦ Orders Board (`/orders-board`)¦
¦  - 3-Col Layout: Form/Meas/Prv¦?--------------¦  - 5-Stage Kanban             ¦
¦  - Custom Header              ¦               ¦  - Delayed Deposit Modal      ¦
¦  - Red Button to Alterations  ¦               ¦  - Customer Delivery Modal    ¦
+-------------------------------+               +-------------------------------+
        ¦               ¦                               ¦
 (Click: Alterations)   ¦ (Print / Submit)              ¦ (Navigates to Dashboard)
        ¦               ¦                               ¦
        ?               ?                               ?
+----------------+  +---------------+           +-------------------------------+
¦  Alterations   ¦  ¦ Thermal & A4  ¦           ¦     Admin Dashboard           ¦
¦ (`/alterations`)¦  ¦ Print Sheets  ¦           ¦       (`/dashboard`)          ¦
¦                ¦  +---------------+           +-------------------------------+
¦ *DEAD END*     ¦
¦ No Header      ¦
¦ No Sidebar     ¦
¦ No Back Button ¦
+----------------+

                  +-----------------------------------------------+
                  ¦    Measurement Capture (`/measurements`)      ¦
                  ¦  - Customer Search Mode (when no ID)          ¦
                  ¦  - Profile Edit / Comparison / Attachments    ¦
                  ¦  *DISCONNECTED* from TailorPos order intake!  ¦
                  +-----------------------------------------------+
```

---

## 5. Critical UX Gaps, Inconsistencies & Friction Points

### 5.1 Route Isolation & Navigation Traps
1. **The Alterations Dead End (`/alterations`):**
   - Does not use `AppLayout` or any header navigation bar.
   - Once the user clicks "????? ?????????" from `/tailor-pos`, they are trapped on `/alterations`. There is no link to go back to `/tailor-pos`, `/orders-board`, or `/home`.
   - `/alterations` is absent from `AppLayout.jsx` sidebar links and absent from `/home` launch modules.
2. **Missing Mulam Links in `AppLayout.jsx`:**
   - In `AppLayout.jsx`, the only tailor links are `/orders-board` and `/measurements`.
   - `/tailor-pos` (the main daily POS tool) is NOT in the sidebar.
   - `/alterations` is NOT in the sidebar.
3. **Disjointed Layouts (The "No AppLayout" Syndrome):**
   - Four core Mulam screens (`/tailor-pos`, `/alterations`, `/orders-board`, `/measurements`) do NOT render `<AppLayout>`.
   - When transitioning from `/home` to any of these screens, the persistent 56px/240px sidebar and ZATCA status bar completely vanish.
   - Each page implements its own mismatched top header with inconsistent buttons, colors, and font styles.
4. **Header Target Inconsistency:**
   - On `/tailor-pos`, `/orders-board`, and `/measurements`, the back/home button is labeled "????????" or "? ????????", but points to `/dashboard` instead of `/home`.
   - In contrast, the app’s actual home page is `/home`. Non-admin users who click this button trigger an `AdminRoute` redirect loop back to `/tailor-pos`!

### 5.2 Information Architecture & Screen Flow Friction
1. **Disconnected Measurement Profiles:**
   - When a tailor opens `/measurements` and views a customer's profile, there is NO "??? ????? ????" (Start New Order) CTA button to seamlessly open `/tailor-pos?customer_id=X`.
   - Conversely, on `/tailor-pos`, when entering a phone number, previous measurements are fetched, but there is no direct link to view the customer's full measurement history or style photo attachments in `/measurements`.
2. **Orders Board Stage Progression Friction:**
   - Advancing garments in `OrdersBoard.jsx` uses small individual buttons (`??? ??? ... ?` / `????`).
   - If an order has multiple thobes, each must be clicked individually.
   - There is no unified view or tab for Alteration tickets on the Orders Board; alterations live on a completely separate, disconnected page.
3. **Rigid 3-Column Layout Clutter in `TailorPos.jsx`:**
   - Column 3 (`preview-col`, live print sheet) takes up 33% of the desktop viewport continuously.
   - On tablets (1024px or 768px in landscape), this forces Columns 1 & 2 into cramped vertical scrolling stacks where number inputs are truncated.
   - The preview sheet should be accessible via a toggle/drawer/modal rather than permanently occupying prime screen real estate.
4. **Unit Measurement Inconsistency:**
   - In `TailorPos.jsx`, measurements are input with an inline unit toggle (`in` vs `cm`), but default labels and placeholders vary between components.
   - In `MeasurementCapture.jsx`, field labels in the form are rendered using English keys (`length`, `shoulder`, `chest`, `waist`, `sleeve`, `neck`) rather than clean Arabic labels (?????? ?????? ?????? ?????? ????? ??????).
5. **Lack of Tailor Auto-Selection:**
   - In `TailorPos.jsx`, `<select id="tailorSelect">` defaults to the first staff member in the list or blank, rather than auto-detecting the logged-in staff member.

---

## 6. Target Architectural Recommendations for UI/UX Redesign

Following `ui_ux_pro_max` and `AGENTS.md` ("Workflow-First" ergonomic philosophy):

1. **Unified Navigation Hub:**
   - Integrate all Mulam screens into `AppLayout.jsx` under a dedicated "??????? ????????" (Tailoring) category rail when `businessType === 'tailor'`:
     - ? ??? ????? ???? (`/tailor-pos`)
     - ?? ????? ??????? (`/alterations`)
     -  ???? ?????? ???????? (`/orders-board`)
     -  ??? ???????? (`/measurements`)
   - Standardize all page wrappers to use `<AppLayout>` or a consistent high-speed POS full-bleed workspace with a shared top bar.
2. **Bi-Directional Pipeline Connectivity:**
   - `/measurements` ? Add primary CTA: "????? ??? ????? ???? ??????" ? opens `/tailor-pos?customer_id=X`.
   - `/tailor-pos` ? Add quick link: "??? ????? ?????????" ? opens modal or drawer linking to `/measurements`.
   - `/orders-board` ? Add header tab or toggle to switch between **????? ??????? (Tailoring Orders)** and **????? ??????? (Alterations)**, or include alteration cards in the workflow.
   - `/home` ? Add Alterations card to Mulam KPI widgets (showing pending and ready alterations).
3. **Ergonomic Workspace in `TailorPos`:**
   - Adopt a 2-column ergonomic layout:
     - Left (60%): Fast measurement matrix with Arabic labels, quick numpad jump (`onKeyDown` auto-focus), collar/cuff style visual selector.
     - Right (40%): Customer info, delivery scheduler (3/7/10 days), and payment summary.
     - Move the live A4 print preview to a dedicated "?????? ???????? / ???????" sheet drawer or modal.
4. **Resilient Alteration Ticket Lifecycle:**
   - Update `Alterations.jsx` to feature a full top header, status filtering tabs, 2-way status progression (with reversible steps), and seamless barcode thermal receipt printing.

---

## 7. Component Hierarchy & File Path Matrix

```
src/
+-- App.jsx [Lines 336-341: Mulam Route Definitions]
+-- components/
¦   +-- AppLayout.jsx [Lines 26-61, 185-199: Sidebar & Category Rail]
¦   +-- TailorWorkOrder.jsx [A4 Print Sheet & Measurement Matrix]
¦   +-- GarmentIcons.jsx [SVG Garment Silhouettes]
+-- hooks/
¦   +-- useTailorPos.jsx [Tailoring Business Logic, State, Calculations]
+-- pages/
¦   +-- Home.jsx [Lines 53-58, 69-129, 278-316: Mulam KPI Widgets & Launch Tiles]
¦   +-- TailorPos.jsx [Intake POS, Measurements Entry, Garment Config]
¦   +-- TailorPos.css [Styling for Tailor POS Workspace]
¦   +-- Alterations.jsx [Alterations Intake & Status Kanban]
¦   +-- OrdersBoard.jsx [Production Workshop Stage Board]
¦   +-- MeasurementCapture.jsx [Customer Measurement Profile Book]
¦   +-- Settings.jsx [Lines 1096-1145: Tailor Shop Configuration Tab]
electron/
+-- database.cjs [Schema lines 606-695; Methods lines 3551-3910]
+-- main.cjs [IPC Handlers lines 743-785]
+-- preload.cjs [IPC API Bridge lines 367-391]
```
