# Handoff Report � Explorer 1 (Codebase & Route Mapper)
**Milestone:** Mulam Pipeline Survey & Audit  
**Date:** 2026-09-10  
**Folder:** `c:\my-pos\V4\.agents\teamwork_preview_explorer_survey_1`  
**Report Artifact:** `c:\my-pos\V4\.agents\teamwork_preview_explorer_survey_1\survey_report.md`  

---

## 1. Observation

### Exact File Paths & Code Locations Inspected:
1. **Route Registrations (`c:\my-pos\V4\src\App.jsx` lines 336�341):**
   ```jsx
   {/* -- Tailor-specific -- */}
   <Route path="/tailor-pos"       element={<P><TailorPos /></P>} />
   <Route path="/alterations"       element={<P><Alterations /></P>} />
   <Route path="/orders-board"     element={<P><OrdersBoard /></P>} />
   <Route path="/measurements"     element={<P><MeasurementCapture /></P>} />
   <Route path="/customer-menu"    element={<CustomerMenu />} />
   ```
2. **Navigation Sidebar Deficiencies (`c:\my-pos\V4\src\components\AppLayout.jsx` lines 26�51, 185�199):**
   - Lines 28�32 list `LINKS`: `/orders-board` and `/measurements` are registered.
   - `/tailor-pos` and `/alterations` are **completely absent** from the `LINKS` array.
   - Lines 189�194:
     ```javascript
     // Tailor specific
     if ((link.path === '/orders-board' || link.path === '/measurements') && businessType !== 'tailor') return false;
     // Hide general POS features if Tailor is selected (tailors use tailor-checkout instead)
     if (businessType === 'tailor' && (link.path === '/pos' || link.path === '/services')) return false;
     ```
3. **The Alterations Isolation Trap (`c:\my-pos\V4\src\pages\Alterations.jsx` lines 135�143):**
   - Line 136 starts with: `<div className="tailor-pos-page" style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>`.
   - There is NO `<AppLayout>` wrapper, NO navigation bar, and NO back button.
   - The only entrance into this page in the entire codebase is in `TailorPos.jsx` line 89:
     ```jsx
     <button onClick={() => navigate('/alterations')} style={{ background: '#fef2f2', color: '#ef4444', ... }}>
         <span>??</span>
         <span>????? ?????????</span>
     </button>
     ```
4. **Header Target Inconsistency (`src/pages/TailorPos.jsx` line 85, `src/pages/OrdersBoard.jsx` line 170, `src/pages/MeasurementCapture.jsx` line 203):**
   - In all three pages, the button labeled "????????" executes `navigate('/dashboard')` rather than `navigate('/home')`.
   - In `src/App.jsx` lines 81�83:
     ```javascript
     if (role !== 'admin') return <Navigate to={businessType === 'tailor' ? '/tailor-pos' : '/pos'} replace />;
     ```
     When a cashier or tailor clicks "????????", they are routed to `/dashboard`, intercepted by `AdminRoute`, and redirected back to `/tailor-pos`.
5. **Tailor Control Center in Home (`c:\my-pos\V4\src\pages\Home.jsx` lines 52�58, 69�129, 278�316):**
   - Tailor KPI stats queried via `window.api?.tailor?.getDashboardStats?.()`.
   - Mulam widgets render: New Orders Today, Today Revenue, Ready for Pickup, Overdue Orders, Low Fabrics Alert, Scheduled Fittings Today, Recent Deliveries.
   - Quick launch modules list `tailor-pos`, `orders-board`, `customers`, `stock`, `dashboard`, `settings`.
   - **Missing:** Any tile or metric for Alterations (`/alterations`).
6. **Backend IPC & Database Schema (`c:\my-pos\V4\electron\database.cjs` lines 606�695, 3551�3910):**
   - Tables: `tailor_orders`, `tailor_order_garments`, `alteration_tickets`, `alteration_items`, `measurement_profiles`, `customer_attachments`, `tailor_appointments`.
   - Preload IPC: `electron/preload.cjs` lines 367�391 exposes `window.api.tailor.*`.

