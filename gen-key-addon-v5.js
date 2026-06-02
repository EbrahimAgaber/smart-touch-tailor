#!/usr/bin/env node
'use strict';
/**
 * gen-key-addon-v5.js — Offline V5 addon key generator
 * Lives in project root ONLY. Excluded from packaged app via .gitignore / files[] in package.json.
 * NEVER ships inside the built Electron binary.
 *
 * Usage:
 *   node gen-key-addon-v5.js restaurant lifetime
 *   node gen-key-addon-v5.js restaurant monthly
 *   node gen-key-addon-v5.js restaurant yearly
 *   node gen-key-addon-v5.js finance lifetime
 *   node gen-key-addon-v5.js finance monthly
 *   node gen-key-addon-v5.js finance yearly
 *   node gen-key-addon-v5.js zatca lifetime
 *   node gen-key-addon-v5.js zatca monthly
 *   node gen-key-addon-v5.js zatca yearly
 *   node gen-key-addon-v5.js sync monthly
 *   node gen-key-addon-v5.js sync yearly
 *   node gen-key-addon-v5.js whitelabel lifetime
 *   node gen-key-addon-v5.js --list
 */

const crypto = require('crypto');

// ── SECRET — must match _LICENSE_SECRET in electron/main.cjs ──────────────────
const SECRET = 'b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b';

// ── Addon code map ─────────────────────────────────────────────────────────────
const ADDON_MAP = {
  restaurant: 'R',
  finance:    'F',
  zatca:      'Z',
  sync:       'S',
  whitelabel: 'W',
};

const BILLING_MAP = {
  lifetime: 'L',
  monthly:  'M',
  yearly:   'Y',
};

const DURATION_MAP = {
  lifetime: 0,
  monthly:  31,
  yearly:   366,
};

// Valid (addon, billing) combinations per spec section 2.2
const VALID_COMBOS = [
  ['restaurant', 'lifetime'],
  ['restaurant', 'monthly'],
  ['restaurant', 'yearly'],
  ['finance',    'lifetime'],
  ['finance',    'monthly'],
  ['finance',    'yearly'],
  ['zatca',      'lifetime'],
  ['zatca',      'monthly'],
  ['zatca',      'yearly'],
  ['sync',       'monthly'],
  ['sync',       'yearly'],
  // NOTE: sync has NO lifetime — operational cost per spec 2.1
  ['whitelabel', 'lifetime'],
  // NOTE: whitelabel is lifetime only per spec 2.1
];

/**
 * Encode a duration in days to a 3-char base-36 zero-padded string.
 */
function encodeDuration(days) {
  return days.toString(36).toUpperCase().padStart(3, '0');
}

/**
 * Compute the 11-char base-36 SIG for an addon key.
 * payload: "VA|<ADDON_CODE>|<BILLING_CODE>|<DURATION_B36>"
 */
function computeAddonSig(addonCode, billingCode, durationB36) {
  const payload = `VA|${addonCode}|${billingCode}|${durationB36}`;
  const raw     = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const num     = BigInt('0x' + raw.slice(0, 20));
  return num.toString(36).toUpperCase().padStart(11, '0').slice(-11);
}

/**
 * Build an 18-char VA addon key.
 */
function buildAddonKey(addon, billing) {
  const addonCode   = ADDON_MAP[addon];
  const billingCode = BILLING_MAP[billing];
  const days        = DURATION_MAP[billing];
  const durationB36 = encodeDuration(days);
  const sig         = computeAddonSig(addonCode, billingCode, durationB36);
  const key         = `VA${addonCode}${billingCode}${durationB36}${sig}`;
  if (key.length !== 18) {
    throw new Error(`Addon key length mismatch: expected 18, got ${key.length} for "${key}"`);
  }
  return key;
}

/**
 * Human-readable addon name.
 */
function addonLabel(addon) {
  const labels = {
    restaurant: 'إدارة المطعم والطاولات',
    finance:    'المحاسبة المتكاملة (Finance Hub)',
    zatca:      'ZATCA المرحلة الثانية',
    sync:       'مزامنة الفروع المتعددة',
    whitelabel: 'White Label',
  };
  return labels[addon] || addon;
}

