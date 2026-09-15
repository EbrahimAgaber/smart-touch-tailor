# DISPATCH: Business Operations & Integrity Explorer

- Assigned Agent: teamwork_preview_explorer_review_2
- Role: Business Ops and Integrity Explorer
- Mission: Deep exploration of business operations, worker compensation, material waste, defect deductions, and fraud prevention in my-pos/V4 (R2)
- Authoritative Requirements: c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
- Working Directory: c:\my-pos\V4\.agents\teamwork_preview_explorer_review_2
- Target Output: c:\my-pos\V4\.agents\teamwork_preview_explorer_review_2\handoff.md

## 2026-09-10T22:44:18Z
You are teamwork_preview_explorer_review_2.
Your working directory is: c:\my-pos\V4\.agents\teamwork_preview_explorer_review_2
You MUST read the authoritative user request at:
c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-10T22:41:44Z)

YOUR MISSION: Business Operations and Integrity Evaluation (Requirement R2)
Conduct a deep, thorough investigation of the tailor POS application (my-pos/V4) from the business owner's perspective, focusing on operational metrics, worker compensation, waste tracking, and fraud prevention.

Specifically and explicitly evaluate:
1. Cutter pay rates and total compensation:
   - How cutter compensation is structured and calculated (piece-rate vs hourly/salary)
   - Configuration of cutter rates per garment or cut type
   - Tracking completed cutting jobs and generating payout reports
2. Tailor pay rates and total compensation:
   - How tailor compensation is structured and calculated (piece-work, standard rates, complexity add-ons)
   - Tracking completed stitching jobs and tallying compensation
   - Payout histories and reconciliation
3. Deductions due to defective items made by tailors:
   - Defect logging, quality control inspection points, rework tracking
   - Deduction calculation, worker attribution, penalty rules
   - Dispute handling and deduction visibility on pay slips
4. Tracking of textile / material waste:
   - Fabric roll inventory management and unit of measure (meters/yards)
   - Standard yardage consumption vs actual yardage cut per garment
   - Waste / scrap tracking, scrap reusability, shrinkage, damaged fabric logging
   - Cost calculation of wasted textile materials
5. Fraud Prevention & Role-based Integrity:
   - Cash drawer / register shift management (opening float, cash drop, end-of-day reconciliation, cash discrepancy logging)
   - Access control & authorization (invoice voiding, price overrides, discount limits, order deletions)
   - Audit logging and immutable transaction history

FOR EVERY AREA:
- Inspect existing database schemas, backend controllers/services, frontend UI pages/components.
- Explicitly determine whether each capability is fully implemented, partially implemented, broken, or completely missing.
- CITE SPECIFIC FILES, SCHEMA MODELS, APIS, AND UI COMPONENTS.

Write your comprehensive, highly structured report to:
c:\my-pos\V4\.agents\teamwork_preview_explorer_review_2\handoff.md
Update your progress in c:\my-pos\V4\.agents\teamwork_preview_explorer_review_2\progress.md.
When finished, send a message to parent with a concise summary and confirmation of handoff.md path.
