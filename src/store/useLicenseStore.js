import { create } from 'zustand';

// ── Feature gates: must stay in sync with electron/license_plans.cjs ─────────
// This is the renderer-side copy. The authoritative source is the main process.
// DO NOT trust this for enforcement — it's only for UI display logic.
const FEATURE_GATES = {
  'pos':                  ['S','G','P','E','X'],
  'pos.zatca_p1':         ['S','G','P','E','X'],
  'stock.view':           ['S','G','P','E','X'],
  'stock.adjust':         ['S','G','P','E','X'],
  'shift':                ['S','G','P','E','X'],
  'printing':             ['S','G','P','E','X'],
  'services':             ['S','G','P','E','X'],
  'onboarding':           ['S','G','P','E','X'],
  'settings.identity':    ['S','G','P','E','X'],
  'settings.invoice':     ['S','G','P','E','X'],
  'settings.tax':         ['S','G','P','E','X'],
  'customer_display':     ['S','G','P','E','X'],

  'pos.zatca_p2':         ['P','E','X'],        // Phase 2 — Pro+ base or add-on for S/G
  'pos.held_orders':      ['G','P','E','X'],
  'pos.promotions':       ['G','P','E','X'],
  'pos.loyalty':          ['G','P','E','X'],
  'dashboard':            ['S','G','P','E','X'],
  'sales_history':        ['G','P','E','X'],
  'customers':            ['G','P','E','X'],
  'suppliers':            ['G','P','E','X'],
  'purchases':            ['G','P','E','X'],
  'expenditures':         ['G','P','E','X'],
  'promotions':           ['G','P','E','X'],
  'staff.multi':          ['G','P','E','X'],
  'export.csv':           ['G','P','E','X'],
  'export.pdf':           ['G','P','E','X'],
  'export.excel':         ['G','P','E','X'],
  'audit_logs':           ['G','P','E','X'],
  'menu_admin':           ['G','P','E','X'],
  'stock.purchases':      ['G','P','E','X'],
  'vat_settings':         ['G','P','E','X'],
  'settings.zatca':       ['P','E','X'],        // ZATCA device onboarding tab — follows pos.zatca_p2

  'finance_hub':          ['P','E','X'],
  'finance_hub_p2':       ['P','E','X'],
  'restaurant':           ['P','E','X'],
  'tables':               ['P','E','X'],
  'kds':                  ['P','E','X'],
  'audit_logs.enhanced':  ['P','E','X'],
  'break_even':           ['P','E','X'],
  'inventory_costing':    ['P','E','X'],
  'deferred_revenue':     ['P','E','X'],
  'gl_drilldown':         ['P','E','X'],
  'cost_centres':         ['P','E','X'],

  'multi_branch':         ['E'],
  'white_label':          ['E'],
  'settings.network':     ['E'],
  'sync':                 ['E'],
};

const STAFF_LIMITS = { S: 1, G: 5, P: Infinity, E: Infinity, X: Infinity };

// Human-readable tier name for upgrade prompts
const TIER_REQUIRED_FOR = {
  'pos.zatca_p2':         'pro',
  'dashboard':            'growth',
  'customers':            'growth',
  'sales_history':        'growth',
  'suppliers':            'growth',
  'purchases':            'growth',
  'expenditures':         'growth',
  'promotions':           'growth',
  'staff.multi':          'growth',
  'export.pdf':           'growth',
  'audit_logs':           'growth',
  'menu_admin':           'growth',
  'settings.zatca':       'pro',
  'finance_hub':          'pro',
  'finance_hub_p2':       'pro',
  'restaurant':           'pro',
  'tables':               'pro',
  'kds':                  'pro',
  'break_even':           'pro',
  'inventory_costing':    'pro',
  'multi_branch':         'enterprise',
  'white_label':          'enterprise',
  'sync':                 'enterprise',
};

const TIER_NAMES_AR = {
  starter:    'الأساسي (Core)',
  growth:     'النمو (Growth)',
  pro:        'الاحترافي (Pro)',
  enterprise: 'المؤسسي (Enterprise)',
};

const FEATURE_NAMES_AR = {
  'pos.zatca_p2':      'ZATCA المرحلة الثانية (إضافية)',
  'addon.zatca_p2':  'إضافة ZATCA المرحلة الثانية',
  'dashboard':         'لوحة التحكم والتقارير',
  'customers':         'إدارة العملاء والولاء',
  'sales_history':     'سجل المبيعات',
  'suppliers':         'الموردون',
  'purchases':         'أوامر الشراء',
  'expenditures':      'المصروفات',
  'promotions':        'العروض والتخفيضات',
  'staff.multi':       'إدارة الموظفين',
  'export.pdf':        'تصدير PDF / Excel',
  'audit_logs':        'سجل المراجعة',
  'menu_admin':        'إدارة المنتجات',
  'settings.zatca':    'إعدادات هيئة الزكاة',
  'finance_hub':       'المحاسبة المتكاملة',
  'finance_hub_p2':    'المحاسبة المتقدمة',
  'restaurant':        'إدارة المطعم',
  'tables':            'إدارة الطاولات',
  'kds':               'شاشة المطبخ (KDS)',
  'break_even':        'تحليل التعادل',
  'inventory_costing': 'تكلفة المخزون',
  'multi_branch':      'متعدد الفروع',
  'white_label':       'White-Label',
  'sync':              'المزامنة',
};

