## 2026-09-10T05:41:07Z

You are Worker M2 (Senior Full-Stack / Frontend Engineer) for the Mulam Pipeline Redesign project.
Your assigned working directory is: c:\my-pos\V4\.agents\teamwork_preview_worker_m2

MANDATORY: Read the original user request at:
c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
Also read the project architecture at:
c:\my-pos\V4\.agents\teamwork_preview_orchestrator_1\PROJECT.md
Also read the UI/UX Blueprint & Wireframes at:
c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign\MULAM_PIPELINE_BLUEPRINT.md
Also read the UX Audit at:
c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign\MULAM_PIPELINE_AUDIT.md
Also review tech stack findings at:
c:\my-pos\V4\.agents\teamwork_preview_explorer_survey_3\tech_stack_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task (Requirement R3 - Frontend Implementation):
Implement the unified UI/UX design into the frontend codebase across all identified Mulam pages in c:\my-pos\V4:

1. Create `src/components/mulam/MulamSubNav.jsx`:
   - Unified navigation ribbon with tabs:
     * ✂️ تفصيل جديد (`/tailor-pos`)
     * 🏭 لوحة المعمل (`/orders-board`) with active orders badge
     * 🏷️ إدارة التعديلات (`/alterations`) with pending alterations badge
     * 📐 دفتر المقاسات (`/measurements`) with total measurements badge
     * 🏠 العودة للرئيسية (`/home`)
     * Universal unit switcher (إنش / سم)
     * Real-time clock and active shift badge

2. Update `src/pages/Alterations.jsx`:
   - Embed `MulamSubNav` at the top (permanently eliminating the trapped user state!).
   - Add customer auto-complete / search by mobile or name using customer data.
   - Add barcode scanner / quick search input to locate tickets instantly.
   - Replace external CDN JsBarcode script with an offline-first inline SVG barcode generator (so printing works with 100% offline reliability).
   - Add Delivery Settlement Modal on "تم التسليم" when there is an outstanding balance (`balance > 0`), prompting for payment (Cash / Card) and updating order balance.

3. Update `src/pages/TailorPos.jsx` and `src/hooks/useTailorPos.jsx`:
   - Embed `MulamSubNav` at the top.
   - Replace permanent 33% A4 preview column with an on-demand sliding Drawer or Modal (`TailorWorkOrderDrawer`) toggled by an "👁️ معاينة ورقة العمل" button, giving 50/50 width to customer/fabric selection and measurement inputs.
   - Expose the existing hook state for Urgent Order (`isUrgent`, `urgentFee`) and Gift Order (`isGift`, `recipientName`, `recipientPhone`) with toggles and clean input fields.
   - Standardize measurement input keys to include `wrist` and `hand_opening`.
   - Fix double-print bug in `useTailorPos.jsx` (remove `window.print()` after silent thermal print `window.api.printHTML`).

4. Update `src/pages/OrdersBoard.jsx`:
   - Embed `MulamSubNav` at the top.
   - Upgrade workshop cards with touch-first buttons (>=44px height, high-contrast labels).
   - Add multi-garment progress bar per card (`X/Y قطع جاهزة`).
   - Add single-piece advance button and batch advance button.

5. Update `src/pages/MeasurementCapture.jsx`:
   - Embed `MulamSubNav` at the top.
   - Normalize measurement inputs and garment types.
   - Add a prominent "✂️ بدء طلب تفصيل بهذا المقاس" button that navigates directly to `/tailor-pos` with prefilled customer and measurement data.

6. Update `src/pages/Customers.jsx`:
   - When in tailor mode (`businessType === 'tailor'`), add "✂️ تفصيل جديد" and "📐 المقاسات" quick action buttons on customer cards.

7. Update `src/components/layout/AppLayout.jsx`:
   - Ensure `/tailor-pos` and `/alterations` are properly listed in the sidebar navigation when in tailor mode.
   - Ensure header back links point to `/home` instead of `/dashboard` to avoid redirect loops.

8. Update `src/mockApi.js`:
   - Provide solid mock handlers for `window.api.tailor` methods so browser testing runs without missing API errors.

9. Run `npm run build` and ensure the build succeeds with 0 errors.

10. Write your handoff report to:
    c:\my-pos\V4\.agents\teamwork_preview_worker_m2\handoff.md
    with full details of files modified, changes made, build output, and verification results.
11. Send a completion message back to parent when done.
