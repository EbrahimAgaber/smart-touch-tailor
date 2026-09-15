# Milestone 1 (Security & ZATCA Phase 2) Handoff Report

**Agent**: `worker_m1_security_1`  
**Role**: Implementer / QA / Specialist  
**Working Directory**: `c:\my-pos\V4\.agents\worker_m1_security_1`  
**Parent Conversation ID**: `e0a85903-c492-48bb-8f0e-76d36ac557f5`  
**Timestamp**: 2026-09-11T00:24:00Z  

---

## 1. Observation

### 1.1 Credential Reset Backdoor & Legacy Hashing (`electron/database.cjs`)
1. In `electron/database.cjs`, lines 869–886 previously contained an unconditional database startup script:
   ```javascript
   try {
       console.log('[Auth] Checking for emergency PIN resets...');
       const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
       if (adminUser) {
           db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
           console.log(`[Auth] Emergency: Admin '${adminUser.name}' (ID: ${adminUser.id}) PIN reset to '1234'`);
       }
       ...
   }
   ```
   This caused every database initialization/application boot to overwrite the Admin PIN to `'1234'` and Cashier PIN to `'0000'`.
2. Lines 30–32 used static single-iteration SHA-256:
   ```javascript
   function hashPin(pin) {
       return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
   }
   ```
   This enabled trivial pre-computation rainbow table attacks against 4-digit PINs.
3. Lines 2945–2947 logged audit events with `NULL` `user_id`:
   ```javascript
   function addAuditLog(action, details) {
       try { db.prepare('INSERT INTO audit_logs (action, details) VALUES (?,?)').run(action, details); } catch (e) {}
   }
   ```

### 1.2 Arbitrary File Read & RBAC Gating (`electron/main.cjs`)
1. `tailor:readAttachment` at lines 782–788 read arbitrary file paths without path containment:
   ```javascript
   ipcMain.handle('tailor:readAttachment', (e, filePath) => {
       try {
           return { success: true, base64: 'data:image/jpeg;base64,' + fs.readFileSync(filePath).toString('base64') };
       } catch(err) { ... }
   });
   ```
2. IPC handler gating in `main.cjs` used only `_gated()`, which validated software license presence but performed no authentication or role authorization. Sensitive administrative endpoints (`db:deleteStaff`, `db:addStaff`, `settings:save`, `db:voidSale`, `tailor:refundOrder`) were exposed to any renderer script evaluation without role checks.

### 1.3 Tailor POS Receipt & ZATCA Non-Compliance (`src/hooks/useTailorPos.jsx`)
1. Lines 430 passed a single dummy generic line item to `saveSale`:
   ```javascript
   items: [{ item_name: 'تفصيل خياطة', quantity: 1, item_price: finalSubtotal }]
   ```
2. Lines 481–548 generated thermal receipts with:
   - Header `'فاتورة خياطة تفصيل'` instead of mandatory `'فاتورة ضريبية مبسطة'`.
   - Missing seller 15-digit Tax Identification Number (TIN).
   - Displayed internal `#${res?.order_id || invoiceNumber}` instead of the official tax invoice number (`finalTaxInvoiceNum`).
   - Completely omitted the 2D ZATCA BER-TLV QR barcode.

---

## 2. Logic Chain

1. **Eliminating Credential Loss**:
   - By removing lines 869–886 from `electron/database.cjs`, custom PINs set by business owners persist indefinitely across app reboots.
   - Guarding the startup loop (`!s.pin.startsWith('pbkdf2$') && s.pin.length !== 64`) ensures existing PBKDF2 hashes are never re-hashed.

2. **Fortifying PIN Storage & Backward Compatibility**:
   - `hashPin` now uses `crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha256')` with unique 16-byte random salts, outputting `pbkdf2$100000$<salt_hex>$<hash_hex>`.
   - `verifyPin` compares hashes using `crypto.timingSafeEqual` against timing attacks.
   - If a stored hash matches the legacy SHA-256 format (`pos-salt-2026-`), `verifyStaffPin` authenticates the user and immediately updates `staff.pin` with a newly generated salted PBKDF2 hash, ensuring transparent zero-downtime credential migration.

3. **Restricting File Traversal**:
   - `tailor:readAttachment` in `main.cjs` resolves paths against `path.resolve(app.getPath('userData'), 'attachments')`.
   - `path.relative(attachmentsDir, resolvedPath)` validates that the relative path does not begin with `'..'` and is not an absolute path escaping the root directory. Any traversal attempt is blocked with `{ success: false, error: 'ACCESS_DENIED: Path outside permitted attachments directory.' }`.
   - `fs.statSync` verifies `stat.isFile()`, and dynamic MIME type mapping generates the correct Data URI header (`image/jpeg`, `image/png`, `application/pdf`, etc.).

