#!/usr/bin/env node
'use strict';
/**
 * gen-key-v6.js — Offline V6 base key generator (with entropy salt)
 * Lives in project root ONLY. Excluded from packaged app via .gitignore / files[] in package.json.
 * NEVER ships inside the built Electron binary.
 *
 * Usage:
 *   node gen-key-v6.js starter lifetime
 *   node gen-key-v6.js growth lifetime
 *   node gen-key-v6.js pro monthly
 *   node gen-key-v6.js pro yearly
 *   node gen-key-v6.js pro lifetime
 *   node gen-key-v6.js enterprise monthly
 *   node gen-key-v6.js enterprise yearly
 *   node gen-key-v6.js trial
 *   node gen-key-v6.js --owner
 *   node gen-key-v6.js --list
 */

const crypto = require('crypto');

// ── SECRET — must match _LICENSE_SECRET in electron/main.cjs ──────────────────
const SECRET = 'b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b';

// ── Key structure constants ───────────────────────────────────────────────────
const TIER_MAP = {
  starter:    'S',
  growth:     'G',
  pro:        'P',
  enterprise: 'E',
  owner:      'O',
  trial:      'X',
};

const BILLING_MAP = {
  lifetime: 'L',
  monthly:  'M',
  yearly:   'Y',
  trial:    'T',
  owner:    'O',
};

const DURATION_MAP = {
  trial:    7,
  monthly:  31,
  yearly:   366,
  lifetime: 0,
  owner:    0,
};

// Valid (tier, billing) combinations per spec section 2.2
const VALID_COMBOS = [
  ['starter',    'lifetime'],
  ['growth',     'lifetime'],
  ['pro',        'monthly'],
  ['pro',        'yearly'],
  ['pro',        'lifetime'],
  ['enterprise', 'monthly'],
  ['enterprise', 'yearly'],
  ['trial',      'trial'],
  ['owner',      'owner'],
];

/**
 * Encode a duration in days to a 3-char base-36 zero-padded string.
 * 0 days → "000"  (lifetime / owner)
 * 7 days → "007"  (trial)
 * 31 days → "01V" (monthly)
 * 366 days → "06E" (yearly)
 */
function encodeDuration(days) {
  return days.toString(36).toUpperCase().padStart(3, '0');
}

/**
 * Generate a random 2-char base-36 string (salt).
 */
function generateSalt() {
  const bytes = crypto.randomBytes(2);
  const num = bytes.readUInt16BE(0);
  return num.toString(36).toUpperCase().padStart(2, '0').slice(-2);
}

/**
 * Compute the 7-char base-36 SIG for a V6 base key.
 * payload: "V6|<TIER_CODE>|<BILLING_CODE>|<DURATION_B36>|<SALT>"
 */
function computeSig(tierCode, billingCode, durationB36, salt) {
  const payload = `V6|${tierCode}|${billingCode}|${durationB36}|${salt}`;
  const raw     = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const num     = BigInt('0x' + raw.slice(0, 20));
  return num.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

/**
 * Build a 16-char V6 base key.
 */
function buildKey(tier, billing) {
  const tierCode    = TIER_MAP[tier];
  const billingCode = BILLING_MAP[billing];
  const days        = DURATION_MAP[billing];
  const durationB36 = encodeDuration(days);
  const salt        = generateSalt();
  const sig         = computeSig(tierCode, billingCode, durationB36, salt);
  const key         = `V6${tierCode}${billingCode}${durationB36}${salt}${sig}`;
  if (key.length !== 16) {
    throw new Error(`Key length mismatch: expected 16, got ${key.length} for "${key}"`);
  }
  return key;
}

/**
 * Compute human-readable expiry note.
 */
function expiryNote(billing) {
  switch (billing) {
    case 'lifetime': return 'مدى الحياة (لا تنتهي)';
    case 'owner':    return 'مالك (لا تنتهي)';
    case 'monthly':  return '31 يوماً من تاريخ التنشيط';
    case 'yearly':   return '366 يوماً من تاريخ التنشيط';
    case 'trial':    return '7 أيام من تاريخ التنشيط';
    default:         return '—';
  }
}

/**
 * Print a formatted table of all 9 base keys (V6 randomizes on each call).
 */
function printList() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log(' V6 BASE KEY CATALOGUE (Randomized) — جدول المفاتيح الأساسية (عشوائي)');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(
    ' ' + 'المفتاح (Key)'.padEnd(18) +
    'الباقة (Tier)'.padEnd(20) +
    'دورة الفوترة (Billing)'.padEnd(20) +
    'الانتهاء (Expiry)'
  );
  console.log('─'.repeat(75));

  const rows = [
    ['starter',    'lifetime'],
    ['growth',     'lifetime'],
    ['pro',        'monthly'],
    ['pro',        'yearly'],
    ['pro',        'lifetime'],
    ['enterprise', 'monthly'],
    ['enterprise', 'yearly'],
    ['trial',      'trial'],
    ['owner',      'owner'],
  ];

  for (const [tier, billing] of rows) {
    const key   = buildKey(tier, billing);
    const label = tier.charAt(0).toUpperCase() + tier.slice(1);
    const bill  = billing.charAt(0).toUpperCase() + billing.slice(1);
    console.log(
      ' ' + key.padEnd(18) +
      label.padEnd(20) +
      bill.padEnd(20) +
      expiryNote(billing)
    );
  }

  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  console.log(' ⚠️  احتفظ بهذه المفاتيح بشكل آمن. كل استدعاء يولد مفاتيح جديدة.');
  console.log(' ⚠️  هذا الملف مستثنى من الحزمة المُصدَّرة. لا يظهر للعملاء.\n');
}

/**
 * Print a single key with details.
 */
function printSingle(tier, billing) {
  const key = buildKey(tier, billing);
  console.log('\n─────────────────────────────────────────────');
  console.log(` الباقة    : ${tier.charAt(0).toUpperCase() + tier.slice(1)}`);
  console.log(` الفوترة   : ${billing.charAt(0).toUpperCase() + billing.slice(1)}`);
  console.log(` المفتاح   : ${key}`);
  console.log(` الطول     : ${key.length} حرف (يجب أن يكون 16)`);
  console.log(` الانتهاء  : ${expiryNote(billing)}`);
  console.log('─────────────────────────────────────────────\n');
}

// ── CLI entry point ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === '--list') {
  printList();
  process.exit(0);
}

if (args[0] === '--owner') {
  printSingle('owner', 'owner');
  process.exit(0);
}

// Normalize: "trial" alone (no billing arg)
if (args[0] === 'trial' && !args[1]) {
  args[1] = 'trial';
}

const tierArg    = (args[0] || '').toLowerCase();
const billingArg = (args[1] || '').toLowerCase();

if (!TIER_MAP[tierArg]) {
  console.error(`\n❌ خطأ: الباقة غير معروفة "${tierArg}"`);
  console.error('   القيم المتاحة: starter | growth | pro | enterprise | trial | owner\n');
  process.exit(1);
}

if (!BILLING_MAP[billingArg]) {
  console.error(`\n❌ خطأ: دورة الفوترة غير معروفة "${billingArg}"`);
  console.error('   القيم المتاحة: lifetime | monthly | yearly | trial | owner\n');
  process.exit(1);
}

// Validate combo
const isValid = VALID_COMBOS.some(([t, b]) => t === tierArg && b === billingArg);
if (!isValid) {
  console.error(`\n❌ مجموعة غير صالحة: "${tierArg}" + "${billingArg}"`);
  console.error('   استخدم --list لمعرفة المجموعات المسموح بها.\n');
  process.exit(1);
}

printSingle(tierArg, billingArg);
