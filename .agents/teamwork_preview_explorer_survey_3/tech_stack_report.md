# 🛠️ Frontend Architecture & Tech Stack Investigation Report
**Project:** Mulam Pipeline Redesign — Smart Touch POS (البصمة الذكية v2)  
**Investigator:** Explorer 3 (Frontend Architecture & Tech Stack Specialist)  
**Date:** 2026-09-10  
**Target Path:** `c:\my-pos\V4`

---

## 1. Executive Summary

An in-depth architectural audit of the `c:\my-pos\V4` frontend codebase was conducted to support the unified **Mulam (Master Tailor / الخياطة والتفصيل)** pipeline redesign. 

### Key Discoveries:
1. **Modern Core Stack**: The application is built on **React 18.2.0**, **React Router DOM 6.22.3** (HashRouter mode for Electron compatibility), **Vite 4.4.5**, and **Electron 22.3.27**.
2. **Styling & Design System**: The app uses **Tailwind CSS v4** (`@tailwindcss/postcss` 4.2.4) alongside a curated design token system (`src/styles/tokens.css` and `src/styles/index.css`). Design tokens define an obsidian-midnight dark palette, IBM Plex Sans Arabic / Tajawal fonts, and IBM Plex Mono for all financial and numerical readouts.
3. **Severe Architectural Fragmentation in Mulam Pages**:
   - Whereas standard retail/restaurant pages inherit `AppLayout` (responsive sidebar, title bar, ZATCA status bar, theme switching), the Mulam pages (`TailorPos.jsx`, `Alterations.jsx`, `OrdersBoard.jsx`, and `MeasurementCapture.jsx`) are **completely disconnected from `AppLayout`**.
   - Each tailor page implements its own ad-hoc navigation bar or header with inconsistent buttons, differing color values, and redundant customer search logic.
   - `TailorPos.css` introduces scoped CSS variable overrides (`--primary: #0284c7`) that clash with the global brand tokens (`--primary: #6366f1`).
4. **Development & Mock API Gap**:
   - The IPC communication is routed through `electron/preload.cjs` into `database.cjs`.
   - In browser development mode (`npm run dev`), the app falls back to `src/mockApi.js`. However, **`mockApi.js` completely lacks the `window.api.tailor` namespace**, causing immediate crashes when attempting to view or test any Mulam page outside of full Electron packaging.
5. **Clear Path for Modular Integration**:
   - By creating a standardized feature package (`src/features/mulam/`) with a unified sub-navigation shell, shared customer lookup, reusable measurement grid, and fabric gauge indicators, we can unify the experience while preserving 100% backward compatibility with existing IPC endpoints, invoice generators, and print layouts.

---

## 2. Technology Stack & Core Architecture

### 2.1 Runtime & Framework
| Component | Technology / Library | Version | Purpose & Implementation Details |
|---|---|---|---|
| **UI Library** | React | `^18.2.0` | Functional components with React Hooks. StrictMode enabled in `src/main.jsx`. |
| **DOM Renderer** | React DOM | `^18.2.0` | Client hydration via `ReactDOM.createRoot`. |
| **Routing** | React-Router-DOM | `^6.22.3` | Uses `HashRouter` with `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` in `src/App.jsx`. Hash routing is essential for Electron local file loading (`file://`). |
| **Desktop Shell** | Electron | `^22.3.27` | Main process in `electron/main.cjs`, Preload script in `electron/preload.cjs`, packaged with `electron-builder` (`^26.8.1`). |
| **Icons** | Lucide React | `^0.383.0` | Primary icon set used across modern pages (e.g. `Home.jsx`, `Services.jsx`). |
| **Data Viz** | Recharts | `^3.8.1` | Financial analytics and sales curves in `Dashboard.jsx`. |
| **Localization** | i18next & react-i18next | `^26.3.1` / `^17.0.8` | Arabic (RTL default) and English support via `src/i18n.js` and `src/locales/`. |

