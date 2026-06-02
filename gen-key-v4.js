// gen-key-v4.js — البصمة الذكية POS License Generator v4
// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//   node gen-key-v4.js <HWID> <billing> <tier>   → Client key (HWID-bound)
//   node gen-key-v4.js --owner                   → Owner master key
//   node gen-key-v4.js --help                    → Show usage
//
// Billing: trial | monthly | yearly | lifetime
// Tier:    starter | growth | pro | enterprise
//
// Examples:
//   node gen-key-v4.js ABCD-1234-EFGH-5678 monthly growth
//   node gen-key-v4.js ABCD-1234-EFGH-5678 lifetime starter
//   node gen-key-v4.js ABCD-1234-EFGH-5678 yearly pro
//   node gen-key-v4.js --owner
//
// KEY FORMAT v4 (16 chars):
//   [BILLING:1][TIER:1][EXP_B36:3][HWID_FP:4][SIG:7]
//
// SECURITY:
//   - SECRET never ships in the app (validation is in electron/main.cjs only)
//   - Each key is bound to a specific HWID fingerprint
//   - SIG covers hwid|billing|tier|daysSince|fp — any field change invalidates
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const { BILLING_CODES_REVERSE, TIER_CODES_REVERSE, EXPIRY_DAYS, PLAN_NAMES_AR, TIER_NAMES_AR } = require('./electron/license_plans.cjs');

// ── IMPORTANT: Keep this secret offline. Never ship in the packaged app. ─────
const SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b";
const EPOCH  = new Date('2025-01-01').getTime();
const KEY_VERSION = 4;

// ── Derive 4-char HWID fingerprint ───────────────────────────────────────────
function hwidFingerprint(hwid) {
  const h = crypto.createHmac('sha256', SECRET).update('HWID-FP-V4:' + hwid).digest('hex');
  return parseInt(h.slice(0, 8), 16).toString(36).toUpperCase().slice(-4).padStart(4, '0');
}

// ── Help text ─────────────────────────────────────────────────────────────────
if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(`
البصمة الذكية — مولّد مفاتيح الترخيص v4
=========================================
الاستخدام:
  node gen-key-v4.js <HWID> <billing> <tier>
  node gen-key-v4.js --owner

Billing (نوع الاشتراك):
  trial     → تجريبي 30 يوماً (كل الميزات مفعّلة للتقييم)
  monthly   → شهري
  yearly    → سنوي
  lifetime  → مدى الحياة (دفعة واحدة)

Tier (باقة الميزات):
  starter    → المبتدئ  (POS + ZATCA Phase 1 فقط)
  growth     → النمو    (+ ZATCA Phase 2 + CRM + تقارير)
  pro        → الاحترافي (+ محاسبة كاملة + مطعم)
  enterprise → المؤسسي  (+ متعدد الفروع + white-label)

أمثلة:
  node gen-key-v4.js "UUID-1234-5678" monthly starter
  node gen-key-v4.js "UUID-1234-5678" yearly growth
  node gen-key-v4.js "UUID-1234-5678" lifetime pro
  node gen-key-v4.js "UUID-1234-5678" monthly enterprise
  node gen-key-v4.js --owner
`);
  process.exit(0);
}

// ── Owner master key ──────────────────────────────────────────────────────────
if (process.argv[2] === '--owner') {
  const phrase   = "OWNER-MASTER-2026-V4";
  const sigHex   = crypto.createHmac('sha256', SECRET).update(phrase).digest('hex');
  const sig      = parseInt(sigHex.slice(0, 10), 16).toString(36).toUpperCase().slice(-6).padStart(6, '0');
  // Format: 9E000[0000][SIG6] = 12 chars (owner has no HWID binding)
  // We still keep 16 chars for consistency: 9E0000000[SIG7]
  const ownerKey = `9E000${sig.padStart(7, '0')}`.slice(0, 16);
  console.log('\n====================================================');
  console.log('   البصمة الذكية — مفتاح المطوّر / المالك v4');
  console.log('====================================================');
  console.log('Owner Key  :', ownerKey);
  console.log('Valid On   : ANY machine');
  console.log('Expiry     : Never');
  console.log('Tier       : All features (Enterprise)');
  console.log('====================================================');
  console.log('⚠  احتفظ بهذا المفتاح سرياً. لا تشاركه مع العملاء.\n');
  process.exit(0);
}

// ── Client key ───────────────────────────────────────────────────────────────
const hwid    = process.argv[2];
const billing = process.argv[3] || 'monthly';
const tier    = process.argv[4] || 'starter';

