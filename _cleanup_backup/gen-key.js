// gen-key.js — البصمة الذكية POS License Generator v3
// ─────────────────────────────────────────────────────────
// Usage:
//   node gen-key.js <HWID> <plan>     → Client key (HWID-bound, with expiry)
//   node gen-key.js --owner           → Owner master key (machine-independent, no expiry)
//
// Plans: trial | monthly | yearly | lifetime
//
// SECURITY NOTES (v3 changes):
//   - Key now embeds a 4-char HWID fingerprint in the payload that is verified on activation.
//     A key generated for HWID-A will be rejected on HWID-B.
//   - SECRET is never shipped to the renderer. Validation is moved to the main process (IPC).
//   - Legacy ALB- format support REMOVED from generator; validator rejects it (see SecurityGuard).

const crypto = require('crypto');

// ─── IMPORTANT ───────────────────────────────────────────
// This file runs ONLY on the vendor's machine to mint keys.
// The SECRET must NEVER be placed in any file that ships inside the app.
// In SecurityGuard.jsx the validation call is proxied to main.cjs via IPC.
// ─────────────────────────────────────────────────────────
const SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b"; // ← set a strong random value, keep offline
const EPOCH  = new Date('2025-01-01').getTime();

// ── Derive a short HWID fingerprint (4 base-36 chars) ────
// This is embedded in the key so the validator can confirm
// the key was minted for this specific hardware ID.
function hwidFingerprint(hwid) {
  const h = crypto.createHmac('sha256', SECRET).update('HWID-FP:' + hwid).digest('hex');
  return parseInt(h.slice(0, 8), 16).toString(36).toUpperCase().slice(-4).padStart(4, '0');
}

// ── Owner Master Key ──────────────────────────────────────
if (process.argv[2] === '--owner') {
    const phrase   = "OWNER-MASTER-2026-V3";
    const sigHex   = crypto.createHmac('sha256', SECRET).update(phrase).digest('hex');
    const sig      = parseInt(sigHex.slice(0, 8), 16).toString(36).toUpperCase().slice(-5).padStart(5, '0');
    const ownerKey = `OWNER${sig}`; // 10 chars
    console.log('\n====================================================');
    console.log('   البصمة الذكية — مفتاح وصول المطور/المالك         ');
    console.log('====================================================');
    console.log('Owner Key  :', ownerKey);
    console.log('Valid On   : ANY machine (no HWID binding)');
    console.log('Expiry     : Never');
    console.log('====================================================');
    console.log('⚠  Keep this key confidential. Do not share it.\n');
    process.exit(0);
}

// ── Client Key ────────────────────────────────────────────
const hwid = process.argv[2];
const plan = process.argv[3] || 'monthly';

if (!hwid) {
    console.log('\n❌  Error: Please provide an HWID.');
    console.log('Usage: node gen-key.js <HWID> <plan>');
    console.log('       node gen-key.js --owner');
    console.log('Plans: trial | monthly | yearly | lifetime\n');
    process.exit(1);
}

const planMap   = { trial: '0', monthly: '1', yearly: '2', lifetime: '3' };
const validPlans = Object.keys(planMap);
if (!validPlans.includes(plan)) {
    console.log(`\n❌  Unknown plan "${plan}". Use: trial | monthly | yearly | lifetime\n`);
    process.exit(1);
}

const expiryDays = { trial: 30, monthly: 31, yearly: 366, lifetime: 0 };
const planAr     = { trial: 'تجريبي (30 يوم)', monthly: 'شهري', yearly: 'سنوي', lifetime: 'مدى الحياة' };
const daysToAdd  = expiryDays[plan];
const expiryTs   = daysToAdd === 0 ? 0 : Date.now() + daysToAdd * 86400000;

// ── Key layout (14 chars) ─────────────────────────────────
// [PLAN:1][EXPIRY_B36:3][HWID_FP:4][SIG_B36:6] = 14 chars
// The HWID fingerprint means the key only validates on the correct machine.
const planCode  = planMap[plan];
const daysSince = expiryTs === 0 ? 0 : Math.floor((expiryTs - EPOCH) / 86400000);
const expiryB36 = daysSince.toString(36).toUpperCase().padStart(3, '0');
const fp        = hwidFingerprint(hwid); // 4-char HWID fingerprint embedded in key

// Signature covers hwid + plan + expiry + fingerprint — changing any field invalidates the key
const payload   = `${hwid}|${planCode}|${daysSince}|${fp}`;
const sigHex    = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
const sigB36    = parseInt(sigHex.slice(0, 10), 16).toString(36).toUpperCase().slice(-6).padStart(6, '0');

const finalKey  = `${planCode}${expiryB36}${fp}${sigB36}`; // 14 chars

const expiryStr = expiryTs === 0 ? 'لا تنتهي (مدى الحياة)' : new Date(expiryTs).toLocaleDateString('ar-SA');

console.log('\n====================================================');
console.log('   البصمة الذكية — مولد مفاتيح التنشيط v3 (HWID-Bound)');
console.log('====================================================');
console.log('Client HWID :', hwid);
console.log('Plan        :', planAr[plan]);
console.log('Expiry      :', expiryStr);
console.log('HWID FP     :', fp, '(embedded in key)');
console.log('----------------------------------------------------');
console.log('License Key :', finalKey);
console.log('====================================================');
console.log('Instructions: Provide this 14-char key to the client.');
console.log('              This key will ONLY activate on HWID:', hwid, '\n');
