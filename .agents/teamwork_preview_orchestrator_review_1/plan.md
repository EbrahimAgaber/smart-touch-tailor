# Orchestration Plan: Production Readiness Review of Tailor POS (my-pos/V4)

## Objective
Conduct a rigorous, comprehensive end-to-end review and evaluation of the tailor POS application (`my-pos/V4`) to determine its production readiness.
Deliverable: `c:\my-pos\V4\comprehensive_app_review.md`

## Requirements Traceability
- **R1: Customer Lifecycle Evaluation**
  - Evaluate at least 5 distinct stages:
    1. Walk-in & Customer Registration / Profile Lookup
    2. Measurement Profiles & Selection (standard vs custom, historic alterations)
    3. Tailoring & Cutting Job Assignment / Production Status Workflow
    4. Invoicing, Payment Processing & ZATCA Compliance (E-invoicing phase 1 & 2, QR, tax calculation)
    5. Fitting, Quality Check & Final Collection
  - Identify all broken workflows, missing features, and UX friction points with file citations.

- **R2: Business Operations and Integrity Evaluation**
  - Evaluate from business owner / operational integrity perspective:
    1. Cutter pay rates and total compensation tracking (piece-rate vs hourly/salary, job slips)
    2. Tailor pay rates and total compensation tracking (stitching rates, completed units)
    3. Defective item penalties / deductions made by tailors (disputes, rework logging)
    4. Textile / material waste tracking (fabric inventory, yardage consumption vs scrap, shrinkage)
    5. Fraud prevention & role-based access control (voided invoices, cash drawer reconciliation, inventory shrinkage)

- **R3: Comprehensive Reporting & Actionability**
  - Single consolidated Markdown report at `c:\my-pos\V4\comprehensive_app_review.md`.
  - Production readiness scorecard & gap analysis.
  - Concrete file-by-file citations for all broken or missing features.
  - Actionable technical and product recommendations to benchmark against best-in-class POS systems.

## Execution Phases
1. **Phase 1: Parallel Exploration (3 Explorers)**
   - `teamwork_preview_explorer_review_lifecycle`: Focus on R1 (customer lifecycle, front-to-back workflows).
   - `teamwork_preview_explorer_review_business`: Focus on R2 (cutter/tailor comp, defect deductions, textile waste, fraud prevention).
   - `teamwork_preview_explorer_review_tech`: Focus on architecture, schema, APIs, test suites, and broken components.
2. **Phase 2: Aggregation & Synthesis**
   - Synthesize all findings into structured sections with direct evidence chains.
3. **Phase 3: Report Authoring**
   - Dispatch `teamwork_preview_worker` to write `c:\my-pos\V4\comprehensive_app_review.md`.
4. **Phase 4: Independent Verification & Audit**
   - Dispatch `teamwork_preview_reviewer` to check against all acceptance criteria and verify file citations.
   - Dispatch `teamwork_preview_auditor` for integrity and non-fabrication check.
5. **Phase 5: Handoff & Claim Victory**
   - Notify Sentinel via `send_message`.