4. **IPC Role-Based Access Control**:
   - Added `_activeSession`, `_setSession`, and `_requireRole(allowedRoles, fn)` in `main.cjs`.
   - `db:verifyStaffPin` calls `_setSession(staff)`, which sets active user ID in session and invokes `db.setAuditUserId(staff.id)`.
   - `_requireRole(['admin'])` protects `db:addStaff`, `db:updateStaff`, `db:deleteStaff`, `db:updateStaffPermissions`, `settings:save`, `acct:lockPeriod`, `acct:unlockPeriod`.
   - `_requireRole(['admin', 'manager'])` protects `db:voidSale`, `db:correctPaymentMethod`, `tailor:refundOrder`.
   - Unauthenticated calls return `{ success: false, error: 'UNAUTHENTICATED' }`, while unauthorized roles return `{ success: false, error: 'FORBIDDEN' }`.
   - `addAuditLog` writes `user_id` to `audit_logs`, and `getAuditLogs` joins `staff` to populate `user_name_from_staff`.

5. **ZATCA Phase 2 Tailor Thermal Receipt**:
   - In `useTailorPos.jsx`, `items.map(...)` generates itemized bespoke garment entries passed to `saveSale`.
   - `finalTaxInvoiceNum` (`INV-...`) from `saveSale` is passed to `tailor:createOrder` and displayed prominently as the tax invoice number.
   - Fresh settings are fetched for `business_name_ar` and `vat_number`.
   - `window.api.getZatcaTLV` retrieves the BER-TLV payload, and `window.api.generateQR` converts it to a high-contrast PNG data URI.
   - The receipt displays:
     - Header: `"فاتورة ضريبية مبسطة"`
     - Seller VAT Number (15-digit TIN)
     - Sequential Tax Invoice Number and Order ID
     - Itemized bespoke garments table
     - Subtotal, discount, VAT (15%), and total
     - Deposit paid and balance due at pickup
     - Prominent expected delivery date box
     - ZATCA BER-TLV QR barcode image

---

## 3. Caveats

- **ZATCA CSID Status**: If the local POS device is not yet onboarded to the ZATCA production portal, `getZatcaTLV` automatically generates the Phase 1 5-tag TLV QR code as designed by the ZATCA fail-safe specification in `zatca_utils.cjs`. Once onboarded, it outputs the full 9-tag BER-TLV signed cryptographic QR code.
- **Physical Thermal Printers**: Receipt printing utilizes `window.api.printHTML` (which invokes Electron's silent printing via `win.webContents.print`). If no physical thermal printer is attached or configured in Windows, Electron gracefully falls back to the system print dialog.

---

## 4. Conclusion

All Milestone 1 requirements from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `DISPATCH.md` are completely implemented:
1. Hardcoded PIN resets (lines 869–886 in `database.cjs`) have been deleted; custom PINs survive database restarts.
2. 100,000-iteration salted PBKDF2 hashing with random 16-byte salts and auto-migration is fully operational.
3. Path containment in `tailor:readAttachment` eliminates arbitrary local file read vulnerabilities.
4. RBAC session management protects administrative IPC handlers and populates `user_id` in `audit_logs`.
5. Tailor POS receipts comply with ZATCA Phase 2 specifications (simplified tax invoice header, seller VAT number, sequential tax invoice number, itemized bespoke garments, BER-TLV QR code).

---

## 5. Verification Method

### 5.1 Programmatic Test Suite
Execute the newly added comprehensive verification test suite:
```powershell
powershell -Command "$env:ELECTRON_RUN_AS_NODE='1'; npx electron tests/test_m1_security.cjs"
```
**Expected Result**:
- 42/42 assertions pass cleanly with exit code 0:
  - Database init & PBKDF2 seeding passed.
  - Admin PIN reboot retention passed (PIN 7788 retained, backdoor PIN 1234 rejected).
  - PBKDF2 random salt uniqueness and timing-safe verification passed.
  - Legacy static-salt SHA-256 auto-migration passed for both specific ID and fast-login.
  - Audit log `user_id` attribution and staff name resolution passed.
  - Relative and absolute directory traversal blocked (`ACCESS_DENIED`). Valid attachment read verified with correct MIME type (`image/png`).
  - RBAC checks passed: unauthenticated rejected (`UNAUTHENTICATED`), cashier blocked from admin/manager endpoints (`FORBIDDEN`), manager permitted for manager endpoints, admin permitted for all.
  - ZATCA BER-TLV tag decoding validated for Tag 1, Tag 2, Tag 3, Tag 4, Tag 5.

### 5.2 Frontend Build
Execute Vite production build:
```powershell
npx vite build
```
**Expected Result**:
- Exits with code 0 (`built in 36.72s`). Zero bundle or syntax errors.
