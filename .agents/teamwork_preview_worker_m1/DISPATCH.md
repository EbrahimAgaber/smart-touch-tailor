## 2026-09-10T05:26:48Z
You are Worker M1 (Lead UI/UX Architect) for the Mulam Pipeline Redesign project.
Your assigned working directory is: c:\my-pos\V4\.agents\teamwork_preview_worker_m1

MANDATORY: Read the original user request at:
c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
Also read the project architecture at:
c:\my-pos\V4\.agents\teamwork_preview_orchestrator_1\PROJECT.md
Also read the UI/UX skill at:
c:\my-pos\V4\.agents\skills\ui_ux_pro_max\SKILL.md

Read the survey findings from the Explorers:
1. UX Audit findings: c:\my-pos\V4\.agents\teamwork_preview_explorer_survey_2\ux_audit_report.md
2. Route & Codebase Mapping: c:\my-pos\V4\.agents\teamwork_preview_explorer_survey_1\survey_report.md
3. Tech Stack & Token Architecture: c:\my-pos\V4\.agents\teamwork_preview_explorer_survey_3\tech_stack_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks (Requirements R1 and R2):
1. Produce the official, comprehensive UX Audit Document at:
   c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign\MULAM_PIPELINE_AUDIT.md
   - List all identified Mulam pages (`TailorPos.jsx`, `Alterations.jsx`, `OrdersBoard.jsx`, `MeasurementCapture.jsx`, `Customers.jsx`, `AppLayout.jsx`).
   - Detail the current friction points, trapped user states (no navigation in Alterations), measurement/schema mismatches (`cuff` vs `cuffs`, missing `wrist`/`hand_opening`), double-print bugs, workshop tablet touch issues (<24px targets), and redundancies.
   - Map current vs target workflow matrices.

2. Produce the high-fidelity UI/UX Blueprint & Wireframes Document at:
   c:\my-pos\V4\teamwork_projects\mulam_pipeline_redesign\MULAM_PIPELINE_BLUEPRINT.md
   - Strictly adhere to `ui_ux_pro_max` skill guidelines (Workflow-First, ergonomic principles, typography scale, color palette tokens, component states, exact data flow placements).
   - Provide organized Markdown layout tables and rich ASCII wireframes for the redesigned pipeline:
     a. **MulamSubNav**: Unified pipeline ribbon linking New Order (`/tailor-pos`), Workshop Board (`/orders-board`), Alterations (`/alterations`), and Measurements (`/measurements`) with live counts and unit switcher.
     b. **TailorPos Redesign**: Ergonomic 2-column layout (50/50), sliding drawer / modal for A4 work order preview (eliminating the permanent 33% clutter), unit switcher pill, urgent order & gift order toggles, normalized measurements.
     c. **Alterations Redesign**: Embedded in standard pipeline layout (no trapped user!), customer quick-lookup / autocomplete by mobile/name, local barcode generator (offline-first, no external CDN), barcode scanner field, and Delivery Checkout modal for financial settlement.
     d. **OrdersBoard Redesign**: Touch-friendly workshop cards with >=44px buttons, clear progress bar per multi-garment order (e.g. 3/4 pieces ready), single-piece move vs batch advance.
     e. **MeasurementCapture Redesign**: Normalized garment schema, direct "Launch Order from Measurement" CTA button, customer measurement history view.
     f. **Customer Hub Integration**: Quick "Tailor Order" and "View Measurements" buttons on customer cards in `Customers.jsx`.
   - Typography scales (Cairo/Tajawal Arabic, IBM Plex Mono for numbers/measurements).
   - Component state dictionary (idle, focus, hover, active, error, loading).

3. Write your handoff report to:
   c:\my-pos\V4\.agents\teamwork_preview_worker_m1\handoff.md
4. Send a completion message back to parent with a summary of the produced blueprint and audit files.