if (!hwid) {
  console.error('\n❌  خطأ: يجب توفير HWID.');
  console.error('الاستخدام: node gen-key-v4.js <HWID> <billing> <tier>');
  console.error('أو:        node gen-key-v4.js --help\n');
  process.exit(1);
}

const billingCode = BILLING_CODES_REVERSE[billing];
const tierCode    = tier === 'trial' ? 'X' : TIER_CODES_REVERSE[tier];

if (!billingCode) {
  console.error(`\n❌  نوع اشتراك غير معروف: "${billing}"`);
  console.error('الأنواع المتاحة: trial | monthly | yearly | lifetime\n');
  process.exit(1);
}

if (!tierCode) {
  console.error(`\n❌  باقة غير معروفة: "${tier}"`);
  console.error('الباقات المتاحة: starter | growth | pro | enterprise\n');
  process.exit(1);
}

// For trial billing, always use tier X (full features for evaluation)
const effectiveTierCode = billing === 'trial' ? 'X' : tierCode;

const daysToAdd  = EXPIRY_DAYS[billing] || 31;
const expiryTs   = daysToAdd === 0 ? 0 : Date.now() + daysToAdd * 86400000;
const daysSince  = expiryTs === 0 ? 0 : Math.floor((expiryTs - EPOCH) / 86400000);
const expiryB36  = daysSince.toString(36).toUpperCase().padStart(3, '0');
const fp         = hwidFingerprint(hwid);

// SIG covers all meaningful fields to prevent any tampering
const payload = `${hwid}|${billingCode}|${effectiveTierCode}|${daysSince}|${fp}|V4`;
const sigHex  = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
const sig     = parseInt(sigHex.slice(0, 12), 16).toString(36).toUpperCase().slice(-7).padStart(7, '0');

// Final key: 16 chars
const finalKey = `${billingCode}${effectiveTierCode}${expiryB36}${fp}${sig}`;

if (finalKey.length !== 16) {
  console.error(`\n❌  خطأ داخلي: طول المفتاح ${finalKey.length} بدلاً من 16\n`);
  process.exit(1);
}

const expiryStr   = expiryTs === 0 ? 'لا تنتهي أبداً (مدى الحياة)' : new Date(expiryTs).toLocaleDateString('ar-SA');
const billingName = PLAN_NAMES_AR[billing]   || billing;
const tierName    = TIER_NAMES_AR[tier]       || tier;
const tierNameEn  = tier.charAt(0).toUpperCase() + tier.slice(1);

console.log('\n====================================================');
console.log('   البصمة الذكية — مولّد المفاتيح v4 (HWID-Bound)');
console.log('====================================================');
console.log('HWID         :', hwid);
console.log('Billing      :', billingName, `(${billing})`);
console.log('Tier         :', tierName, `(${tierNameEn})`);
console.log('Expiry       :', expiryStr);
console.log('HWID FP      :', fp, '(embedded)');
console.log('----------------------------------------------------');
console.log('License Key  :', finalKey);
console.log('====================================================');
console.log('📋  هذا المفتاح يعمل فقط على الجهاز:', hwid);
console.log('📦  الباقة المفعّلة:', tierName, '—', billingName);
console.log();

// Show what's included and what's not
const tierFeatures = {
  starter:    ['✓ POS كامل', '✓ ZATCA Phase 1 (QR فقط)', '✓ مخزون أساسي', '✓ موظف واحد', '✗ ZATCA Phase 2', '✗ محاسبة', '✗ تقارير', '✗ مطعم'],
  growth:     ['✓ POS كامل', '✓ ZATCA Phase 1 + 2', '✓ تقارير + لوحة تحكم', '✓ CRM + ولاء', '✓ 5 موظفين', '✗ محاسبة كاملة', '✗ مطعم / KDS'],
  pro:        ['✓ كل ميزات النمو', '✓ محاسبة كاملة (P1+P2)', '✓ مطعم + KDS + طاولات', '✓ رواتب + أصول', '✓ موظفون غير محدودون'],
  enterprise: ['✓ كل ميزات الاحترافي', '✓ متعدد الفروع', '✓ White-label', '✓ SLA مضمون'],
};

const effectiveTier = billing === 'trial' ? 'pro' : tier; // trial shows Pro features
const features = tierFeatures[effectiveTier] || [];
if (features.length) {
  console.log('الميزات المفعّلة:');
  features.forEach(f => console.log('  ', f));
  console.log();
}
