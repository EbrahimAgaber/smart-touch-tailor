# BRIEFING — 2026-09-11T02:58:00+03:00

## Mission
Make Smart Touch POS (my-pos/V4) tailor application production-ready by implementing fixes across ZATCA/security, financial integrity/workforce schema, and customer lifecycle/domain logic per comprehensive_app_review.md.

## 🔒 My Identity
- Archetype: sentinel
- Working directory: c:\my-pos\V4\.agents\sentinel
- Orchestrator: 5fb56987-bb3b-46be-a0eb-f7702150433a
- Victory Auditor: 53d023d6-22cd-40a4-8561-3397771b62e9
- Orchestrator (prod fixes): e0a85903-c492-48bb-8f0e-76d36ac557f5
- Victory Auditor (prod fixes): [TBD - to be spawned on victory claim]

## 🔒 Key Constraints
- No technical decisions — relay only
- Victory Audit is MANDATORY before reporting completion
- Must not write code, analyze problems, or make technical decisions
- Keep context ultra-light

## Routing Decision
- Route: General -> teamwork_preview_orchestrator
- Rationale: Production code fixes, schema migrations, security hardening, accounting and domain logic across entire codebase; SWE general orchestration.
- Active Orchestrator: e0a85903-c492-48bb-8f0e-76d36ac557f5
- Working Directory: c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1

## Cron Tasks
- Cron 1 (Progress Reporting `*/8 * * * *`): task-30
- Cron 2 (Liveness Check `*/10 * * * *`): task-32

## User Context
- **Last user request**: Production-readiness fixes for tailor POS across R1 (ZATCA Phase 2 & Security), R2 (Financial integrity & Workforce schema), R3 (Customer lifecycle & domain logic).
- **Pending clarifications**: none
- **Delivered results**: previous comprehensive review report complete; production implementation launched.

## Project Status
- **Phase**: in progress

## Victory Audit Status
- **Triggered**: no
- **Verdict**: pending
- **Retry count**: 0

## Artifact Index
- c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md — Original User Request
- c:\my-pos\V4\comprehensive_app_review.md — Comprehensive Review Report
- c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1 — Orchestrator workspace

