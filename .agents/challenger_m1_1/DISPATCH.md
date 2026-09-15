# Task Assignment: Challenger 1 for Milestone 1

**Role**: Security & ZATCA Challenger 1
**Working Directory**: c:\my-pos\V4\.agents\challenger_m1_1
**Authoritative Request**: c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md
**Project Scope**: c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1\PROJECT.md
**Worker Handoff**: c:\my-pos\V4\.agents\worker_m1_security_1\handoff.md

## Mission
Stress-test and challenge Milestone 1 fixes:
1. Path Traversal Fuzzing: Try multiple payloads against `tailor:readAttachment` logic (e.g. `..\\..\\..\\Windows\\win.ini`, `attachments/../../test`, absolute paths, null bytes). Verify all out-of-boundary access is rejected.
2. Authentication & PIN Hardening: Test PIN verification with empty strings, null, non-numeric inputs, timing comparisons, and database reboot persistence.
3. ZATCA BER-TLV QR verification: Test parsing of generated BER-TLV payload to ensure Tags 1-5 adhere strictly to ZATCA Phase 2 byte standards.

Execute empirical test harnesses. Determine verdict: APPROVE or REJECT.

## 2026-09-11T00:25:00Z
You are a teamwork_preview_challenger.
Your working directory is: c:\my-pos\V4\.agents\challenger_m1_1
Your task assignment is in: c:\my-pos\V4\.agents\challenger_m1_1\DISPATCH.md
You MUST read c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md, c:\my-pos\V4\.agents\teamwork_preview_orchestrator_prod_1\PROJECT.md, and the worker handoff report at c:\my-pos\V4\.agents\worker_m1_security_1\handoff.md.

Adversarially challenge Milestone 1:
1. Test path traversal edge cases against the `tailor:readAttachment` containment logic.
2. Test authentication boundaries (empty PINs, non-numeric, timing-safe checks, reboot persistence).
3. Test ZATCA BER-TLV bytes.
Run empirical tests, determine verdict: APPROVE or REJECT.
Write your report to c:\my-pos\V4\.agents\challenger_m1_1\handoff.md.
When finished, send a message to parent with your verdict and report path.