/**
 * Human-readable expiry note.
 */
function expiryNote(billing) {
  switch (billing) {
    case 'lifetime': return 'مدى الحياة (لا تنتهي)';
    case 'monthly':  return '31 يوماً من تاريخ التنشيط';
    case 'yearly':   return '366 يوماً من تاريخ التنشيط';
    default:         return '—';
  }
}

/**
 * Print the full 12-key catalogue.
 */
function printList() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════════');
  console.log(' VA ADDON KEY CATALOGUE — جدول مفاتيح الإضافات');
  console.log('═══════════════════════════════════════════════════════════════════════════════════');
  console.log(
    ' ' + 'المفتاح (Key)'.padEnd(20) +
    'الإضافة (Addon)'.padEnd(34) +
    'الفوترة'.padEnd(12) +
    'الانتهاء'
  );
  console.log('─'.repeat(83));

  for (const [addon, billing] of VALID_COMBOS) {
    const key   = buildAddonKey(addon, billing);
    const label = addonLabel(addon);
    const bill  = billing.charAt(0).toUpperCase() + billing.slice(1);
    console.log(
      ' ' + key.padEnd(20) +
      label.padEnd(34) +
      bill.padEnd(12) +
      expiryNote(billing)
    );
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════════\n');
  console.log(' ملاحظة: إضافة Sync لا تتوفر بنظام مدى الحياة (تكلفة تشغيلية مستمرة).');
  console.log(' ملاحظة: White Label متاحة بنظام مدى الحياة فقط (شراء لمرة واحدة).');
  console.log(' ⚠️  احتفظ بهذه المفاتيح بشكل آمن. هذا الملف مستثنى من الحزمة المُصدَّرة.\n');
}

/**
 * Print a single addon key with details.
 */
function printSingle(addon, billing) {
  const key = buildAddonKey(addon, billing);
  console.log('\n─────────────────────────────────────────────');
  console.log(` الإضافة   : ${addonLabel(addon)}`);
  console.log(` الفوترة   : ${billing.charAt(0).toUpperCase() + billing.slice(1)}`);
  console.log(` المفتاح   : ${key}`);
  console.log(` الطول     : ${key.length} حرف (يجب أن يكون 18)`);
  console.log(` الانتهاء  : ${expiryNote(billing)}`);
  console.log('─────────────────────────────────────────────\n');
}

// ── CLI entry point ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === '--list') {
  printList();
  process.exit(0);
}

const addonArg   = (args[0] || '').toLowerCase();
const billingArg = (args[1] || '').toLowerCase();

if (!ADDON_MAP[addonArg]) {
  console.error(`\n❌ خطأ: الإضافة غير معروفة "${addonArg}"`);
  console.error('   القيم المتاحة: restaurant | finance | zatca | sync | whitelabel\n');
  process.exit(1);
}

if (!BILLING_MAP[billingArg]) {
  console.error(`\n❌ خطأ: دورة الفوترة غير معروفة "${billingArg}"`);
  console.error('   القيم المتاحة: lifetime | monthly | yearly\n');
  process.exit(1);
}

const isValid = VALID_COMBOS.some(([a, b]) => a === addonArg && b === billingArg);
if (!isValid) {
  console.error(`\n❌ مجموعة غير صالحة: "${addonArg}" + "${billingArg}"`);
  if (addonArg === 'sync' && billingArg === 'lifetime') {
    console.error('   إضافة Sync لا تدعم مدى الحياة (تكلفة تشغيلية مستمرة).');
  }
  if (addonArg === 'whitelabel' && billingArg !== 'lifetime') {
    console.error('   White Label متاحة بنظام مدى الحياة فقط.');
  }
  console.error('   استخدم --list لمعرفة المجموعات المسموح بها.\n');
  process.exit(1);
}

printSingle(addonArg, billingArg);