### 2.2 Build System & Bundling
- **Bundler**: **Vite 4.4.5** with `@vitejs/plugin-react` (`4.0.3`).
- **Config** (`vite.config.js`):
  - `base: './'` (relative paths for Electron packaging)
  - `outDir: 'dist'`, `emptyOutDir: true`
  - `sourcemap: true` enabled for crash diagnostics
  - Dev server: Port `5173`, strictPort: `true`, host: `'127.0.0.1'`
- **Build Scripts** (`package.json`):
  - `npm run dev`: Starts local Vite dev server.
  - `npm run build`: Executes `vite build` into `dist/`.
  - `npm run start`: Kills running instances and launches Vite + Electron concurrently (`concurrently -k --raw "npm run dev" "npm run electron:wait"`).
  - `npm run lint`: `eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`.

### 2.3 Styling Framework & Design Token Hierarchy
The styling stack consists of a layered CSS architecture:
1. **Tailwind CSS v4** (`tailwindcss: ^4.2.4`, `@tailwindcss/postcss: ^4.2.4`, `postcss: ^8.5.12`, `autoprefixer: ^10.5.0`).
   - Configured in `tailwind.config.mjs` and `postcss.config.cjs`.
   - Restricts scanning in `src/styles/index.css` via `@source "../../src/**/*.{jsx,js,ts,tsx}";` and `@source "../../index.html";` to prevent scanning non-UI scripts.
