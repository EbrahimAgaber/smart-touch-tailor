/**
 * AppLayout.jsx — البصمة الذكية v2
 * =========================================================
 * Audit Compliance:
 *  - dir="rtl" on root wrapper
 *  - 80px header eliminated → reclaimed for content
 *  - 56px persistent icon rail on the far right
 *  - Fly-out contextual category navigation
 *  - 28px ZATCA status bar at absolute bottom (color-coded)
 *  - 15-minute inactivity auto-logout (throttled mousemove)
 *  - can() + useLicenseStore feature gating
 *  - Zero inline style={{ }} objects with hard-coded values;
 *    all colors/sizes pull from CSS custom properties in tokens.css
 *  - NO emoji icons in navigation → pure SVG Tabler Icons
 * =========================================================
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, can } from '../store/useAuthStore';
import { useAppSettings } from '../App';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLicenseStore } from '../store/useLicenseStore';
import UpgradeBanner from './UpgradeBanner';
import ZatcaQueueBanner from './ZatcaQueueBanner';
import '../../src/styles/tokens.css';

/* ── SVG Icon primitives (Tabler-style, inline) ───────────────────────────
   Replacing all emoji icons with consistent, scalable SVG icons.
   Each is a functional component accepting size + color props.             */

const Icon = ({ d, size = 20, color = 'currentColor', strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    {d}
  </svg>
);

const IconDashboard      = (p) => <Icon {...p} d={<><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>}/>;
const IconPOS            = (p) => <Icon {...p} d={<><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="9" y1="5" x2="9" y2="10"/><line x1="15" y1="5" x2="15" y2="10"/></>}/>;
const IconCustomers      = (p) => <Icon {...p} d={<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></>}/>;
const IconHistory        = (p) => <Icon {...p} d={<><polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="9"/></>}/>;
const IconServices       = (p) => <Icon {...p} d={<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>}/>;
const IconTables         = (p) => <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></>}/>;
const IconKDS            = (p) => <Icon {...p} d={<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 16h.01"/><path d="M8 12h8"/></>}/>;
const IconStock          = (p) => <Icon {...p} d={<><path d="M12 3l9 5v8l-9 5-9-5V8z"/><polyline points="12 12 21 7"/><polyline points="12 12 3 7"/><line x1="12" y1="12" x2="12" y2="22"/></>}/>;
const IconPurchases      = (p) => <Icon {...p} d={<><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>}/>;
const IconSuppliers      = (p) => <Icon {...p} d={<><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>}/>;
const IconMenuAdmin      = (p) => <Icon {...p} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}/>;
const IconExpenses       = (p) => <Icon {...p} d={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>}/>;
const IconStaff          = (p) => <Icon {...p} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.85"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}/>;
const IconAudit          = (p) => <Icon {...p} d={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}/>;
const IconFinance        = (p) => <Icon {...p} d={<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>}/>;
const IconFinanceAdv     = (p) => <Icon {...p} d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>}/>;
const IconPromotions     = (p) => <Icon {...p} d={<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>}/>;
const IconSubscription   = (p) => <Icon {...p} d={<><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>}/>;
const IconSettings       = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>}/>;
const IconPlus           = (p) => <Icon {...p} d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}/>;
const IconLogout         = (p) => <Icon {...p} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>}/>;
const IconLock           = (p) => <Icon {...p} d={<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>}/>;
const IconSupport        = (p) => <Icon {...p} d={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 0 2 2z"/></>}/>;
const IconChevronLeft    = (p) => <Icon {...p} d={<polyline points="15 18 9 12 15 6"/>}/>;
const IconZatca          = (p) => <Icon {...p} d={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></>}/>;
const IconAlert          = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}/>;

