# Security & ZATCA Phase 2 Comprehensive Exploration Report

**Agent**: Security & ZATCA Explorer (`explorer_survey_security_1`)  
**Working Directory**: `c:\my-pos\V4\.agents\explorer_survey_security_1`  
**Target Focus**: Requirement 1: ZATCA Compliance & Critical Security Fixes  
**Reference Documents**:
- `c:\my-pos\V4\.agents\ORIGINAL_REQUEST.md`
- `c:\my-pos\V4\comprehensive_app_review.md`

---

## 1. Observation

### 1.1 database.cjs & Authentication / PIN Reset Logic
1. **Hardcoded Emergency PIN Overwrite on Boot**:
   - **File**: `c:\my-pos\V4\electron\database.cjs`
   - **Lines**: 869–886
   - **Verbatim Code**:
```javascript
try {
    console.log('[Auth] Checking for emergency PIN resets...');
    const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
    if (adminUser) {
        db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
        console.log(`[Auth] Emergency: Admin '${adminUser.name}' (ID: ${adminUser.id}) PIN reset to '1234'`);
    } else {
        console.warn('[Auth] Emergency: No Admin user found to reset.');
    }

    const cashierUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'cashier'").get();
    if (cashierUser) {
        db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('0000'), cashierUser.id);
        console.log(`[Auth] Emergency: Cashier '${cashierUser.name}' (ID: ${cashierUser.id}) PIN reset to '0000'`);
    }
} catch (err) {
    console.error('[Auth] Emergency Reset Fatal Error:', err);
}
```
   - **Impact**: On every application startup / database initialization, lines 869–886 query the `staff` table and unconditionally execute an `UPDATE staff SET pin = ? WHERE id = ?`, resetting the Admin PIN to `'1234'` and Cashier PIN to `'0000'`. Any PIN modification made by an owner or employee is completely erased on app reboot.

2. **Single-Iteration Static-Salt SHA-256 Hashing**:
   - **File**: `c:\my-pos\V4\electron\database.cjs`
   - **Lines**: 30–32
   - **Verbatim Code**:
```javascript
function hashPin(pin) {
    return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
}
```
   - **Impact**: 4-digit PINs (0000–9999) have only 10,000 combinations. Using an unsalted, hardcoded static string (`'pos-salt-2026-' + pin`) allows an attacker with read access to `pos_data.db` to precompute a complete 10,000-hash rainbow lookup table in under 50ms.

3. **Staff Seeding, Mutation & Verification Operations**:
   - **Initial Seed**: `database.cjs:856–860`:
```javascript
const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;
if (staffCount === 0) {
    db.prepare('INSERT INTO staff (name, pin, role) VALUES (?,?,?)').run('المدير العام', hashPin('1234'), 'Admin');
    db.prepare('INSERT INTO staff (name, pin, role) VALUES (?,?,?)').run('كاشير 1', hashPin('0000'), 'Cashier');
}
```
   - **Staff Insertion**: `database.cjs:2671–2678` (`addStaff`) hashes PIN using `hashPin(String(data.pin))`.
   - **Staff Update**: `database.cjs:2680–2694` (`updateStaff`) hashes updated PIN using `hashPin(String(data.pin))`.
   - **PIN Verification**: `database.cjs:2707–2736` (`verifyStaffPin(pin, staffId = null)`):
     Compares computed hash against `staff.pin` or executes `SELECT * FROM staff WHERE pin = ?`.
   - **Staff Schema**: `database.cjs:437–444`:
