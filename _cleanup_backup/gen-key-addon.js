// gen-key-addon.js — البصمة الذكية Add-on Key Generator v4A
// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//   node gen-key-addon.js <HWID> <billing> <tier> <addons>
//
// Billing : monthly | yearly | lifetime
// Tier    : starter | growth | pro | enterprise   (base tier)
// Addons  : comma-separated list: restaurant,finance,sync  (any combo)
//
// Examples:
//   node gen-key-addon.js "UUID-1234" monthly  starter  restaurant
//   node gen-key-addon.js "UUID-1234" yearly   growth   restaurant,finance
//   node gen-key-addon.js "UUID-1234" lifetime starter  restaurant,finance,sync
//   node gen-key-addon.js "UUID-1234" monthly  growth   sync
//
// KEY FORMAT v4A (19 chars):
//   A[BILLING:1][TIER:1][R:1][F:1][Y:1][EXP_B36:3][HWID_FP:4][SIG:6]
//   where R='R'|'N', F='F'|'N', Y='Y'|'N'
//
// IMPORTANT: Keep the SECRET offline. Never ship in the packaged app.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const {
  BILLING_CODES_REVERSE, TIER_CODES_REVERSE,
  EXPIRY_DAYS, PLAN_NAMES_AR, TIER_NAMES_AR, ADDON_NAMES_AR
} = require('./electron/license_plans.cjs');

const SECRET = 'b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b';
const EPOCH  = new Date('2025-01-01').getTime();

function hwidFingerprintV4(hwid) {
  const h = crypto.createHmac('sha256', SECRET).update('HWID-FP-V4:' + hwid).digest('hex');
  return parseInt(h.slice(0, 8), 16).toString(36).toUpperCase().slice(-4).padStart(4, '0');
}

// ── Help ─────────────────────────────────────────────────────────────────────
if (process.argv[2] === '--help' || process.argv[2] === '-h' || !process.argv[2]) {
  console.log(`
البصمة الذكية — مولّد مفاتيح الإضافات v4A
==========================================
الاستخدام:
  node gen-key-addon.js <HWID> <billing> <tier> <addons>

Billing (نوع الاشتراك):
  monthly   → شهري  (31 يوماً)
  yearly    → سنوي  (366 يوماً)
  lifetime  → مدى الحياة

Tier (الباقة الأساسية للعميل):
  starter    → الأساسي
  growth     → النمو
  pro        → الاحترافي
  enterprise → المؤسسي

Addons (الإضافات — مفصولة بفاصلة):
  restaurant → إدارة المطعم والطاولات وKDS
  finance    → المحاسبة المتكاملة (FinanceHub)
  sync       → مزامنة الفروع المتعددة

أمثلة:
  node gen-key-addon.js "UUID-1234" monthly  starter  restaurant
  node gen-key-addon.js "UUID-1234" yearly   growth   restaurant,finance
  node gen-key-addon.js "UUID-1234" lifetime starter  restaurant,finance,sync
  node gen-key-addon.js "UUID-1234" monthly  growth   sync
`);
  process.exit(0);
}

