// license_plans.cjs — البصمة الذكية Single source of truth for subscription tiers
// ─────────────────────────────────────────────────────────────────────────────
// This file is imported by:
//   • electron/main.cjs  (validation + IPC)
//   • gen-key-v4.js      (key generation)
//
// NEVER import this from renderer code. All tier checks in the renderer
// go through window.api.checkLicense() → IPC → main process.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

// ── Billing cycle codes (position 0 of v4 key) ───────────────────────────────
const BILLING_CODES = {
  '0': 'trial',
  '1': 'monthly',
  '2': 'yearly',
  '3': 'lifetime',
  '9': 'owner',
};

const BILLING_CODES_REVERSE = Object.fromEntries(
  Object.entries(BILLING_CODES).map(([k, v]) => [v, k])
);

// ── Feature tier codes (position 1 of v4 key) ────────────────────────────────
const TIER_CODES = {
  'S': 'starter',
  'G': 'growth',
  'P': 'pro',
  'E': 'enterprise',
  'X': 'trial_full',   // trial gets all Pro features for evaluation
};

const TIER_CODES_REVERSE = Object.fromEntries(
  Object.entries(TIER_CODES).map(([k, v]) => [v, k])
);

// ── Expiry days by billing+tier ───────────────────────────────────────────────
// Used by key generator. 0 = no expiry (lifetime / owner).
const EXPIRY_DAYS = {
  trial:    7,
  monthly:  31,
  yearly:   366,
  lifetime: 0,
  owner:    0,
};

// ── Human-readable plan names (Arabic) ───────────────────────────────────────
const PLAN_NAMES_AR = {
  trial:     'تجريبي (7 أيام)',
  monthly:   'شهري',
  yearly:    'سنوي',
  lifetime:  'مدى الحياة',
  owner:     'مطوّر / مالك',
};

const TIER_NAMES_AR = {
  starter:    'الأساسي (Core)',
  growth:     'النمو (Growth)',
  pro:        'الاحترافي (Pro)',
  enterprise: 'المؤسسي (Enterprise)',
  trial_full: 'تجريبي كامل',
};

// ── Feature gates: which tiers can access each feature ───────────────────────
// Keys are used in FeatureGate.jsx and canAccess() in useLicenseStore.js.
// Values are arrays of TIER CODE chars (S, G, P, E, X) that have access.
// Owner plan always bypasses all gates.
const FEATURE_GATES = {
  // ── Available to ALL paid tiers ─────────────────────────────────────────
  'pos':                  ['S', 'G', 'P', 'E', 'X'],
  'pos.zatca_p1':         ['S', 'G', 'P', 'E', 'X'],  // 5 TLV tags + QR
  'stock.view':           ['S', 'G', 'P', 'E', 'X'],
  'stock.adjust':         ['S', 'G', 'P', 'E', 'X'],
  'shift':                ['S', 'G', 'P', 'E', 'X'],
  'printing':             ['S', 'G', 'P', 'E', 'X'],
  'services':             ['S', 'G', 'P', 'E', 'X'],
  'onboarding':           ['S', 'G', 'P', 'E', 'X'],
  'settings.identity':    ['S', 'G', 'P', 'E', 'X'],  // business name, logo, etc.
  'settings.invoice':     ['S', 'G', 'P', 'E', 'X'],  // receipt header/footer
  'settings.tax':         ['S', 'G', 'P', 'E', 'X'],  // VAT rate, currency
  'customer_display':     ['S', 'G', 'P', 'E', 'X'],

  // ── Growth (G) and above ─────────────────────────────────────────────────
  // NOTE: pos.zatca_p2 is intentionally NOT in the Growth tier.
  // It is a Pro+ base feature, or available to S/G as a paid add-on (zatca_p2 addon key).
  'pos.zatca_p2':         ['P', 'E', 'X'],   // Phase 2 digital signing — Pro+ base or zatca_p2 add-on
  'pos.held_orders':      ['G', 'P', 'E', 'X'],
  'pos.promotions':       ['G', 'P', 'E', 'X'],
  'pos.loyalty':          ['G', 'P', 'E', 'X'],
  'dashboard':            ['S', 'G', 'P', 'E', 'X'],
  'sales_history':        ['G', 'P', 'E', 'X'],
  'customers':            ['G', 'P', 'E', 'X'],
  'suppliers':            ['G', 'P', 'E', 'X'],
  'purchases':            ['G', 'P', 'E', 'X'],
  'expenditures':         ['G', 'P', 'E', 'X'],
  'promotions':           ['G', 'P', 'E', 'X'],
  'staff.multi':          ['G', 'P', 'E', 'X'],   // more than 1 staff account
  'export.csv':           ['G', 'P', 'E', 'X'],
  'export.pdf':           ['G', 'P', 'E', 'X'],
  'export.excel':         ['G', 'P', 'E', 'X'],
  'audit_logs':           ['G', 'P', 'E', 'X'],
  'menu_admin':           ['G', 'P', 'E', 'X'],   // product management / categories
  'stock.purchases':      ['G', 'P', 'E', 'X'],
  'vat_settings':         ['G', 'P', 'E', 'X'],
  'settings.zatca':       ['P', 'E', 'X'],   // ZATCA device onboarding tab — follows pos.zatca_p2

  // ── Pro (P) and above ─────────────────────────────────────────────────────
  'finance_hub':          ['P', 'E', 'X'],  // FinanceHub Phase 1 (P&L, BS, CF)
  'finance_hub_p2':       ['P', 'E', 'X'],  // FinanceHub Phase 2 (payroll, assets…)
  'finance_hub_p2.payroll':['P', 'E', 'X'],
  'finance_hub_p2.assets': ['P', 'E', 'X'],
  'finance_hub_p2.bank':   ['P', 'E', 'X'],
  'restaurant':           ['P', 'E', 'X'],
  'tables':               ['P', 'E', 'X'],
  'kds':                  ['P', 'E', 'X'],
  'audit_logs.enhanced':  ['P', 'E', 'X'],
  'break_even':           ['P', 'E', 'X'],
  'inventory_costing':    ['P', 'E', 'X'],
  'deferred_revenue':     ['P', 'E', 'X'],
  'gl_drilldown':         ['P', 'E', 'X'],
  'cost_centres':         ['P', 'E', 'X'],

  // ── Enterprise (E) only ───────────────────────────────────────────────────
  'multi_branch':         ['E'],
  'white_label':          ['E'],
  'settings.network':     ['E'],
  'sync':                 ['E'],
};