```sql
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'Cashier',
    permissions_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 1.2 ipcMain.handle('tailor:readAttachment', ...) & Path Traversal Vulnerability
1. **Handler Implementation in Main Process**:
   - **File**: `c:\my-pos\V4\electron\main.cjs`
   - **Lines**: 782–788
   - **Verbatim Code**:
```javascript
// File Server for rendering attachments in UI securely via custom protocol or simple path
ipcMain.handle('tailor:readAttachment', (e, filePath) => {
    try {
        return { success: true, base64: 'data:image/jpeg;base64,' + fs.readFileSync(filePath).toString('base64') };
    } catch(err) {
        return { success: false, error: err.message };
    }
});
```
   - **Preload Mapping**: `c:\my-pos\V4\electron\preload.cjs:386`:
```javascript
readAttachment: (path) => ipcRenderer.invoke('tailor:readAttachment', path),
```
   - **Saving Counterpart**: `c:\my-pos\V4\electron\main.cjs:766–775`:
     Saves customer attachments into `path.join(app.getPath('userData'), 'attachments')`.
   - **Vulnerabilities Identified**:
     - **Arbitrary Local File Read**: Accepts any arbitrary file path string from the renderer process and passes it directly to `fs.readFileSync(filePath)`.
     - **Path Traversal**: No validation prevents passing relative sequences (`../../../../windows/win.ini`, `../../../../etc/passwd`) or absolute paths outside permitted directory.
     - **No File Type or Existence Guard**: Throws uncaught or returns error if directory is passed; does not verify `stat.isFile()`.
     - **Hardcoded MIME Type**: Prepends `data:image/jpeg;base64,` regardless of whether the file is PNG, WEBP, or PDF.

---

### 1.3 Role-Based Access Control (RBAC) on IPC Endpoints
1. **Current Backend IPC Gating**:
   - **File**: `c:\my-pos\V4\electron\main.cjs`
   - **Lines**: 336–343
   - **Verbatim Code**:
```javascript
// ── _gated — unchanged signature ─────────────────────────────────────────────
function _gated(fn) {
    return async (e, ...args) => {
        if (!_isLicenseActive()) {
            return { success: false, error: 'LICENSE_REQUIRED', message: 'الترخيص غير صالح أو منتهي الصلاحية — يرجى تجديد الاشتراك' };
        }
        return fn(e, ...args);
    };
}
```
   - **Vulnerability**: `_gated` validates **only** software license status. It performs **zero user authentication and zero role authorization**.
   - **Critical Exposed Endpoints**:
     - `db:deleteStaff`, `db:addStaff`, `db:updateStaff`, `db:updateStaffPermissions` (`main.cjs:720–737`)
     - `settings:save` (`main.cjs:485`) — not even wrapped in `_gated`!
     - `db:voidSale` (`main.cjs:456`)
     - `acct:postJournalEntry`, `acct:reverseJournalEntry` (`main.cjs:496–497`)
     - `acct:lockPeriod`, `acct:unlockPeriod` (`main.cjs:507–508`)
     - `compliance:executeClose` (`main.cjs:667`)
     - `p2:postPayrollRun`, `p2:disbursePayroll` (`main.cjs:604, 607`)
   - **Audit Log Disconnect**: `database.cjs:2945–2947`:
     `db.prepare('INSERT INTO audit_logs (action, details) VALUES (?,?)').run(action, details)` discards `user_id`. Every audit log row shows `#?` for staff in `src/pages/AuditLogs.jsx:154`.

---

### 1.4 Tailor POS Thermal Receipt & ZATCA Phase 2 Compliance
1. **Current Receipt Implementation in Tailor POS**:
   - **File**: `c:\my-pos\V4\src\hooks\useTailorPos.jsx`
   - **Lines**: 481–548 (`handlePrintInvoice` inside `saveOrder`)
   - **Verbatim Code**:
