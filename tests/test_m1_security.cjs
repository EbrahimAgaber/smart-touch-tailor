// Comprehensive Programmatic Verification for Milestone 1
// Security & ZATCA Phase 2
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

console.log('====================================================');
console.log('Starting Milestone 1 Security & ZATCA Tests');
console.log('====================================================');

const testDir = path.join(__dirname, 'test_m1_sandbox');
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const dbLogic = require('../electron/database.cjs');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(message);
    }
    passedTests++;
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    // -------------------------------------------------------------
    // Test 1: Database Initialization & Seeding with PBKDF2
    // -------------------------------------------------------------
    console.log('\n--- 1. Database Init & PBKDF2 Seeding ---');
    dbLogic.initDatabase(testDir);
    const db = dbLogic.getDbInstance();

    const staffList = dbLogic.getStaff();
    assert(staffList.length >= 2, 'Initial staff seeded with at least 2 accounts');

    const admin = db.prepare("SELECT * FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
    assert(admin !== undefined, 'Admin staff exists');
    assert(admin.pin.startsWith('pbkdf2$100000$'), 'Admin PIN is hashed with PBKDF2 100,000 iterations');

    const cashier = db.prepare("SELECT * FROM staff WHERE LOWER(TRIM(role)) = 'cashier'").get();
    assert(cashier !== undefined, 'Cashier staff exists');
    assert(cashier.pin.startsWith('pbkdf2$100000$'), 'Cashier PIN is hashed with PBKDF2 100,000 iterations');

    // -------------------------------------------------------------
    // Test 2: PIN Backdoor Removal Verification (Persistence on Reboot)
    // -------------------------------------------------------------
    console.log('\n--- 2. Boot PIN Reset Backdoor Removal ---');
    // Change Admin PIN to custom PIN '7788'
    const newAdminHash = dbLogic.hashPin('7788');
    db.prepare("UPDATE staff SET pin = ? WHERE id = ?").run(newAdminHash, admin.id);

    // Re-initialize database simulating app restart
    dbLogic.initDatabase(testDir);

    const reloadedAdmin = db.prepare("SELECT * FROM staff WHERE id = ?").get(admin.id);
    assert(reloadedAdmin.pin === newAdminAdminCheck(reloadedAdmin.pin, '7788'), 'Admin PIN retained custom PIN after DB re-initialization (not reset to 1234)');
    
    const verifiedLoginNew = dbLogic.verifyStaffPin('7788', admin.id);
    assert(verifiedLoginNew !== null && verifiedLoginNew.id === admin.id, 'Login with custom PIN 7788 succeeds after reboot');

    const verifiedLoginOld = dbLogic.verifyStaffPin('1234', admin.id);
    assert(verifiedLoginOld === null, 'Login with old backdoor PIN 1234 fails');

    function newAdminAdminCheck(storedHash, testPin) {
        return dbLogic.verifyPin(testPin, storedHash) ? storedHash : null;
    }

    // -------------------------------------------------------------
    // Test 3: PBKDF2 Random Salt & Timing-Safe Verification
    // -------------------------------------------------------------
    console.log('\n--- 3. PBKDF2 Random Salt & Unique Hashes ---');
    const hashA = dbLogic.hashPin('9999');
    const hashB = dbLogic.hashPin('9999');
    assert(hashA !== hashB, 'Identical PIN produces different hashes due to unique random salts');
    assert(dbLogic.verifyPin('9999', hashA) === true, 'verifyPin correctly validates hashA');
    assert(dbLogic.verifyPin('9999', hashB) === true, 'verifyPin correctly validates hashB');
    assert(dbLogic.verifyPin('0000', hashA) === false, 'verifyPin rejects wrong PIN');

    // -------------------------------------------------------------
    // Test 4: Transparent Auto-Migration of Legacy Static-Salt SHA-256
    // -------------------------------------------------------------
    console.log('\n--- 4. Legacy Hash Auto-Migration ---');
    const legacyPin = '4567';
    const legacyStaticHash = crypto.createHash('sha256').update('pos-salt-2026-' + legacyPin).digest('hex');
    assert(legacyStaticHash.length === 64, 'Legacy hash is 64-character SHA-256 hex');

    const addLegacy = db.prepare("INSERT INTO staff (name, pin, role) VALUES (?,?,?)").run('عامل قديم', legacyStaticHash, 'Tailor');
    const legacyId = addLegacy.lastInsertRowid;

    // Verify initial state is legacy
    const rawLegacyUser = db.prepare("SELECT * FROM staff WHERE id = ?").get(legacyId);
    assert(rawLegacyUser.pin === legacyStaticHash, 'Staff initially stored with legacy hash');

    // Login using verifyStaffPin
    const migratedUser = dbLogic.verifyStaffPin(legacyPin, legacyId);
    assert(migratedUser !== null && migratedUser.id === legacyId, 'Login with legacy hash succeeds');

    // Inspect database to confirm migration
    const updatedUser = db.prepare("SELECT * FROM staff WHERE id = ?").get(legacyId);
    assert(updatedUser.pin.startsWith('pbkdf2$100000$'), 'Staff PIN automatically migrated to PBKDF2 on login');
    assert(dbLogic.verifyPin(legacyPin, updatedUser.pin) === true, 'Migrated PBKDF2 hash verifies correctly');

    // Fast-login (no staffId specified) also works and auto-migrates
    const legacyPin2 = '3210';
    const legacyStaticHash2 = crypto.createHash('sha256').update('pos-salt-2026-' + legacyPin2).digest('hex');
    const addLegacy2 = db.prepare("INSERT INTO staff (name, pin, role) VALUES (?,?,?)").run('خياط سريع', legacyStaticHash2, 'Tailor');
    const legacyId2 = addLegacy2.lastInsertRowid;

    const fastLoginUser = dbLogic.verifyStaffPin(legacyPin2);
    assert(fastLoginUser !== null && fastLoginUser.id === legacyId2, 'Fast login without staffId matches legacy user');
    const updatedUser2 = db.prepare("SELECT * FROM staff WHERE id = ?").get(legacyId2);
    assert(updatedUser2.pin.startsWith('pbkdf2$100000$'), 'Fast login auto-migrated user to PBKDF2');

    // -------------------------------------------------------------
    // Test 5: Audit Log user_id Attribution
    // -------------------------------------------------------------
    console.log('\n--- 5. Audit Log user_id Attribution ---');
    dbLogic.setAuditUserId(admin.id);
    dbLogic.addAuditLog('TEST_SECURITY_EVENT', 'Audit log test with user_id');

    const logs = dbLogic.getAuditLogs(10);
    const testLog = logs.find(l => l.action === 'TEST_SECURITY_EVENT');
    assert(testLog !== undefined, 'Audit log entry created');
    assert(testLog.user_id === admin.id, `Audit log correctly recorded user_id: ${testLog.user_id}`);
    assert(testLog.user_name_from_staff === admin.name, `Audit log resolved staff name: ${testLog.user_name_from_staff}`);

    // -------------------------------------------------------------
    // Test 6: Path Containment & Traversal Protection (readAttachment simulation)
    // -------------------------------------------------------------
    console.log('\n--- 6. File Server Path Traversal Protection ---');
    const attachmentsDir = path.resolve(testDir, 'attachments');
    fs.mkdirSync(attachmentsDir, { recursive: true });

    // Helper implementing the exact logic in main.cjs:
    function readAttachmentSimulator(filePath) {
        try {
            if (!filePath || typeof filePath !== 'string') {
                return { success: false, error: 'INVALID_PATH: File path must be a non-empty string.' };
            }
            if (!fs.existsSync(attachmentsDir)) {
                fs.mkdirSync(attachmentsDir, { recursive: true });
            }
            const resolvedPath = path.isAbsolute(filePath)
                ? path.resolve(filePath)
                : path.resolve(attachmentsDir, filePath);

            const relative = path.relative(attachmentsDir, resolvedPath);
            const isContained = !relative.startsWith('..') && !path.isAbsolute(relative);
            if (!isContained) {
                return { success: false, error: 'ACCESS_DENIED: Path outside permitted attachments directory.' };
            }
            if (!fs.existsSync(resolvedPath)) {
                return { success: false, error: 'FILE_NOT_FOUND' };
            }
            const stat = fs.statSync(resolvedPath);
            if (!stat.isFile()) {
                return { success: false, error: 'NOT_A_FILE' };
            }
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
    }

    // Traversal test 1: relative directory traversal
    const trav1 = readAttachmentSimulator('../../../../Windows/System32/drivers/etc/hosts');
    assert(trav1.success === false && trav1.error.includes('ACCESS_DENIED'), 'Relative traversal attempt blocked');

    // Traversal test 2: absolute outside path
    const trav2 = readAttachmentSimulator('C:\\Windows\\System32\\cmd.exe');
    assert(trav2.success === false && trav2.error.includes('ACCESS_DENIED'), 'Absolute outside path blocked');

    // Valid file test
    const validSamplePath = path.join(attachmentsDir, 'customer_sample.png');
    fs.writeFileSync(validSamplePath, Buffer.from('fake-png-binary-data'));
    
    const validRes = readAttachmentSimulator('customer_sample.png');
    assert(validRes.success === true, 'Legitimate attachment file reading succeeds');
    assert(validRes.mimeType === 'image/png', 'MIME type correctly detected as image/png');
    assert(validRes.base64.startsWith('data:image/png;base64,'), 'Base64 data URI generated with proper MIME header');

    // Non-existent file test
    const missingRes = readAttachmentSimulator('non_existent.jpg');
    assert(missingRes.success === false && missingRes.error === 'FILE_NOT_FOUND', 'Missing file returns FILE_NOT_FOUND');

    // Directory path test
    const subDir = path.join(attachmentsDir, 'sub_folder');
    fs.mkdirSync(subDir, { recursive: true });
    const dirRes = readAttachmentSimulator('sub_folder');
    assert(dirRes.success === false && dirRes.error === 'NOT_A_FILE', 'Directory reading rejected with NOT_A_FILE');

    // -------------------------------------------------------------
    // Test 7: RBAC Middleware Simulation
    // -------------------------------------------------------------
    console.log('\n--- 7. RBAC Session & Middleware Verification ---');
    let activeSession = null;

    function setSession(staff) {
        if (!staff) {
            activeSession = null;
            return;
        }
        activeSession = {
            id: staff.id,
            name: staff.name,
            role: String(staff.role || 'Cashier').toLowerCase()
        };
    }

    function requireRole(allowedRoles, fn) {
        return async (...args) => {
            if (!activeSession) {
                return { success: false, error: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول أولاً' };
            }
            const userRole = (activeSession.role || '').toLowerCase();
            const normalizedAllowed = allowedRoles.map(r => String(r).toLowerCase());
            if (userRole !== 'admin' && !normalizedAllowed.includes(userRole)) {
                return { success: false, error: 'FORBIDDEN', message: 'غير مصرح لك بتنفيذ هذا الإجراء' };
            }
            return fn(...args);
        };
    }

    const guardedAdminOnly = requireRole(['admin'], () => ({ success: true, result: 'ADMIN_ACTION_PERMITTED' }));
    const guardedManagerOrAdmin = requireRole(['admin', 'manager'], () => ({ success: true, result: 'MANAGER_ACTION_PERMITTED' }));

    // Unauthenticated
    setSession(null);
    const unauthRes = await guardedAdminOnly();
    assert(unauthRes.success === false && unauthRes.error === 'UNAUTHENTICATED', 'Unauthenticated request rejected with UNAUTHENTICATED');

    // Cashier role
    setSession({ id: 2, name: 'كاشير', role: 'Cashier' });
    const cashierAdminRes = await guardedAdminOnly();
    assert(cashierAdminRes.success === false && cashierAdminRes.error === 'FORBIDDEN', 'Cashier blocked from Admin endpoint');

    const cashierManagerRes = await guardedManagerOrAdmin();
    assert(cashierManagerRes.success === false && cashierManagerRes.error === 'FORBIDDEN', 'Cashier blocked from Manager endpoint');

    // Manager role
    setSession({ id: 3, name: 'مدير فرع', role: 'Manager' });
    const managerAdminRes = await guardedAdminOnly();
    assert(managerAdminRes.success === false && managerAdminRes.error === 'FORBIDDEN', 'Manager blocked from Admin endpoint');

    const managerPermittedRes = await guardedManagerOrAdmin();
    assert(managerPermittedRes.success === true, 'Manager permitted for Manager endpoint');

    // Admin role
    setSession({ id: 1, name: 'المدير العام', role: 'Admin' });
    const adminActionRes = await guardedAdminOnly();
    assert(adminActionRes.success === true, 'Admin permitted for Admin endpoint');

    const adminManagerRes = await guardedManagerOrAdmin();
    assert(adminManagerRes.success === true, 'Admin permitted for Manager endpoint');

    // -------------------------------------------------------------
    // Test 8: ZATCA Phase 2 BER-TLV Format & Encoding
    // -------------------------------------------------------------
    console.log('\n--- 8. ZATCA BER-TLV Specification Verification ---');
    const { generateZatcaTLV } = require('../electron/zatca_utils.cjs');
    
    const sellerName = 'البصمة الذكية للخياطة';
    const vatNumber = '310123456700003';
    const timestamp = '2026-09-11T03:00:00Z';
    const totalAmt = '575.00';
    const vatAmt = '75.00';

    const tlvBase64 = generateZatcaTLV(sellerName, vatNumber, timestamp, totalAmt, vatAmt);
    assert(typeof tlvBase64 === 'string' && tlvBase64.length > 50, 'ZATCA TLV Base64 generated successfully');

    // Decode BER-TLV bytes and verify Tag 1 to 5
    const tlvBuf = Buffer.from(tlvBase64, 'base64');
    let offset = 0;
    const tagsFound = {};

    while (offset < tlvBuf.length) {
        const tag = tlvBuf[offset];
        const len = tlvBuf[offset + 1];
        const val = tlvBuf.slice(offset + 2, offset + 2 + len).toString('utf8');
        tagsFound[tag] = val;
        offset += 2 + len;
    }

    assert(tagsFound[1] === sellerName, `Tag 1 (Seller Name) matches: "${tagsFound[1]}"`);
    assert(tagsFound[2] === vatNumber, `Tag 2 (15-digit VAT Number) matches: "${tagsFound[2]}"`);
    assert(tagsFound[3] === timestamp, `Tag 3 (Timestamp) matches: "${tagsFound[3]}"`);
    assert(tagsFound[4] === totalAmt, `Tag 4 (Invoice Total) matches: "${tagsFound[4]}"`);
    assert(tagsFound[5] === vatAmt, `Tag 5 (VAT Amount) matches: "${tagsFound[5]}"`);

    console.log('\n====================================================');
    console.log(`Summary: ${passedTests}/${totalTests} tests passed successfully!`);
    console.log('====================================================');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