// ── Staff account limits by tier ──────────────────────────────────────────────
const STAFF_LIMITS = {
  S: 1,
  G: 5,
  P: Infinity,
  E: Infinity,
  X: Infinity,
};

// ── Add-on module codes (positions 3,4,5,6 of v4A key) ───────────────────────
// Each position is a single character: the flag char = enabled, 'N' = not included.
// The flags are positional — order is always: restaurant, finance, sync, zatca_p2.
const ADDON_FLAGS = {
  restaurant: { pos: 3, char: 'R', features: ['restaurant', 'tables', 'kds', 'audit_logs.enhanced', 'break_even', 'inventory_costing', 'deferred_revenue', 'gl_drilldown', 'cost_centres'] },
  finance:    { pos: 4, char: 'F', features: ['finance_hub', 'finance_hub_p2', 'finance_hub_p2.payroll', 'finance_hub_p2.assets', 'finance_hub_p2.bank'] },
  sync:       { pos: 5, char: 'Y', features: ['multi_branch', 'sync', 'settings.network'] },
  zatca_p2:   { pos: 6, char: 'Z', features: ['pos.zatca_p2', 'settings.zatca'] },
};

// Human-readable add-on names (Arabic)
const ADDON_NAMES_AR = {
  restaurant: 'إدارة المطعم والطاولات وKDS',
  finance:    'المحاسبة المتكاملة (FinanceHub)',
  sync:       'مزامنة الفروع المتعددة',
  zatca_p2:   'ZATCA المرحلة الثانية (Phase 2)',
};

// ── Helper: check if a tier char can access a feature ────────────────────────
function tierCanAccess(tierChar, featureKey) {
  if (!featureKey) return false;
  const gate = FEATURE_GATES[featureKey];
  if (!gate) return false; // unknown feature key = deny
  return gate.includes(tierChar.toUpperCase());
}

// ── Helper: check if an add-on grants access to a feature ────────────────────
// addons is an array of add-on IDs that are active (e.g. ['restaurant', 'finance'])
function addonCanAccess(addons, featureKey) {
  if (!addons || addons.length === 0) return false;
  for (const addonId of addons) {
    const def = ADDON_FLAGS[addonId];
    if (def && def.features.includes(featureKey)) return true;
  }
  return false;
}

// ── Helper: get staff limit for a tier char ───────────────────────────────────
function getStaffLimit(tierChar) {
  return STAFF_LIMITS[tierChar.toUpperCase()] ?? 1;
}

module.exports = {
  BILLING_CODES,
  BILLING_CODES_REVERSE,
  TIER_CODES,
  TIER_CODES_REVERSE,
  EXPIRY_DAYS,
  PLAN_NAMES_AR,
  TIER_NAMES_AR,
  FEATURE_GATES,
  STAFF_LIMITS,
  ADDON_FLAGS,
  ADDON_NAMES_AR,
  tierCanAccess,
  addonCanAccess,
  getStaffLimit,
};