// ── Parse args ────────────────────────────────────────────────────────────────
const hwid      = process.argv[2];
const billing   = process.argv[3] || 'monthly';
const tier      = process.argv[4] || 'starter';
const addonsArg = (process.argv[5] || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

if (!hwid) {
  console.error('\n❌  خطأ: يجب توفير HWID.\nاستخدم: node gen-key-addon.js --help\n');
  process.exit(1);
}

const billingCode = BILLING_CODES_REVERSE[billing];
const tierCode    = TIER_CODES_REVERSE[tier];

if (!billingCode || ['0', '9'].includes(billingCode)) {
  console.error(`\n❌  نوع اشتراك غير مسموح لمفاتيح الإضافات: "${billing}"`);
  console.error('الأنواع المتاحة: monthly | yearly | lifetime\n');
  process.exit(1);
}

if (!tierCode) {
  console.error(`\n❌  باقة غير معروفة: "${tier}"`);
  console.error('الباقات المتاحة: starter | growth | pro | enterprise\n');
  process.exit(1);
}

const VALID_ADDONS = ['restaurant', 'finance', 'sync'];
const invalidAddons = addonsArg.filter(a => !VALID_ADDONS.includes(a));
if (invalidAddons.length) {
  console.error(`\n❌  إضافات غير معروفة: ${invalidAddons.join(', ')}`);
  console.error('الإضافات المتاحة: restaurant | finance | sync\n');
  process.exit(1);
}
if (!addonsArg.length) {
  console.error('\n❌  يجب تحديد إضافة واحدة على الأقل.');
  console.error('مثال: node gen-key-addon.js <HWID> monthly starter restaurant\n');
  process.exit(1);
}

// ── Build key ─────────────────────────────────────────────────────────────────
const restaurantFlg = addonsArg.includes('restaurant') ? 'R' : 'N';
const financeFlg    = addonsArg.includes('finance')    ? 'F' : 'N';
const syncFlg       = addonsArg.includes('sync')       ? 'Y' : 'N';

const daysToAdd = EXPIRY_DAYS[billing] || 31;
const expiryTs  = daysToAdd === 0 ? 0 : Date.now() + daysToAdd * 86400000;
const daysSince = expiryTs === 0 ? 0 : Math.floor((expiryTs - EPOCH) / 86400000);
const expiryB36 = daysSince.toString(36).toUpperCase().padStart(3, '0');
const fp        = hwidFingerprintV4(hwid);

// SIG covers all flag positions — any field tamper invalidates the key
const payload = `${hwid}|${billingCode}|${tierCode}|${restaurantFlg}|${financeFlg}|${syncFlg}|${daysSince}|${fp}|V4A`;
const sigHex  = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
const sig     = parseInt(sigHex.slice(0, 10), 16).toString(36).toUpperCase().slice(-6).padStart(6, '0');

// Final key: 'A' + billingCode(1) + tierCode(1) + R/N + F/N + Y/N + expiryB36(3) + fp(4) + sig(6) = 19 chars
const finalKey = `A${billingCode}${tierCode}${restaurantFlg}${financeFlg}${syncFlg}${expiryB36}${fp}${sig}`;

if (finalKey.length !== 19) {
  console.error(`\n❌  خطأ داخلي: طول المفتاح ${finalKey.length} بدلاً من 19\n`);
  process.exit(1);
}

// ── Print results ─────────────────────────────────────────────────────────────
const expiryStr   = expiryTs === 0 ? 'لا تنتهي أبداً (مدى الحياة)' : new Date(expiryTs).toLocaleDateString('ar-SA');
const billingName = PLAN_NAMES_AR[billing] || billing;
const tierName    = TIER_NAMES_AR[tier]    || tier;
const addonLabels = addonsArg.map(a => (ADDON_NAMES_AR && ADDON_NAMES_AR[a]) || a);

console.log('\n====================================================');
console.log('  البصمة الذكية — مولّد مفاتيح الإضافات v4A');
console.log('====================================================');
console.log('HWID          :', hwid);
console.log('Billing       :', billingName, `(${billing})`);
console.log('Base Tier     :', tierName, `(${tier})`);
console.log('Expiry        :', expiryStr);
console.log('HWID FP       :', fp, '(embedded)');
console.log('----------------------------------------------------');
console.log('Add-on Key    :', finalKey);
console.log('====================================================');
console.log('📦  الإضافات المفعّلة:');
addonLabels.forEach(l => console.log('     ✓', l));
console.log();
console.log('📋  هذا المفتاح يعمل فقط على الجهاز:', hwid);
console.log('⚠️  العميل يحتفظ بمفتاح الباقة الأساسية — هذا مفتاح إضافي.');
console.log('    فرمات المفتاح: v4A (19 حرف) — يبدأ بـ A');
console.log();