---

## 2. Logic Chain

1. **Premise:** A professional tailoring POS workflow must connect order intake, production monitoring, alterations, and customer measurement archives seamlessly without user entrapment.
2. **Step 1 (Observation 1 & 2):** In `App.jsx`, routes `/tailor-pos`, `/alterations`, `/orders-board`, and `/measurements` are defined, but `AppLayout.jsx` only registers `/orders-board` and `/measurements` in its sidebar links, ignoring `/tailor-pos` and `/alterations`.
3. **Step 2 (Observation 3):** `Alterations.jsx` does not implement `AppLayout`, nor does it provide a header with back navigation. Once navigated to `/alterations`, the user cannot return to the tailoring POS, orders board, or home dashboard without manual URL entry.
4. **Step 3 (Observation 4):** Navigation back buttons in `/tailor-pos`, `/orders-board`, and `/measurements` point to `/dashboard` instead of `/home`. For non-admin tailor users, `AdminRoute` immediately bounces them back to `/tailor-pos`, creating a confusing loop.
5. **Step 4 (Observation 5):** `Home.jsx` acts as the control center, featuring tailored Mulam widgets (fabrics, fittings, deliveries), but completely excludes `/alterations` and links to generic `/customers` rather than `/measurements`.
6. **Step 5 (Survey & Component Hierarchy):** All business logic and IPC handlers (`useTailorPos.jsx`, `TailorWorkOrder.jsx`, `electron/database.cjs`) already support multi-piece orders, urgent fees, gift orders, fabric deduction, stage progression, and alteration tickets. The core issue is frontend structural fragmentation and navigational disconnection.

---

## 3. Caveats

- **Network / Remote Sync:** This survey focused strictly on local React code and Electron SQLite IPC handlers; remote cloud sync (`syncEngine.cjs`) was not audited for tailor schema synchronization.
- **Hardware Peripherals:** Physical ESC/POS thermal printers and barcode scanners were reviewed via code handlers (`printHTML`, `JsBarcode`), but not tested against physical hardware devices.
- **Other Business Types:** Verified that `businessType === 'restaurant'` and `retail` behave independently and do not conflict with `tailor` routes.

---

## 4. Conclusion

The "Mulam" experience pipeline consists of five primary screens (`/home`, `/tailor-pos`, `/orders-board`, `/alterations`, `/measurements`) backed by robust SQLite tables and Electron IPC endpoints. However, it is currently impaired by:
1. **Navigational Dead Ends:** The alteration workflow is trapped and unlinked in sidebar/home.
2. **Missing Layout Standardization:** Mulam screens bypass `AppLayout`, resulting in lost sidebar navigation, inconsistent headers, and broken home links.
3. **UI Real-Estate Inefficiencies:** `TailorPos.jsx` suffers from screen clutter due to a permanent 33% print preview pane.
4. **Pipeline Disconnections:** Customer measurement profiles in `/measurements` do not connect to new order creation in `/tailor-pos`.

The redesign must integrate all Mulam destinations into a unified navigation rail, standardize page wrappers, connect measurement profiles directly to order intake, and provide two-way status control for alterations and workshop boards.

---

## 5. Verification Method

To independently verify these findings:
1. **Route Inspection:** Check `src/App.jsx` lines 336�341.
2. **Sidebar Links:** Inspect `src/components/AppLayout.jsx` lines 26�51 and observe that `/tailor-pos` and `/alterations` are absent.
3. **Navigation Dead End Reproduction:** In `src/pages/Alterations.jsx`, check lines 135�145 to confirm the lack of header, back buttons, and `AppLayout`.
4. **Automated End-to-End Test Execution:**
   - Execute Playwright test scripts:
     ```powershell
     node tests/playwright_tailor.js
     node tests/playwright_alterations.js
     node tests/playwright_draft_quote.js
     ```
   - These scripts launch Electron and confirm the current route behavior.