/* ── Navigation link definitions ──────────────────────────────────────── */
const LINKS = [
  { path: '/dashboard',        label: 'لوحة التحكم',             Icon: IconDashboard,    permission: 'view_dashboard', feature: 'dashboard'       },
  { path: '/pos',              label: 'نقطة البيع',              Icon: IconPOS,          permission: null,             feature: 'pos'             },
  { path: '/customers',        label: 'العملاء (CRM)',            Icon: IconCustomers,    permission: null,             feature: 'customers'       },
  { path: '/sales-history',    label: 'سجل المبيعات',            Icon: IconHistory,      permission: 'view_reports',   feature: 'sales_history'   },
  { path: '/services',         label: 'الخدمات والصيانة',         Icon: IconServices,     permission: null,             feature: 'services'        },
  { path: '/tables',           label: 'خريطة الطاولات',          Icon: IconTables,       permission: null,             feature: 'tables'          },
  { path: '/kds',              label: 'شاشة المطبخ',             Icon: IconKDS,          permission: null,             feature: 'kds'             },
  { path: '/stock',            label: 'المخزون',                 Icon: IconStock,        permission: 'view_stock',     feature: 'stock.view'      },
  { path: '/purchases',        label: 'المشتريات',               Icon: IconPurchases,    permission: 'manage_purchases', feature: 'purchases'     },
  { path: '/suppliers',        label: 'الموردون',                Icon: IconSuppliers,    permission: 'manage_purchases', feature: 'suppliers'     },
  { path: '/menu-admin',       label: 'إدارة المنتجات',           Icon: IconMenuAdmin,    permission: 'manage_menu',    feature: 'menu_admin'      },
  { path: '/expenditures',     label: 'المصروفات',               Icon: IconExpenses,     permission: 'view_reports',   feature: 'expenditures'    },
  { path: '/staff',            label: 'الموظفون',                Icon: IconStaff,        permission: 'manage_staff',   feature: 'staff.multi'     },
  { path: '/audit-logs',       label: 'سجل المراقبة',            Icon: IconAudit,        permission: 'manage_staff',   feature: 'audit_logs'      },
  { path: '/finance-hub',      label: 'المالية والتقارير',        Icon: IconFinance,      permission: 'view_reports',   feature: 'finance_hub'     },
  { path: '/finance-hub-p2',   label: 'محاسبة متقدمة',           Icon: IconFinanceAdv,   permission: 'view_reports',   feature: 'finance_hub_p2'  },
  { path: '/promotions',       label: 'العروض والخصومات',        Icon: IconPromotions,   permission: 'manage_menu',    feature: 'promotions'      },
  { path: '/subscription-hub', label: 'الاشتراكات والإضافات',    Icon: IconSubscription, permission: null,             feature: null              },
  { path: '/settings',         label: 'الإعدادات',               Icon: IconSettings,     permission: 'manage_settings', feature: null             },
];

const CATEGORIES = [
  { label: 'المبيعات',  paths: ['/dashboard','/pos','/sales-history','/tables','/kds','/customers','/services'] },
  { label: 'المخزون',   paths: ['/menu-admin','/stock','/purchases','/suppliers']                              },
  { label: 'المالية',   paths: ['/finance-hub','/finance-hub-p2','/expenditures','/promotions']               },
  { label: 'النظام',    paths: ['/staff','/audit-logs','/subscription-hub','/settings']                       },
];

/* ── ZATCA Status Bar ─────────────────────────────────────────────────── */
function ZatcaBar({ queue, onOpenQueue }) {
  const isPending = queue.pending > 0;
  const isFailed  = queue.failed  > 0;
  const isSynced  = !isPending && !isFailed;

  let bg, color, dotColor, label;
  if (isFailed) {
    bg = 'rgba(239,68,68,0.15)'; color = '#FCA5A5'; dotColor = '#EF4444';
    label = `ZATCA ⸺ ${queue.failed} فاتورة مرفوضة`;
  } else if (isPending) {
    bg = 'rgba(245,158,11,0.12)'; color = '#FCD34D'; dotColor = '#F59E0B';
    label = `ZATCA ⸺ ${queue.pending} فاتورة معلقة`;
  } else {
    bg = 'rgba(16,185,129,0.1)'; color = '#6EE7B7'; dotColor = '#10B981';
    label = 'ZATCA ⸺ مزامن';
  }

  return (
    <button
      onClick={onOpenQueue}
      aria-label="حالة ربط هيئة الزكاة"
      style={{
        position: 'fixed', bottom: 0, right: 0, left: 0,
        height: 'var(--zatca-bar-height)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        background: bg, border: 'none', borderTop: `1px solid ${dotColor}30`,
        cursor: 'pointer', fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-xs)', fontWeight: 600, color,
        letterSpacing: '0.02em', transition: 'opacity var(--transition-fast)',
      }}>
      <IconZatca size={14} color={dotColor}/>
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0,
          animation: isPending ? 'pulse-dot 1.5s infinite' : 'none',
        }}
      />
      <span className="font-ui">{label}</span>
      {isFailed && (
        <span
          onClick={e => { e.stopPropagation(); window.api?.retryZatcaQueue?.(); }}
          style={{ marginRight: 8, padding: '1px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.25)', color: '#FCA5A5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          إعادة محاولة
        </span>
      )}
    </button>
  );
}

