## 2026-09-10T06:01:15Z
You are Worker M3 (Senior Full-Stack Frontend Engineer) working on Milestone 2 (Phase 3 Frontend Implementation) for the Mulam Pipeline Redesign.

Your working directory is:
c:\my-pos\V4\.agents\teamwork_preview_worker_m3

Your parent is Generation 2 Project Orchestrator (Conversation ID: 80f16963-bef1-4431-904a-e4c8f4f026d4).
Always report your progress and completion back to your parent using send_message.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Authoritative Project Reference Documents (READ THESE FIRST):
1. c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
2. c:\my-pos\V4\.agents\teamwork_preview_orchestrator_1\PROJECT.md
3. c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign\MULAM_PIPELINE_BLUEPRINT.md
4. c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign\MULAM_PIPELINE_AUDIT.md
5. Note: c:\my-pos\V4\src\components\mulam\MulamSubNav.jsx has already been scaffolded. Inspect it before use.

Your Tasks:
1. `src/pages/Alterations.jsx`:
   - Integrate `MulamSubNav` with `activeTab="alterations"`.
   - Fix trapped user defect: Add a clear back/close navigation button (e.g. to `/tailor-pos` or dashboard).
   - Add customer auto-complete / search from existing customer database.
   - Add offline SVG barcode fallback when online barcode API is unavailable.
   - Add delivery payment collection modal (settlement modal ensuring financial balance settlement upon alteration pickup/delivery).

2. `src/pages/TailorPos.jsx` & `src/hooks/useTailorPos.jsx`:
   - Integrate `MulamSubNav` with `activeTab="pos"`.
   - Replace permanent 33% preview pane with an ergonomic on-demand preview drawer/modal (frees up 33% screen width for workflow).
   - Add urgent order (`isUrgent`) and gift order (`isGift`) UI toggles/options.
   - Add `wrist` and `hand_opening` measurement input fields matching standard schema.
   - Fix double-print bug in receipt printing.

3. `src/pages/OrdersBoard.jsx`:
   - Integrate `MulamSubNav` with `activeTab="board"`.
   - Redesign with touch-first kanban cards (>=44px touch targets).
   - Add multi-garment progress indicators / status bars on order cards.
   - Add single and batch stage advance actions.

4. `src/pages/MeasurementCapture.jsx`:
   - Integrate `MulamSubNav` with `activeTab="measurements"`.
   - Normalize measurement keys (`wrist`, `hand_opening`, `collar`, `cuff`, `pocket`, `length`, `shoulder`, `chest`, `waist`, `sleeve`, `neck`).
   - Add direct action button: "Start New Order with these measurements" that navigates to `/tailor-pos` with customer and measurements preloaded in state/URL.

5. `src/components/layout/AppLayout.jsx`, `src/pages/Customers.jsx`, and `src/mockApi.js`:
   - In `AppLayout.jsx`, ensure Mulam routes (`/tailor-pos`, `/orders-board`, `/alterations`, `/measurements`) are accessible in sidebar/navigation.
   - In `Customers.jsx`, add quick tailor action shortcuts (view measurements, start tailor order).
   - In `src/mockApi.js`, ensure mock tailor handlers exist for browser development resilience.

6. Build Verification:
   - Run `npm run build` in `c:\my-pos\V4`.
   - Verify that Vite builds successfully with 0 errors.

7. Deliverables:
   - Keep `c:\my-pos\V4\.agents\teamwork_preview_worker_m3\progress.md` updated during your work.
   - When finished and `npm run build` passes, write a detailed handoff report to `c:\my-pos\V4\.agents\teamwork_preview_worker_m3\handoff.md` detailing:
     - All files modified
     - Summary of changes per file
     - Build verification results
     - Verification proof
   - Send a completion message via send_message to your parent (80f16963-bef1-4431-904a-e4c8f4f026d4).