```javascript
let receiptHTML = `
    <html dir="rtl">
    <head>
        <style>
            body { font-family: 'Tahoma', sans-serif; font-size: 12px; margin: 0; padding: 10px; width: 80mm; color: #000; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .mt-2 { margin-top: 10px; }
            .mb-2 { margin-bottom: 10px; }
            .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
            .flex { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 11px; }
            th { text-align: right; }
        </style>
    </head>
    <body>
        <div class="text-center font-bold mb-2" style="font-size: 16px;">${businessName}</div>
        <div class="text-center border-b">فاتورة خياطة تفصيل</div>
        <div class="flex mt-2"><span>رقم الفاتورة:</span> <span dir="ltr">#${res?.order_id || invoiceNumber}</span></div>
        <div class="flex"><span>التاريخ:</span> <span dir="ltr">${new Date().toLocaleDateString('en-CA')}</span></div>
        <div class="flex"><span>العميل:</span> <span>${name}</span></div>
        <div class="flex border-b"><span>الجوال:</span> <span dir="ltr">${phone}</span></div>
        ...
`;
```
2. **Direct Violations of ZATCA Phase 2 E-Invoicing Regulations**:
   - **NO QR CODE**: Thermal slip contains 0 QR code tags (omits both Phase 1 5-tag TLV and Phase 2 9-tag BER-TLV).
   - **OMISSION OF SELLER VAT NUMBER**: The seller's mandatory 15-digit Tax Identification Number (TIN) is absent.
   - **ILLEGAL TITLE**: Uses 'فاتورة خياطة تفصيل' instead of mandatory 'فاتورة ضريبية مبسطة' (Simplified Tax Invoice).
   - **FICTITIOUS INVOICE NUMBER**: Displays `#${res?.order_id || invoiceNumber}`, which is an internal tailor order ID rather than the sequential ZATCA tax invoice sequence number (`saleRes.invoice`).
   - **LUMP-SUM GENERIC SALE ITEM**: In `useTailorPos.jsx:430`, `saveSale` is passed `items: [{ item_name: 'تفصيل خياطة', quantity: 1, item_price: finalSubtotal }]`, hiding individual bespoke garments from the tax register.
3. **Reference Compliant Implementation in Retail Module**:
   - **File**: `c:\my-pos\V4\src\pages\Pos.jsx:896–1050` & `Pos.jsx:1400–1511`
   - Uses `window.api.getZatcaTLV` (`main.cjs:978`) and `window.api.generateQR` (`main.cjs:956`).
   - `zatca:getTLV` queries `zatca_queue.signed_xml` for the 9-tag BER-TLV or generates it via `zatca_utils.cjs:491` (`generateZatcaTLV9`).
   - `zatca:generateQR` transforms binary Base64 TLV into `Uint8Array` and renders a PNG Data URL using `qrcode.toDataURL([{ data: byteArray, mode: 'byte' }])`.
   - Displays official header 'فاتورة ضريبية مبسطة', seller TIN, sequential invoice number, itemized breakdown, and 2D QR barcode.

---

## 2. Logic Chain

1. **Premise 1**: Operating in commercial Saudi retail without ZATCA compliance exposes business owners to immediate administrative fines (starting at SAR 5,000 up to SAR 50,000) and establishment closure under ZATCA Implementing Regulations.
   - *Supported by Observation 1.4*: The tailor receipt bypasses ZATCA mechanisms completely.

2. **Premise 2**: A POS system that overwrites credentials on restart cannot be deployed in production because credentials cannot be secured.
   - *Supported by Observation 1.1*: `database.cjs:869–886` explicitly runs `UPDATE staff SET pin = ...` on every launch.

3. **Premise 3**: Single-iteration SHA-256 with static salt provides virtually zero resistance against rainbow tables for 4-to-6 digit numeric PIN spaces (10^4 to 10^6 combinations).
   - *Supported by Observation 1.1*: `database.cjs:30–32` uses `'pos-salt-2026-' + pin`.

4. **Premise 4**: Electron desktop applications with unconfined IPC file read handlers are susceptible to local file exfiltration if any renderer code, third-party dependency, or IPC call supplies an arbitrary path.
   - *Supported by Observation 1.2*: `main.cjs:782–788` executes `fs.readFileSync(filePath)` without directory boundaries.

5. **Premise 5**: Security in depth requires backend IPC validation; frontend-only gating (`useAuthStore`, `can()`) can be trivially bypassed in Electron via Developer Tools or window script evaluation.
   - *Supported by Observation 1.3*: `main.cjs:336–343` has no concept of the active user session or role permissions.

---

## 3. Proposed Code Fixes & Architectural Specifications

### Fix 1: Eradicate Boot Backdoor & Implement Salted PBKDF2 in `electron/database.cjs`

#### A. Remove Emergency Backdoor
Delete lines 869–886 in `electron/database.cjs`:
```javascript
// DELETE LINES 869-886 in electron/database.cjs:
try {
    console.log('[Auth] Checking for emergency PIN resets...');
    const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
    if (adminUser) {
        db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
        console.log(`[Auth] Emergency: Admin '${adminUser.name}' (ID: ${adminUser.id}) PIN reset to '1234'`);
    }
    ...
} catch (err) { ... }
```
**Replacement**: Leave only the one-time seeding guard at lines 856–860 (`if (staffCount === 0)`).

#### B. Implement Cryptographic Salted Hashing with Backward Compatibility
In `electron/database.cjs:30–33`, replace `hashPin` with:
```javascript
// ─────────────────────────────────────────────
// SECURITY HELPERS (PBKDF2 with Salt & Legacy Migration)
// ─────────────────────────────────────────────
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function hashPin(pin, existingSalt = null) {
    if (!pin) return '';
    const salt = existingSalt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(String(pin), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
    return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

function verifyPin(inputPin, storedHash) {
    if (!storedHash || !inputPin) return false;
    const strPin = String(inputPin);

    // New format: pbkdf2$iterations$salt$hash
    if (storedHash.startsWith('pbkdf2$')) {
        const parts = storedHash.split('$');
        if (parts.length !== 4) return false;
        const iterations = parseInt(parts[1], 10);
        const salt = parts[2];
        const hash = parts[3];
        const testHash = crypto.pbkdf2Sync(strPin, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
        try {
            return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
        } catch (_) {
            return false;
        }
    }

    // Legacy format fallback: SHA-256 with static salt 'pos-salt-2026-'
    const legacyHash = crypto.createHash('sha256').update('pos-salt-2026-' + strPin).digest('hex');
    if (storedHash === legacyHash) {
        return true;
    }

    return false;
}
```

#### C. Update `verifyStaffPin` in `electron/database.cjs:2707–2736`
Update `verifyStaffPin` to use `verifyPin` and perform seamless auto-migration of legacy hashes to PBKDF2:
```javascript
function verifyStaffPin(pin, staffId = null) {
    console.log(`[Auth] Verifying PIN for staffId: ${staffId || 'ANY'}`);
    let staff = null;

    if (staffId) {
        staff = db.prepare('SELECT * FROM staff WHERE id=?').get(staffId) || null;
        if (staff) {
            if (verifyPin(pin, staff.pin)) {
                // Verified successfully
            } else {
                console.warn(`[Auth] PIN mismatch for ${staff.name}`);
                staff = null;
            }
        }
    } else {
        // Fast-login: iterate active staff and match hash securely
        const allStaff = db.prepare('SELECT * FROM staff').all();
        for (const s of allStaff) {
            if (verifyPin(pin, s.pin)) {
                staff = s;
                break;
            }
        }
    }

    if (staff) {
        // Auto-migrate legacy hash to PBKDF2 on successful login
        if (staff.pin && !staff.pin.startsWith('pbkdf2$')) {
            try {
                const newHash = hashPin(pin);
                db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(newHash, staff.id);
                console.log(`[Auth] Migrated staff ID ${staff.id} ('${staff.name}') to salted PBKDF2`);
                staff.pin = newHash;
            } catch (migErr) {
                console.error('[Auth] Failed to auto-migrate PIN hash:', migErr);
            }
        }
        console.log(`[Auth] Success: ${staff.name} (${staff.role}) logged in.`);
    } else {
        console.warn(`[Auth] Auth Failed.`);
    }
    return staff;
}
```

---

### Fix 2: Sanitize `tailor:readAttachment` with Strict Path Containment

In `c:\my-pos\V4\electron\main.cjs:782–788`:
Replace the existing vulnerable handler with path validation:
```javascript
// File Server for rendering attachments in UI securely with Path Traversal Prevention
ipcMain.handle('tailor:readAttachment', async (e, filePath) => {
    try {
        if (!filePath || typeof filePath !== 'string') {
            return { success: false, error: 'INVALID_PATH: File path must be a non-empty string.' };
        }

        const attachmentsDir = path.resolve(app.getPath('userData'), 'attachments');
        if (!fs.existsSync(attachmentsDir)) {
            fs.mkdirSync(attachmentsDir, { recursive: true });
        }

        // Canonical resolution: support either relative filename or full path
        const resolvedPath = path.isAbsolute(filePath)
            ? path.resolve(filePath)
            : path.resolve(attachmentsDir, filePath);

        // Strict boundary check: resolvedPath MUST reside within attachmentsDir
        const relative = path.relative(attachmentsDir, resolvedPath);
        const isContained = !relative.startsWith('..') && !path.isAbsolute(relative);
        if (!isContained) {
            console.warn(`[Security Alert] Blocked directory traversal attempt: ${filePath}`);
            return { success: false, error: 'ACCESS_DENIED: Path outside permitted attachments directory.' };
        }

        if (!fs.existsSync(resolvedPath)) {
            return { success: false, error: 'FILE_NOT_FOUND' };
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            return { success: false, error: 'NOT_A_FILE' };
        }

        // Detect appropriate MIME type
        const ext = path.extname(resolvedPath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf'
        };
        const mime = mimeTypes[ext] || 'application/octet-stream';
        const data = fs.readFileSync(resolvedPath);

        return {
            success: true,
            base64: `data:${mime};base64,${data.toString('base64')}`,
            fileName: path.basename(resolvedPath),
            size: stat.size,
            mimeType: mime
        };
    } catch(err) {
        return { success: false, error: err.message };
    }
});
```

---

### Fix 3: Enforce Role-Based Access Control (RBAC) in Electron Main Process

In `c:\my-pos\V4\electron\main.cjs`:

1. **Stateful Session Tracking & Authentication Middleware**:
```javascript
// ── Session State & Role-Based Access Control (RBAC) ──────────────────────────
let _activeSession = null;

function _setSession(staff) {
    if (!staff) {
        _activeSession = null;
        return;
    }
    _activeSession = {
        id: staff.id,
        name: staff.name,
        role: String(staff.role || 'Cashier').toLowerCase(),
        permissions: JSON.parse(staff.permissions_json || '[]'),
        loginAt: Date.now()
    };
}

function _requireRole(allowedRoles = ['admin'], fn) {
    return async (e, ...args) => {
        if (!_isLicenseActive()) {
            return { success: false, error: 'LICENSE_REQUIRED', message: 'الترخيص غير صالح أو منتهي الصلاحية' };
        }
        if (!_activeSession) {
            return { success: false, error: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول أولاً للقيام بهذه العملية' };
        }
        const userRole = _activeSession.role;
        const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
        
        // Admin always has full bypass authority
        if (userRole !== 'admin' && !normalizedAllowed.includes(userRole)) {
            console.warn(`[RBAC] Access denied for user ${_activeSession.name} (${userRole}) to restricted endpoint.`);
            return { success: false, error: 'FORBIDDEN', message: 'غير مصرح لك بتنفيذ هذا الإجراء' };
        }
        return fn(e, ...args);
    };
}
```

2. **Hook Session Initialization into `db:verifyStaffPin` and `auth:logout`**:
```javascript
ipcMain.handle('db:verifyStaffPin', (e, { pin, staffId }) => {
    const staff = db.verifyStaffPin(pin, staffId);
    if (staff) {
        _setSession(staff);
    }
    return staff;
});

ipcMain.handle('auth:logout', () => {
    _setSession(null);
    return { success: true };
});

ipcMain.handle('auth:getCurrentSession', () => _activeSession);
```

3. **Protect Critical Endpoints**:
```javascript
// Admin-only endpoints:
ipcMain.handle('db:addStaff',            _requireRole(['admin'], (e, d) => db.addStaff(d)));
ipcMain.handle('db:updateStaff',         _requireRole(['admin'], (e, d) => db.updateStaff(d)));
ipcMain.handle('db:deleteStaff',         _requireRole(['admin'], (e, id) => db.deleteStaff(id)));
ipcMain.handle('db:updateStaffPermissions', _requireRole(['admin'], (e, d) => db.updateStaffPermissions(d?.id, d?.perms)));
ipcMain.handle('settings:save',          _requireRole(['admin'], (e, d) => db.saveSettings(d)));
ipcMain.handle('acct:lockPeriod',        _requireRole(['admin'], (e, d) => db.lockPeriod(d.periodId, d.lockType, _activeSession?.id || 1)));
ipcMain.handle('acct:unlockPeriod',      _requireRole(['admin'], (e, d) => db.unlockPeriod(d.periodId)));

// Manager + Admin endpoints:
ipcMain.handle('db:voidSale',            _requireRole(['admin', 'manager'], (e, d) => db.voidSale(d?.invoiceId, d?.reason)));
ipcMain.handle('db:correctPaymentMethod', _requireRole(['admin', 'manager'], (e, d) => db.correctPaymentMethod(d.invoiceId, d.newMethod, _activeSession?.id || 1)));
ipcMain.handle('db:adjustStock',         _requireRole(['admin', 'manager'], (e, d) => db.addStockAdjustment(d)));
ipcMain.handle('tailor:refundOrder',     _requireRole(['admin', 'manager'], (e, d) => db.refundTailorOrder(d.order_id, d.is_cut, d.penalty_amount)));
```

4. **Integrate Session ID into Audit Logging (`database.cjs:2945–2947`)**:
```javascript
function addAuditLog(action, details, userId = null) {
    try {
        const uid = userId || (_activeSession ? _activeSession.id : null);
        db.prepare('INSERT INTO audit_logs (user_id, action, details) VALUES (?,?,?)').run(uid, action, details);
    } catch (e) {}
}
```

---

### Fix 4: Fully Compliant ZATCA Phase 2 Tailor Thermal Receipt

In `src/hooks/useTailorPos.jsx`:

1. **Pass Itemized Bespoke Garments to `saveSale` (Lines 420–432)**:
```javascript
// Build real itemized lines instead of single generic 'تفصيل خياطة'
const saleItems = items.map(i => {
    const fab = fabrics.find(f => f.ID == i.fabric_code);
    const fName = i.fabric_code === 'BYOF' ? 'قماش العميل الخارجي' : (fab?.Name || 'قماش من المحل');
    const gType = i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'sirwal' ? 'سروال' : i.garment_type === 'shirt' ? 'قميص' : 'بشت';
    return {
        Name: `تفصيل ${gType} (${fName})`,
        item_name: `تفصيل ${gType} (${fName})`,
        Qty: 1,
        quantity: 1,
        Price: parseFloat(i.price || 0),
        item_price: parseFloat(i.price || 0)
    };
});

const saleInvoiceStr = `INV-${Date.now()}`;
const saleRes = await window.api?.saveSale?.({
    invoice: saleInvoiceStr,
    total: total,
    subtotal: finalSubtotal,
    tax: vat,
    paid: depositAmount,
    payment: finalPaymentMethod,
    customer_id: customerId,
    staff_id: tailorId || undefined,
    order_type: 'tailor',
    items: saleItems
});
if (saleRes && !saleRes.success) throw new Error(saleRes.error || 'فشل حفظ الفاتورة الضريبية');
const finalTaxInvoiceNum = saleRes?.invoice || saleInvoiceStr;
```

2. **Fetch Settings & Generate ZATCA Phase 2 BER-TLV QR**:
```javascript
const settings = await window.api?.getSettings?.() || {};
const bizAr = settings.business_name_ar || businessName || 'البصمة الذكية للخياطة';
const vatNum = settings.vat_number || settings.tax_number || '—';
const bizAddress = settings.address || settings.address_street || '';

// Fetch BER-TLV (9-tag for Phase 2, 5-tag fallback for Phase 1)
const qrData = await window.api?.getZatcaTLV?.({
    invoice: finalTaxInvoiceNum,
    seller: bizAr,
    vatNo: vatNum,
    timestamp: new Date().toISOString(),
    total: total.toFixed(2),
    vatAmt: vat.toFixed(2)
});

// Render high-contrast QR PNG Data URL via backend qrcode engine
const qrUrl = qrData ? (await window.api?.generateQR?.(qrData)) || '' : '';
```

3. **Construct Compliant 80mm Thermal Receipt Layout (Lines 481–542)**:
```html
<html dir="rtl">
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; }
        @page { margin: 0; size: 80mm auto; }
        body { font-family: 'Tajawal', 'Tahoma', sans-serif; font-size: 12px; margin: 0; padding: 6mm; width: 80mm; color: #000; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
        .flex { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
        .invoice-badge { text-align: center; font-weight: 800; font-size: 13px; border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 4px 0; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { padding: 4px 0; border-bottom: 1px dotted #999; font-size: 11px; }
        th { text-align: right; font-weight: bold; }
        .qr-box { margin: 12px auto; text-align: center; width: 110px; height: 110px; }
        .footer { text-align: center; font-size: 10px; margin-top: 10px; line-height: 1.4; }
    </style>
</head>
<body>
    <div class="text-center font-bold" style="font-size: 15px;">${bizAr}</div>
    ${bizAddress ? `<div class="text-center" style="font-size: 11px;">${bizAddress}</div>` : ''}
    <div class="text-center" style="font-size: 11px;">الرقم الضريبي: <strong>${vatNum}</strong></div>

    <div class="invoice-badge">فاتورة ضريبية مبسطة</div>

    <div class="flex"><span>رقم الفاتورة (Invoice No):</span><span dir="ltr" class="font-bold">${finalTaxInvoiceNum}</span></div>
    <div class="flex"><span>رقم الطلب (Order ID):</span><span class="font-bold">#${res?.order_id || '—'}</span></div>
    <div class="flex"><span>التاريخ (Date):</span><span dir="ltr">${new Date().toLocaleString('ar-SA')}</span></div>
    <div class="flex"><span>العميل (Customer):</span><span>${name}</span></div>
    <div class="flex"><span>الجوال (Mobile):</span><span dir="ltr">${phone}</span></div>

    <table>
        <thead>
            <tr>
                <th>الصنف والوصف</th>
                <th class="text-center">العدد</th>
                <th class="text-left">السعر شامل الضريبة</th>
            </tr>
        </thead>
        <tbody>
            ${items.map(i => {
                const fab = fabrics.find(f => f.ID == i.fabric_code);
                const fName = i.fabric_code === 'BYOF' ? 'قماش خارجي' : (fab?.Name || 'قماش المحل');
                const gType = i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'sirwal' ? 'سروال' : i.garment_type === 'shirt' ? 'قميص' : 'بشت';
                return `
                <tr>
                    <td>${gType} - ${fName}</td>
                    <td class="text-center">1</td>
                    <td class="text-left" dir="ltr">${parseFloat(i.price).toFixed(2)} SAR</td>
                </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <div class="border-b" style="margin-top: 6px;"></div>
    <div class="flex"><span>المجموع غير شامل الضريبة:</span><span dir="ltr">${finalSubtotal.toFixed(2)} SAR</span></div>
    ${parseFloat(discount) > 0 ? `<div class="flex"><span>الخصم:</span><span dir="ltr">-${parseFloat(discount).toFixed(2)} SAR</span></div>` : ''}
    <div class="flex"><span>ضريبة القيمة المضافة (15%):</span><span dir="ltr">${vat.toFixed(2)} SAR</span></div>
    <div class="flex font-bold" style="font-size: 13px; border-top: 1px solid #000; padding-top: 4px;">
        <span>الإجمالي شامل الضريبة:</span><span dir="ltr">${total.toFixed(2)} SAR</span>
    </div>
    <div class="flex"><span>العربون المدفوع:</span><span dir="ltr">${depositAmount.toFixed(2)} SAR</span></div>
    <div class="flex font-bold" style="color: #000;"><span>المتبقي عند الاستلام:</span><span dir="ltr">${balance.toFixed(2)} SAR</span></div>

    <div class="text-center font-bold" style="border: 1px solid #000; padding: 4px; margin: 8px 0; background: #f9f9f9;">
        تاريخ التسليم المتوقع: ${deliveryDate}
    </div>

    ${qrUrl ? `
    <div class="qr-box">
        <img src="${qrUrl}" style="width: 100%; height: 100%; object-fit: contain;">
    </div>
    <div class="text-center" style="font-size: 9px; color: #555;">فاتورة ضريبية إلكترونية معتمدة - هيئة الزكاة والضريبة والجمارك</div>
    ` : `
    <div class="text-center font-bold" style="color: red; font-size: 10px; border: 1px dashed red; padding: 4px;">
        ⚠ تنبيه: تعذر تحميل رمز الاستجابة السريعة ZATCA
    </div>
    `}

    <div class="footer">
        <div>${settings.receipt_footer || 'شكراً لتعاملكم معنا'}</div>
        <div style="font-size: 8px; margin-top: 4px; color: #777;">نظام البصمة الذكية لإدارة مشاغل الخياطة</div>
    </div>
</body>
</html>
```

---

## 4. Caveats
- **Hardware Drivers**: Thermal printing depends on Electron's silent or standard printer driver (`win.webContents.print`). If no local thermal printer is connected, Electron will open the Windows native Print to PDF / system dialog.
- **ZATCA Onboarding CSID**: If a shop's device CSID has not been onboarded via Fatoora portal, `zatca_device.production_csid` is null; in that mode, `database.cjs:1668` correctly falls back to Phase 1 TLV mode (5-tag), ensuring invoices continue to generate valid tax QR codes without throwing rejection errors.
- **Alteration Receipts**: Similar compliant thermal receipts should also be attached when generating or paying alteration tickets in `src/pages/Alterations.jsx`.

---

## 5. Conclusion
The four critical vulnerabilities in R1 have been isolated with exact line numbers and concrete replacement code:
1. **PIN Backdoor**: Eradicate lines 869–886 in `database.cjs`. Replace static-salt SHA-256 with 100,000-iteration PBKDF2 with random 16-byte salt, supporting transparent auto-migration of existing hashes.
2. **Arbitrary File Read**: Patch `tailor:readAttachment` in `main.cjs:782–788` with canonical `path.relative` bounds checking against `app.getPath('userData')/attachments`, dynamic MIME detection, and file type validation.
3. **Backend RBAC**: Implement session tracking and `_requireRole` wrapper in `main.cjs`, protecting administrative endpoints (`db:deleteStaff`, `settings:save`, `db:voidSale`) and injecting session staff IDs into `audit_logs`.
4. **ZATCA Compliance in Tailor Receipts**: Refactor `useTailorPos.jsx:481–548` to print official 'فاتورة ضريبية مبسطة', display seller TIN, display sequential invoice number, itemize garments, and render server-generated 9-tag BER-TLV QR codes via `getZatcaTLV` and `generateQR`.

---

## 6. Verification Method

1. **PIN Backdoor Removal Verification**:
   - Change Admin PIN via UI or DB script to `9999`.
   - Restart the Electron application.
   - Query DB: `SELECT pin FROM staff WHERE role='Admin'`.
   - Verify that the PIN hash does NOT match `1234` and retains `9999`.

2. **PBKDF2 Password Hashing Verification**:
   - Add a new staff member or update a staff PIN.
   - Inspect the SQLite column: verify `staff.pin` begins with `pbkdf2$100000$`.
   - Log in with the legacy PIN: verify successful login and check that `staff.pin` is automatically upgraded to `pbkdf2$`.

3. **Arbitrary File Read & Path Traversal Verification**:
   - Invoke from DevTools: `window.api.tailor.readAttachment('../../../../Windows/System32/drivers/etc/hosts')`.
   - Verify that the response is `{ success: false, error: 'ACCESS_DENIED: Path outside permitted attachments directory.' }`.
   - Invoke with an existing attachment in `userData/attachments/test.jpg`: verify `{ success: true, base64: 'data:image/jpeg;base64,...' }`.

4. **RBAC Endpoint Protection Verification**:
   - Log in as Cashier (role: `Cashier`).
   - Emit IPC call to `db:deleteStaff` or `settings:save`.
   - Verify response is `{ success: false, error: 'FORBIDDEN', message: 'غير مصرح لك بتنفيذ هذا الإجراء' }`.

5. **ZATCA Phase 2 Tailor Receipt Verification**:
   - Create and save a tailoring order in `/tailor-pos`.
   - Inspect printed receipt HTML:
     - Header displays `"فاتورة ضريبية مبسطة"`.
     - Seller VAT number is displayed.
     - Tax invoice number matches `sales.invoice` (`INV-...`).
     - QR code image is rendered as a PNG data URL.
     - Scan QR code with ZATCA official compliance validator app (Fatoora App) to verify Tag 1 (Seller), Tag 2 (VAT), Tag 3 (Timestamp), Tag 4 (Total), Tag 5 (Tax).