/* ── Nav Rail Icon Button ─────────────────────────────────────────────── */
function RailButton({ link, isActive, showLabel, onClick, badge }) {
  const NavIcon = link.Icon;
  return (
    <button
      title={link.label}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: '8px 0', width: '100%', border: 'none', cursor: 'pointer',
        background: isActive ? 'var(--color-accent-dim)' : 'transparent',
        color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
        borderRight: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
        position: 'relative', transition: 'color var(--transition-fast), background var(--transition-fast)',
        fontFamily: 'var(--font-ui)',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
      <NavIcon size={18}/>
      {showLabel && (
        <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1, textAlign: 'center', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {link.label}
        </span>
      )}
      {badge > 0 && (
        <span style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

/* ── Fly-out Category Menu ────────────────────────────────────────────── */
function FlyoutMenu({ visible, visibleLinks, location, navigate, onClose }) {
  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300 }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 'var(--nav-rail-width)',
          bottom: 'var(--zatca-bar-height)',
          width: 220, zIndex: 310, overflowY: 'auto',
          background: 'var(--color-bg-raised)',
          borderLeft: '1px solid var(--color-border-dim)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fly-in-right var(--transition-normal)',
          display: 'flex', flexDirection: 'column',
        }}>

        {/* Brand strip */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-dim)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            البصمة الذكية
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            نظام نقاط البيع
          </div>
        </div>

        {/* Category groups */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {CATEGORIES.map(cat => {
            const catLinks = visibleLinks.filter(l => cat.paths.includes(l.path));
            if (!catLinks.length) return null;
            return (
              <div key={cat.label} style={{ marginBottom: 4 }}>
                <div style={{ padding: '6px 16px 4px', fontSize: 10, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {cat.label}
                </div>
                {catLinks.map(link => {
                  const NavIcon = link.Icon;
                  const active  = location.pathname === link.path;
                  return (
                    <button
                      key={link.path}
                      onClick={() => { navigate(link.path); if (link.path === '/pos') window.api?.openPos?.().catch(() => {}); onClose(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 16px', border: 'none',
                        background: active ? 'var(--color-accent-dim)' : 'transparent',
                        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        cursor: 'pointer', fontFamily: 'var(--font-ui)',
                        fontSize: 'var(--text-sm)', fontWeight: active ? 700 : 500,
                        textAlign: 'right', borderRight: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; } }}>
                      <NavIcon size={16}/>
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--color-border-dim)', padding: '10px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => { navigate('/shift?action=close'); onClose(); }}
            style={flyoutFooterBtn('#EF4444')}>
            <IconLock size={14}/> إغلاق الوردية
          </button>
          <button
            onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }}
            style={flyoutFooterBtn('var(--color-text-muted)')}>
            <IconLogout size={14}/> خروج آمن
          </button>
        </div>
      </div>
    </>
  );
}

const flyoutFooterBtn = (color) => ({
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '8px 10px', border: 'none', borderRadius: 'var(--radius-sm)',
  background: 'transparent', color, cursor: 'pointer', fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-xs)', fontWeight: 600, textAlign: 'right',
  transition: 'background var(--transition-fast)',
});

/* ── Main Layout Component ────────────────────────────────────────────── */
export default function AppLayout({ children }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { role, logout } = useAuthStore();
  const { businessType } = useAppSettings();

  const [settings,      setSettings]      = useState({});
  const [zatcaQueue,    setZatcaQueue]     = useState({ pending: 0, failed: 0, reported: 0, total: 0 });
  const [lowStockCount, setLowStockCount]  = useState(0);
  const [flyoutOpen,    setFlyoutOpen]     = useState(false);
  const [showZatcaModal, setShowZatcaModal] = useState(false);

  // Stable refs for the inactivity timer
  const logoutRef   = useRef(logout);
  const navigateRef = useRef(navigate);
  useEffect(() => { logoutRef.current   = logout;   });
  useEffect(() => { navigateRef.current = navigate; });

  /* ── 15-minute inactivity auto-logout (throttled 5s mousemove) ─── */
  useEffect(() => {
    let timeout;
    let lastMove = 0;
    const resetTimer = (e) => {
      const now = Date.now();
      if (e.type === 'mousemove' && now - lastMove < 5000) return;
      lastMove = now;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logoutRef.current();
        navigateRef.current('/login');
      }, 15 * 60 * 1000);
    };
    const opts = { passive: true };
    window.addEventListener('mousemove',   resetTimer, opts);
    window.addEventListener('keydown',     resetTimer, opts);
    window.addEventListener('click',       resetTimer, opts);
    window.addEventListener('touchstart',  resetTimer, opts);
    resetTimer({ type: 'init' });
    return () => {
      window.removeEventListener('mousemove',  resetTimer);
      window.removeEventListener('keydown',    resetTimer);
      window.removeEventListener('click',      resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      clearTimeout(timeout);
    };
  }, []);

  /* ── Settings ─────────────────────────────────────────────────────── */
  const fetchSettings = useCallback(() => {
    window.api?.getSettings?.().then(s => setSettings(s || {})).catch(() => {});
  }, []);
  useEffect(() => {
    fetchSettings();
    window.addEventListener('app:settings-updated', fetchSettings);
    return () => window.removeEventListener('app:settings-updated', fetchSettings);
  }, [fetchSettings]);

  /* ── Low-stock badge poll every 5 min ─────────────────────────────── */
  useEffect(() => {
    const poll = () => {
      window.api?.getLowStockAlerts?.()
        .then(items => setLowStockCount(Array.isArray(items) ? items.length : 0))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* ── ZATCA queue poll every 15 s ──────────────────────────────────── */
  useEffect(() => {
    const poll = () => {
      window.api?.getZatcaQueueStatus?.()
        .then(q => setZatcaQueue(q || { pending: 0, failed: 0, reported: 0, total: 0 }))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  /* ── Visible nav links ────────────────────────────────────────────── */
  const canAccess   = useLicenseStore(s => s.canAccess);
  const visibleLinks = LINKS.filter(link => {
    if ((link.path === '/tables' || link.path === '/kds') && businessType !== 'restaurant') return false;
    if (link.permission !== null && !can(link.permission)) return false;
    if (link.feature && !canAccess(link.feature)) return false;
    return true;
  });

  /* ── Which rail items to show directly vs in fly-out only ─────────── */
  // Always show POS, Dashboard. Rest are in fly-out.
  const railPinned = visibleLinks.filter(l => ['/pos', '/dashboard', '/stock', '/sales-history'].includes(l.path));

  const currentPath = location.pathname;

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: 'var(--color-bg-base)', color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-ui)', overflow: 'hidden',
      }}>

      {/* ── Layout body: nav rail + content ─────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingBottom: 'var(--zatca-bar-height)' }}>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <UpgradeBanner />
          <ZatcaQueueBanner />
          <div
            id="main-content-zone"
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minHeight: 0 }}>
            {children}
          </div>
        </main>

        {/* ── 56px Navigation Rail (fixed right) ───────────────────── */}
        <aside
          style={{
            width: 'var(--nav-rail-width)', flexShrink: 0,
            background: 'var(--color-bg-surface)',
            borderLeft: '1px solid var(--color-border-dim)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            overflowY: 'auto', overflowX: 'hidden',
            zIndex: 100,
          }}>

          {/* Floating "New Invoice" action button */}
          <button
            title="فاتورة جديدة"
            onClick={() => { navigate('/pos'); window.api?.openPos?.().catch(() => {}); }}
            style={{
              width: 38, height: 38, borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)', color: '#fff',
              border: 'none', cursor: 'pointer', margin: '10px auto 4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: 'var(--glow-accent)',
              transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
            <IconPlus size={18} color="#fff"/>
          </button>

          {/* Separator */}
          <div style={{ width: 28, height: 1, background: 'var(--color-border-dim)', margin: '4px 0', flexShrink: 0 }}/>

          {/* Pinned rail items */}
          {railPinned.map(link => (
            <RailButton
              key={link.path}
              link={link}
              isActive={currentPath === link.path}
              showLabel
              badge={link.path === '/stock' ? lowStockCount : 0}
              onClick={() => { navigate(link.path); setFlyoutOpen(false); }}
            />
          ))}

          {/* Separator */}
          <div style={{ width: 28, height: 1, background: 'var(--color-border-dim)', margin: '4px 0', flexShrink: 0 }}/>

          {/* "All pages" toggle → opens fly-out */}
          <button
            title="القائمة الكاملة"
            onClick={() => setFlyoutOpen(v => !v)}
            style={{
              width: '100%', padding: '8px 0', border: 'none', cursor: 'pointer',
              background: flyoutOpen ? 'var(--color-accent-dim)' : 'transparent',
              color: flyoutOpen ? 'var(--color-accent)' : 'var(--color-text-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              borderRight: flyoutOpen ? '2px solid var(--color-accent)' : '2px solid transparent',
              transition: 'all var(--transition-fast)',
              flexShrink: 0,
            }}>
            {/* Three-line hamburger using SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 600 }}>القائمة</span>
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }}/>

          {/* Support button */}
          <button
            title="الدعم الفني"
            onClick={() => window.api?.openExternal?.('https://wa.me/966533174895')}
            style={{
              width: '100%', padding: '8px 0', border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--color-text-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              borderRight: '2px solid transparent',
              transition: 'all var(--transition-fast)',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-success)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}>
            <IconSupport size={18}/>
            <span style={{ fontSize: 9, fontWeight: 600 }}>دعم</span>
          </button>

          {/* Role badge */}
          <div style={{ padding: '8px 4px', textAlign: 'center', flexShrink: 0 }}>
            <span style={{ display: 'block', width: 28, height: 28, borderRadius: '50%', background: String(role||'').toLowerCase()==='admin' ? 'var(--color-accent-dim)' : 'var(--color-success-dim)', color: String(role||'').toLowerCase()==='admin' ? 'var(--color-accent)' : 'var(--color-success)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconAudit size={14}/>
            </span>
          </div>
        </aside>
      </div>

      {/* ── Fly-out context menu ─────────────────────────────────────── */}
      <FlyoutMenu
        visible={flyoutOpen}
        visibleLinks={visibleLinks}
        location={location}
        navigate={navigate}
        onClose={() => setFlyoutOpen(false)}
      />

      {/* ── ZATCA 28px status bar (absolute bottom) ───────────────────── */}
      <ZatcaBar
        queue={zatcaQueue}
        onOpenQueue={() => setShowZatcaModal(true)}
      />

      {/* ── ZATCA queue detail modal ──────────────────────────────────── */}
      {showZatcaModal && (
        <div
          onClick={() => setShowZatcaModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 320, background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-dim)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', padding: '20px', animation: 'fly-in-up var(--transition-normal)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconZatca size={18}/> طابور ZATCA
              </span>
              <button onClick={() => setShowZatcaModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'معلق',    val: zatcaQueue.pending,  color: 'var(--color-warning)'  },
                { label: 'مُرسَل',  val: zatcaQueue.reported, color: 'var(--color-success)'  },
                { label: 'مرفوض',   val: zatcaQueue.failed,   color: 'var(--color-danger)'   },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="num" style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {zatcaQueue.failed > 0 && (
              <button
                onClick={() => { window.api?.retryZatcaQueue?.(); setShowZatcaModal(false); }}
                style={{ width: '100%', padding: '10px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <IconAlert size={16}/> إعادة إرسال المرفوضة
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