2. **Centralized CSS Design Tokens** (`src/styles/tokens.css`):
   - Typography:
     - UI Font: `'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif`
     - Numerical/KPI Font: `'IBM Plex Mono', 'Courier New', monospace` (applied to `.num`, `[data-type="price"]`, `[data-type="quantity"]`, `[data-type="kpi"]`)
     - Scale: `--text-xs: 12px`, `--text-sm: 14px`, `--text-base: 16px`, `--text-lg: 20px`, `--text-xl: 28px`
   - Theme Colors (Tailwind extended mapping):
     - `--color-bg-base`: `#0A0F1A`
     - `--color-bg-surface` / `--bg-card`: `#111827` (Dark) / `#ffffff` (Light)
     - `--color-bg-raised`: `#1C2537`
     - `--color-accent` / `--primary`: `#6366f1` (Brand Indigo) or `#0EA5E9` (Sky Blue token alias)
     - `--color-success`: `#10B981` (Emerald)
     - `--color-warning`: `#F59E0B` (Amber)
     - `--color-danger`: `#EF4444` (Rose/Red)
   - Radius tokens: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`, `--radius-xl: 20px`, `--radius-pill: 9999px`
3. **Utility Classes** (`src/styles/utilities.css`):
   - `.pos-card`: Standardized surface card with subtle border and padding.
   - `.pos-field`: Standardized column stack for form inputs with muted label.
   - `.pos-section-header`: Clean divider with centered uppercase label.
   - `.pos-info-banner`: Status notice strip (`--warning`, `--danger`, `--success`).
   - `.hover-lift`: Smooth hover translation for interactive cards.

---

## 3. State Management & API Integration Layer

### 3.1 State Management (Zustand + Context)
1. **Zustand Stores** (`src/store/`):
   - `useAuthStore.js`: Session tokens, current user, role (`admin`, `cashier`, `tailor`), permissions (`can('permission_key')`), and logout handlers with 15-minute auto-timeout.
   - `useCartStore.js`: POS cart state, quantity manipulation, discounts, held tickets, customer association, and promotions engine.
   - `useLicenseStore.js`: Tier management (`starter`, `pro`, `enterprise`), feature gating (`canAccess(feature)`), grace period tracking, and activation key persistence.
   - `useSubscriptionStore.js`: Subscription plan simulation inside `SubscriptionHub.jsx`.
2. **React Context**:
   - `SettingsCtx` in `src/App.jsx`: Exposes `{ businessType, reloadSettings }` via `useAppSettings()`. Detects whether the active tenant is `'retail'`, `'restaurant'`, or `'tailor'`.
3. **Domain Hooks**:
   - `useTailorPos.jsx` (`src/hooks/useTailorPos.jsx`): Manages the full bespoke tailoring checkout state (customer lookup, garment items, measurement profiles, urgency fees, gift options, deposit calculation, fabric meter subtraction, and dual invoice persistence).

### 3.2 IPC Bridge & Backend Data Flow
- **Preload Isolation** (`electron/preload.cjs`): Exposes API via `contextBridge.exposeInMainWorld('api', { ... })`.
- **Mulam / Tailor IPC Endpoints** (`window.api.tailor`):
  | Method | Channel | Function in `database.cjs` | Description |
  |---|---|---|---|
  | `createOrder(payload)` | `'tailor:createOrder'` | `createTailorOrder()` | Creates order in `tailor_orders`, garments in `tailor_order_garments`, updates `measurement_profiles`, and deducts `length_available` from `products`. |
  | `getOrders(filter)` | `'tailor:getOrders'` | `getTailorOrders()` | Fetches orders with customer name, garment count, and earliest production stage. |
  | `getGarments(orderId)` | `'tailor:getGarments'` | `getTailorOrderGarments()` | Fetches garments for an order with assigned fabric and tailor info. |
  | `updateStage(payload)` | `'tailor:updateStage'` | `updateGarmentStage()` | Transitions garment through stages: `cutting` → `stitching` → `finishing` → `ironing` → `ready`. |
  | `completeOrder(payload)`| `'tailor:completeOrder'` | `completeTailorOrder()` | Marks order as `delivered` and settles remaining balance. |
  | `getMeasurements(filter)`| `'tailor:getMeasurements'` | `getMeasurements()` | Retrieves customer measurement profiles from `measurement_profiles`. |
  | `saveProfile(payload)` | `'tailor:saveProfile'` | `saveMeasurementProfile()` | Upserts garment measurements into `measurement_profiles`. |
  | `getAlterations()` | `'tailor:getAlterations'` | `getAlterations()` | Fetches alteration tickets with sub-items from `alteration_tickets`. |
  | `createAlteration(p)` | `'tailor:createAlteration'`| `createAlterationTicket()`| Inserts alteration ticket and items. |
  | `updateAlterationStatus(p)`| `'tailor:updateAlterationStatus'`| `updateAlterationStatus()`| Updates alteration status (`pending` → `in_progress` → `ready` → `delivered`). |
  | `getDashboardStats()` | `'tailor:getDashboardStats'`| `getTailorDashboardStats()`| Returns active counts (`inProgress`, `readyForPickup`, `overdue`, `lowFabrics`, `todayFittings`). |

---

## 4. Audit of Existing Mulam (Tailor) Pages & UX Gaps

### 4.1 Page Audit Matrix
| Page File | Route | Shell / Layout Used | Primary Styling Pattern | Major UX / Technical Gaps |
|---|---|---|---|---|
| `src/pages/TailorPos.jsx` | `#/tailor-pos` | **Custom isolated header** (No `AppLayout`) | `TailorPos.css` with local color variable overrides (`--primary: #0284c7`) | • Hardcoded header with disjointed navigation buttons.<br>• No fabric meter gauge / low-fabric warnings during selection.<br>• Fixed 3.5m fabric consumption without dynamic child/adult scaling.<br>• Inconsistent unit toggling (cm/in). |
| `src/pages/Alterations.jsx` | `#/alterations` | **Custom isolated header** (No `AppLayout`) | Borrows `.tailor-pos-page` wrapper + heavy inline styles | • Completely missing from `AppLayout` sidebar navigation!<br>• Re-implements customer search from scratch without auto-suggest.<br>• Rudimentary Kanban view lacking garment icons, stage timers, or filters.<br>• Crude thermal print format using raw string concatenation. |
| `src/pages/OrdersBoard.jsx` | `#/orders-board` | **Custom isolated full-screen header** (No `AppLayout`) | Inline styles with CSS custom properties | • Not integrated into `AppLayout` sidebar hierarchy.<br>• Auto-refreshes every 30s but lacks optimistic real-time visual cues.<br>• No direct link to customer measurement profiles or alteration tickets.<br>• Urgent order badges are not highlighted prominently enough. |
| `src/pages/MeasurementCapture.jsx` | `#/measurements` | **Custom isolated header** (No `AppLayout`) | Injected `<style>{responsiveStyles}</style>` string | • Two separate disjointed modes: Search list vs. Measurement form.<br>• Manual customer ID query param parsing (`?customer_id=123`).<br>• Lacks interactive visual body diagram or quick-fit presets.<br>• Disconnected from the POS cart flow (customer cannot be passed smoothly). |
| `src/pages/Home.jsx` (Mulam Control Center) | `#/home` | Integrated with `AppLayout` | Tailwind & global design tokens | • Displays Mulam widgets (low fabrics, today's fittings, recent deliveries), but clicking them links to disparate screens that break the shell experience. |

### 4.2 The Dev-Mode Crash Gap (`mockApi.js`)
When developers run `npm run dev` in standard web browsers (without Electron), navigating to `#/tailor-pos`, `#/alterations`, or `#/orders-board` causes an immediate runtime exception:
```
TypeError: Cannot read properties of undefined (reading 'getOrders')
TypeError: Cannot read properties of undefined (reading 'getAlterations')
```
Because `window.api.tailor` is completely omitted in `src/mockApi.js`, frontend development on Mulam pages currently requires running the full Electron binary (`npm run start`), drastically slowing down iteration speed and UI prototyping.

---

## 5. Concrete Recommendations for the Unified Mulam Pipeline

To fulfill the requirements of `ORIGINAL_REQUEST.md` and adhere strictly to `ui_ux_pro_max` architectural guidelines without regressions, we propose the following concrete structure:

### 5.1 Harmonized Layout & Shell Architecture
All Mulam pages must adopt a unified, ergonomic shell experience:
1. **Option A (Seamless `AppLayout` Integration)**: Wrap all Mulam pages within `AppLayout`, adding a dedicated **"Mulam / الخياطة والتفصيل"** navigation group in the sidebar when `businessType === 'tailor'`.
2. **Unified Sub-Navigation Rail (`MulamSubNav`)**:
   Provide an ergonomic top sub-header across all Mulam pages allowing 1-click switching:
   - 🧵 **طلب تفصيل جديد** (`/tailor-pos`)
   - 🪡 **التعديلات السريعة** (`/alterations`)
   - 🏭 **شاشة المعمل والإنتاج** (`/orders-board`)
   - 📐 **دفتر المقاسات** (`/measurements`)
   - 📊 **مركز التحكم** (`/home`)

```
+----------------------------------------------------------------------------------------------------+
|  [App Sidebar]  |  MULAM PIPELINE SUB-HEADER                                     [Active Branch]   |
|                 |  [🧵 طلب تفصيل]  [🪡 التعديلات (3)]  [🏭 لوحة المعمل (12)]  [📐 المقاسات]        |
|-----------------+----------------------------------------------------------------------------------|
|                 |                                                                                  |
|                 |  UNIFIED WORKFLOW WORKSPACE (Standardized Cards, Monospace Numbers, Tokens)      |
|                 |                                                                                  |
+----------------------------------------------------------------------------------------------------+
```

### 5.2 Recommended Directory & Component Architecture
Establish a dedicated, modular directory under `src/features/mulam/` while leaving legacy routes as thin wrappers for zero regression:

```
src/
├── features/
│   └── mulam/
│       ├── components/
│       │   ├── MulamHeader.jsx          # Unified sub-nav, stage counts & quick actions
│       │   ├── CustomerLookupCard.jsx   # Shared customer search with auto-complete & profile badge
│       │   ├── GarmentSelector.jsx      # Garment type selector with GarmentIcons silhouettes
│       │   ├── MeasurementGrid.jsx      # Unified Inches/CM measurement inputs with live preview
│       │   ├── FabricMeterGauge.jsx     # Visual fabric roll progress bar (Green/Amber/Red stock)
│       │   ├── AlterationTicketModal.jsx# Standardized alteration entry modal with validation
│       │   └── ProductionCard.jsx       # Standardized Kanban card for workshop & alterations
│       ├── hooks/
│       │   ├── useMulamNavigation.js    # Quick switching, active stage badges, keyboard shortcuts
│       │   └── useFabricInventory.js    # Real-time meter availability & consumption calculations
│       └── utils/
│           ├── measurementConversions.js# Inches <-> CM pure utility functions
│           └── thermalTicketEngine.js   # Unified thermal print generator with barcode
```

### 5.3 Shared Component Specifications

#### 1. `CustomerLookupCard`
- Eliminates duplicated customer lookup logic across `TailorPos`, `Alterations`, and `MeasurementCapture`.
- Displays: Customer Name, Phone, VIP/Regular badge, Last Order date, and quick button to load existing measurement profile.
- Keyboard accessible (`F2` shortcut or `/` to focus).

#### 2. `FabricMeterGauge`
- Addresses the critical inventory visibility gap identified in the audit.
- Visual component showing:
  - Fabric Name & Code (e.g. `FAB-0102 الياباني الفاخر`)
  - Available Meters bar (e.g. `24.5m / 50m`)
  - Status color:
    - 🟢 Green: `> 10m`
    - 🟡 Amber: `3.5m - 10m` (Warning: low roll)
    - 🔴 Red: `< 3.5m` (Insufficient for adult thobe)
- Allows dynamic consumption override (adult: 3.5m, child: 2.5m, custom override).

#### 3. `MeasurementGrid`
- Unified measurement form sharing identical input styling, tab order, and unit conversions.
- Integrates `GarmentIcons` (SVG silhouettes for Thobe, Sirwal, Bisht, Shirt) with active field highlighting.
- Clean numeric layout with `data-type="quantity"` monospace styling.

### 5.4 Extension of `src/mockApi.js`
To allow seamless local browser development and fast UI prototyping, add the complete `tailor` mock namespace to `src/mockApi.js`:
- `window.api.tailor.getOrders`: Returns mock orders across stages (`cutting`, `stitching`, `finishing`, `ironing`, `ready`).
- `window.api.tailor.getGarments`: Returns garments with fabrics and measurements.
- `window.api.tailor.getAlterations`: Returns sample alteration tickets.
- `window.api.tailor.getMeasurements`: Returns sample measurement profiles.
- `window.api.tailor.getDashboardStats`: Returns realistic mock counts.

### 5.5 Zero-Regression Guardrails
1. **Preserve Route Contracts**:
   - Keep `/tailor-pos`, `/alterations`, `/orders-board`, `/measurements` route paths in `App.jsx`.
   - Existing external triggers (e.g. `navigate('/tailor-pos')` from `Home.jsx` or `AppLayout.jsx`) continue to resolve without breaking.
2. **Preserve Database IPC Contracts**:
   - `createTailorOrder`, `createAlterationTicket`, `saveMeasurementProfile`, and `updateGarmentStage` signatures must not be altered.
3. **Preserve Print System**:
   - Maintain compatibility with `TailorWorkOrder.jsx` (A4 print layout) and `window.api.printHTML` thermal receipts.

---

## 6. How to Build & Test Frontend Changes

### 6.1 Build Verification
- **Command**: `npm run build`
- **Output Directory**: `dist/`
- **Verification Rule**: Ensure zero Vite compilation errors, zero unresolved imports, and that all CSS token variables resolve cleanly.

### 6.2 Lint & Quality Verification
- **Command**: `npm run lint`
- **Verification Rule**: ESLint checks across JSX files (`--max-warnings 0`).

### 6.3 Programmatic & Behavioral Testing
- **Playwright E2E Suites**:
  - `tests/playwright_tailor.js`: Tests launching Electron, entering PIN, navigating to `#/tailor-pos`, filling customer phone/name, configuring urgent fees, and completing an order.
  - `tests/playwright_alterations.js`: Tests creating an alteration ticket and verifying status transitions.
- **Execution**: Run via `node tests/playwright_tailor.js` and `node tests/playwright_alterations.js` after building.
