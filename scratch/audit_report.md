# Mulam (Master Tailor) Experience Audit Report

## 1. The "Mulam Experience" (Core Workflows)
A true Master Tailor requires a seamless flow across these pillars:
*   **Fabric Inventory Management:** Managing rolls of fabric, tracking available meters/yards, accounting for wastage, and seamless restocking from suppliers.
*   **Order Management (Thobes/Suits):** Associating exact fabrics with specific garments, tracking the lifecycle (Cutting -> Sewing -> Fitting -> Ready), and handling due dates.
*   **Measurement Profiles:** Capturing, versioning, and reusing precise customer measurements.
*   **Financials & Invoicing:** Handling partial payments (deposits), final settlements, and ZATCA Phase 2 compliant receipts.
*   **Operational Reporting:** Tracking fabric consumption, staff productivity (who sewed what), and uncollected revenue.

## 2. Page-by-Page Codebase Audit & Gaps

### `electron/database.cjs` & `MenuAdmin.jsx` (The "Zero Meter" Bug)
*   **The Bug Isolated:** When a user opens a fabric item to edit in `MenuAdmin.jsx`, the form fetches data via `window.api.getMenu()`. In `database.cjs`, the function `mapProductKeys()` strictly maps returning keys but **completely omits `is_fabric` and `length_available`**. 
*   **Consequence:** `item.length_available` evaluates to `undefined`. The UI form defaults to `LengthAvailable: item.length_available || 0`, which sets it to `0`. When the user clicks "Save", this `0` is passed in the payload and overwrites the database. 
*   **Additionally in `database.cjs`:** The `duplicateProduct` function entirely ignores fabric flags, meaning duplicating a fabric turns it into a standard product.

### `Purchases.jsx` & Restocking
*   **Critical Missing Logic:** When a Mulam buys new fabric from a supplier, `receivePurchaseOrder` in `database.cjs` correctly increments the physical `stock` count (e.g., +1 roll) but **fails to increment `length_available`**. Newly purchased fabric meters never reach the tailor's available inventory.

### `TailorPos.jsx` (Point of Sale)
*   **UX Gap:** Fabric consumption is based on rigid global settings (e.g., `tailor_thobe_fixed_amount = 3.5m`) rather than dynamically scaling based on customer measurements (an adult vs. a child).
*   **Validation Gap:** The system subtracts `fabric_length_used` from inventory upon order creation, but it doesn't clearly visually warn the tailor *during* selection if the chosen fabric doesn't have enough meters remaining for the requested garments.

### `MeasurementCapture.jsx`
*   **UX Area for Improvement:** Measurements are static per customer. There is no historical tracking to view how a customer's measurements have changed over time, which is a common requirement for high-end tailoring.

## 3. Recommended Actions & Standout Improvements
1.  **Surgical Fix for the Bug:** Update `mapProductKeys()` in `database.cjs` to map `is_fabric: !!p.is_fabric` and `length_available: p.length_available || 0`.
2.  **Purchase Order Overhaul for Fabric:** Add a `meters_per_unit` field to purchase items. When `receivePurchaseOrder` executes, if the item is a fabric, it should add `Quantity * meters_per_unit` to `length_available`.
3.  **Dynamic Consumption:** In `TailorPos.jsx`, allow the tailor to easily override the calculated fabric consumption per garment directly on the POS screen before finalizing.
4.  **Low Fabric Alerts:** Implement UI warnings in `TailorPos.jsx` when the remaining meters for a selected fabric fall below the required threshold for the current cart.
