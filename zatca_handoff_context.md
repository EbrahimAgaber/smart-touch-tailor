# ZATCA Phase 2 Debugging Context & Handoff Summary

## Current State
The core ZATCA Phase 2 cryptographic and XML pipeline logic is **100% fixed and functional**. The `test_compliance_checklist.cjs` script successfully passes all 4 ZATCA invoice types (B2C, B2B, Credit Note, Debit Note) against the ZATCA validator. 

However, the user is still encountering the `"Compliance invoice checklist failed — production CSID was NOT requested."` error when running their standalone onboarding scripts.

## Root Cause of the Current Failure
The `runComplianceInvoiceChecklist` function (which generates the 4 dummy invoices for compliance testing) was duplicated across multiple scripts in the project:
- `electron/main.cjs`
- `onboard_compliance.js`
- `run_sandbox_onboarding.js`
- `run_sandbox_onboarding_log.js`
- `scratch/onboard_with_credentials.cjs`

I only updated the test data in `electron/main.cjs` and `scratch/test_compliance_checklist.cjs`. If the user runs `onboard_compliance.js` or `onboard_with_credentials.cjs`, those scripts still contain the **old, invalid test data** (e.g., negative totals for Credit Notes, invalid Buyer VAT numbers, missing B2B subtypes), causing the ZATCA validator to reject them and abort the CSID issuance.

## What Has Been Fixed in the Core Pipeline (`zatca_utils.cjs` & `zatca_phase2.cjs`)
1. **Tag 9 Signature Parsing:** Fixed `node-forge` auto-parsing the signature `BIT STRING` into an array. It now serializes the inner DER sequence properly, resolving `CERTIFICATE_SIGNATURE_QRCODE_INVALID`.
2. **TLV Cryptographic Encoding:** Correctly mapped Tags 6 and 7 to UTF-8 strings, and Tags 8 and 9 to base64 binary.
3. **Credit/Debit Note XSD Error:** Moved `<cac:BillingReference>` to appear before `<cac:AdditionalDocumentReference>` to satisfy UBL 2.1 schema validation.
4. **Credit/Debit Note Negative Values:** Enforced `Math.abs()` across all amounts in `generateUBL21XML`. ZATCA requires all amounts to be positive in the XML, even for Credit Notes.

## Next Steps for the New Model
1. Find all instances of the `runComplianceInvoiceChecklist` function across the codebase (e.g., `onboard_compliance.js`, `scratch/onboard_with_credentials.cjs`).
2. Update the dummy test invoices in those files to match the corrected payload structures. Specifically:
   - **B2B Standard:** Must have `subtype: '0100000'` instead of `typeCode: '0100000'`. Buyer VAT must be 15 digits starting and ending with 3 (e.g. `300000000000003`).
   - **Credit/Debit Notes:** Must pass a **positive** `total` (e.g., `115.00` instead of `-115.00`) and a positive `Qty`.
3. Once the test data is synced across all scripts, the user will be able to successfully run their standalone onboarding scripts.