// ── License store ─────────────────────────────────────────────────────────────
export const useLicenseStore = create((set, get) => ({
  // State
  loaded: false,
  valid: false,
  billing: null,   // 'trial' | 'monthly' | 'yearly' | 'lifetime' | 'owner'
  tier: null,      // 'S' | 'G' | 'P' | 'E' | 'X' (tier char, uppercase)
  tierName: null,  // 'starter' | 'growth' | 'pro' | 'enterprise'
  daysLeft: null,  // number or Infinity
  isOwner: false,
  isTrial: false,
  isLifetime: false,
  trialExpired: false,  // trial key expired — running as Core (degraded)
  keyType: 'tier',      // 'tier' | 'addon' — whether current key is a base tier or add-on key
  activeAddons: [],     // add-ons granted by the current add-on key (e.g. ['restaurant','finance'])
  forceReactivate: false,
  setForceReactivate: (val) => set({ forceReactivate: val }),

  // Load license info from main process
  loadLicense: async () => {
    try {
      const result = await window.api?.checkLicense?.();
      if (!result) {
        set({ loaded: true, valid: false });
        return;
      }
      set({
        loaded: true,
        valid: result.valid,
        billing: result.billing || null,
        tier: result.tier || null,
        tierName: result.tierName || null,
        daysLeft: result.daysLeft ?? null,
        isOwner: result.billing === 'owner',
        isTrial: result.billing === 'trial',
        isLifetime: result.billing === 'lifetime',
        trialExpired: result.trialExpired ?? false,
        keyType: result.keyType || 'tier',
        activeAddons: result.activeAddons || [],
      });
    } catch (err) {
      console.error('[useLicenseStore] loadLicense failed:', err);
      set({ loaded: true, valid: false });
    }
  },

  // Core feature gate check
  // Returns true if current license tier (or active add-ons) can access the feature.
  // ── SECURITY: Only the cryptographically-validated tier and activeAddons from the
  // main process are used. No client-side state affects this decision.
  canAccess: (featureKey) => {
    const { valid, tier, isOwner, activeAddons } = get();

    if (!valid) return false;
    if (isOwner) return true; // owner bypasses all gates
    if (!tier) return false;

    // Check base tier first
    const gate = FEATURE_GATES[featureKey];
    if (gate && gate.includes(tier.toUpperCase())) return true;

    // Check add-ons granted by a v4A key (e.g. restaurant add-on enables tables/kds)
    if (activeAddons && activeAddons.length > 0) {
      const ADDON_FEATURE_MAP = {
        restaurant: ['restaurant', 'tables', 'kds', 'audit_logs.enhanced', 'break_even', 'inventory_costing', 'deferred_revenue', 'gl_drilldown', 'cost_centres'],
        finance:    ['finance_hub', 'finance_hub_p2', 'finance_hub_p2.payroll', 'finance_hub_p2.assets', 'finance_hub_p2.bank'],
        sync:       ['multi_branch', 'sync', 'settings.network'],
        zatca_p2:   ['pos.zatca_p2', 'settings.zatca'],
      };
      for (const addonId of activeAddons) {
        if (ADDON_FEATURE_MAP[addonId]?.includes(featureKey)) return true;
      }
    }

    return false;
  },

  // Returns the minimum tier name required for a feature (for upgrade prompts)
  requiredTierFor: (featureKey) => {
    return TIER_REQUIRED_FOR[featureKey] || null;
  },

  // Returns the Arabic feature name for upgrade prompts
  featureNameAr: (featureKey) => {
    return FEATURE_NAMES_AR[featureKey] || featureKey;
  },

  // Returns the Arabic tier name
  tierNameAr: (tierKey) => {
    return TIER_NAMES_AR[tierKey] || tierKey;
  },

  // Staff limit for current tier
  staffLimit: () => {
    const { tier, isOwner } = get();
    if (isOwner) return Infinity;
    return STAFF_LIMITS[tier?.toUpperCase()] ?? 1;
  },

  // Is receipt watermark needed? (trial billing)
  needsWatermark: () => {
    const { billing } = get();
    return billing === 'trial';
  },
}));

// Convenience hook for checking a single feature in a component
export const useCanAccess = (featureKey) => {
  return useLicenseStore(s => s.canAccess(featureKey));
};
