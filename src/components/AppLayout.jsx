import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, can } from '../store/useAuthStore';
import { useAppSettings } from '../App';
import { useState, useEffect, useRef, useMemo } from 'react';
import { formatDate } from '../utils/date';
import { useLicenseStore } from '../store/useLicenseStore';
import UpgradeBanner from './UpgradeBanner';
import ZatcaQueueBanner from './ZatcaQueueBanner';

// ── RESPONSIVE SIDEBAR ARCHITECTURE (BUG-07 / Sprint 3) ───────────────────
// ARCHITECTURAL REASON:
// Inline React style objects have HIGHER specificity than any CSS rule,
// including @media queries. A `style={{ width:'240px' }}` directly on an
// element cannot be overridden by `@media (max-width:1024px) { .app-sidebar { width:64px } }`.
//
// Fix: The width is NOT set in the inline style object. It lives entirely in
// index.css under the `.app-sidebar` class. The component adds the class name,
// and CSS media queries can freely override the width at any breakpoint.
//
// The `sidebarOpen` state controls a `.app-sidebar--collapsed` modifier class
// at ≤1024px. The hamburger toggle button only appears below 1024px.
// ───────────────────────────────────────────────────────────────────────────

import { useTranslation } from 'react-i18next';

const LINKS = [
  { path: '/home',         labelKey: 'home',          icon: '🏠', permission: null, feature: null, fallbackLabel: 'الرئيسية' },
  { path: '/dashboard',    labelKey: 'dashboard',       icon: '📊', permission: 'view_dashboard', feature: 'dashboard', fallbackLabel: 'لوحة التحكم' },
  { path: '/tailor-pos',    labelKey: 'tailor_pos',     icon: '✂️', permission: null, feature: null, fallbackLabel: 'تفصيل جديد' },
  { path: '/orders-board', labelKey: 'orders_board',    icon: '🏭', permission: null, feature: null, fallbackLabel: 'لوحة المعمل' },
  { path: '/alterations',   labelKey: 'alterations',    icon: '🏷️', permission: null, feature: null, fallbackLabel: 'إدارة التعديلات' },
  { path: '/measurements', labelKey: 'measurements',    icon: '📐', permission: null, feature: null, fallbackLabel: 'دفتر المقاسات' },
  { path: '/pos',          labelKey: 'pos',        icon: '🛒', permission: null, feature: 'pos', fallbackLabel: 'نقطة البيع' }, // always visible

  { path: '/customers',    labelKey: 'customers',     icon: '👥', permission: null, feature: 'customers', fallbackLabel: 'العملاء' },
  { path: '/sponsors',     labelKey: 'sponsors', icon: '🤝', permission: 'admin', feature: null, fallbackLabel: 'الجهات الداعمة' },
  { path: '/sales-history',labelKey: 'sales_history',     icon: '📜', permission: 'view_reports', feature: 'sales_history', fallbackLabel: 'سجل المبيعات' },
  { path: '/services',     labelKey: 'services',  icon: '🔧', permission: null, feature: 'services', fallbackLabel: 'الخدمات' },
  { path: '/tables',       labelKey: 'tables',    icon: '🪑', permission: null, feature: 'tables', fallbackLabel: 'الطاولات' },
  { path: '/kds',          labelKey: 'kds',       icon: '🍳', permission: null, feature: 'kds', fallbackLabel: 'شاشة المطبخ' },
  { path: '/stock',        labelKey: 'stock',           icon: '📦', permission: 'view_stock', feature: 'stock.view', fallbackLabel: 'المخزون' },
  { path: '/purchases',    labelKey: 'purchases',          icon: '📥', permission: 'manage_purchases', feature: 'purchases', fallbackLabel: 'المشتريات' },
  { path: '/suppliers',    labelKey: 'suppliers',          icon: '🚚', permission: 'manage_purchases', feature: 'suppliers', fallbackLabel: 'الموردون' },
  { path: '/menu-admin',   labelKey: 'menu_admin',    icon: '📋', permission: 'manage_menu', feature: 'menu_admin', fallbackLabel: 'إدارة الأصناف' },
  { path: '/expenditures', labelKey: 'expenditures',         icon: '💸', permission: 'view_reports', feature: 'expenditures', fallbackLabel: 'المصروفات' },
  { path: '/staff',        labelKey: 'staff',          icon: '👔', permission: 'manage_staff', feature: 'staff.multi', fallbackLabel: 'الموظفون' },
  { path: '/audit-logs',   labelKey: 'audit_logs',      icon: '🛡️', permission: 'manage_staff', feature: 'audit_logs', fallbackLabel: 'سجل المراقبة' },
  { path: '/finance-hub',   labelKey: 'finance_hub', icon: '🏛️', permission: 'view_reports', feature: 'finance_hub', fallbackLabel: 'المركز المالي' },
  { path: '/finance-hub-p2', labelKey: 'finance_hub_p2',     icon: '📈', permission: 'view_reports', feature: 'finance_hub_p2', fallbackLabel: 'محاسبة متقدمة' },
  { path: '/promotions',   labelKey: 'promotions',  icon: '🏷️', permission: 'manage_menu', feature: 'promotions', fallbackLabel: 'العروض' },
  { path: '/subscription-hub', labelKey: 'subscription_hub', icon: '⭐', permission: null, feature: null, fallbackLabel: 'الاشتراكات' },
  { path: '/settings',     labelKey: 'settings',         icon: '⚙️', permission: 'manage_settings', feature: null, fallbackLabel: 'الإعدادات' },
];

// ── Sidebar navigation categories (stable constant — outside component to
//    avoid re-creating on every render, which would break useEffect deps) ────
const CATEGORIES = [
  { labelKey: 'overview', links: ['/home', '/dashboard', '/orders-board', '/alterations', '/measurements'] },
  { labelKey: 'sales', links: ['/tailor-pos', '/pos', '/sales-history', '/tables', '/kds', '/services'] },
  { labelKey: 'stock', links: ['/menu-admin', '/stock', '/purchases', '/suppliers'] },
  { labelKey: 'finance', links: ['/finance-hub', '/expenditures', '/finance-hub-p2'] },
  { labelKey: 'system', links: ['/customers', '/sponsors', '/promotions', '/staff', '/audit-logs', '/subscription-hub', '/settings'] },
];

export default function AppLayout({ children, title }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, logout } = useAuthStore();
  const { businessType } = useAppSettings(); // ← shared context, reactive to Settings saves
  const [settings, setSettings] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [zatcaQueue, setZatcaQueue] = useState({ pending: 0, failed: 0, reported: 0, total: 0 });
  const [zatcaDevice, setZatcaDevice] = useState(null);

  const logoutRef = useRef(logout);
  const navigateRef = useRef(navigate);
  useEffect(() => { logoutRef.current = logout; });
  useEffect(() => { navigateRef.current = navigate; });

  useEffect(() => {
    let timeout;
    let lastMove = 0;
    const resetTimer = (e) => {
      const now = Date.now();
      if (e.type === 'mousemove' && now - lastMove < 5000) return;
      lastMove = now;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        logoutRef.current();
        navigateRef.current('/login');
      }, 15 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });
    window.addEventListener('click', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    resetTimer({ type: 'init' });

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const fetchSettings = () => {
    window.api?.getSettings?.().then(s => {
      setSettings(s || {});
    }).catch(() => {});
  };

  useEffect(() => {
    fetchSettings();
    window.addEventListener('app:settings-updated', fetchSettings);
    return () => window.removeEventListener('app:settings-updated', fetchSettings);
  }, []);

  // ── HIDDEN-07: Low Stock Badge — poll every 5 minutes ─────────────────
  useEffect(() => {
    const fetchLowStock = () => {
      window.api?.getLowStockAlerts?.()
        .then(items => setLowStockCount(Array.isArray(items) ? items.length : 0))
        .catch(() => {});
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── ZATCA Queue Status Polling ──────────────────────────────────────────
  useEffect(() => {
    const fetchZatca = () => {
      window.api?.getZatcaQueueStatus?.()
        .then(q => setZatcaQueue(q || { pending: 0, failed: 0, reported: 0, total: 0 }))
        .catch(() => {});
    };
    fetchZatca();
    const interval = setInterval(fetchZatca, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // ── ZATCA Device Info & Settings Listeners ──────────────────────────────
  useEffect(() => {
    const fetchDevice = () => {
      window.api?.getZatcaDevice?.().then(setZatcaDevice).catch(() => {});
    };
    fetchDevice();
    window.addEventListener('app:settings-updated', fetchDevice);
    return () => window.removeEventListener('app:settings-updated', fetchDevice);
  }, []);

  // ── Collapse sidebar on small screens by default ───────────────────────
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      setIsMobile(w <= 1024);
      // Desktop (>1024px): always open
      // Tablet landscape (768–1024px): open by default
      // Tablet portrait / Mobile: collapsed
      if (w > 1024) setSidebarOpen(true);
      else if (w >= 768 && isLandscape) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const canAccess = useLicenseStore(s => s.canAccess);

  // ── BUG-09 FIX: use can() helper instead of binary role === 'Admin' ────
  // PERF FIX: Memoize `visible` so it only recalculates when its inputs
  // actually change. Without useMemo, .filter() creates a new array reference
  // every render, which breaks useEffect dependency checks and causes an
  // infinite re-render loop that freezes navigation.
  const visible = useMemo(() => LINKS.filter(link => {
    // Restaurant specific
    if ((link.path === '/tables' || link.path === '/kds') && businessType !== 'restaurant') return false;
    
    // Tailor specific
    if ((link.path === '/tailor-pos' || link.path === '/orders-board' || link.path === '/alterations' || link.path === '/measurements') && businessType !== 'tailor') return false;
    
    // Hide general POS features if Tailor is selected (tailors use tailor-pos instead)
    if (businessType === 'tailor' && (link.path === '/pos' || link.path === '/services')) return false;

    if (link.permission !== null && !can(link.permission)) return false;
    if (link.feature && !canAccess(link.feature)) return false;
    return true;
  }), [businessType, canAccess]);
  
  const branchName = settings.branch_name || settings.business_name_ar || 'نظام البصمة الذكية';

  const [openCategories, setOpenCategories] = useState(() => {
    const initial = {};
    CATEGORIES.forEach(cat => {
      const hasActive = visible.some(l => cat.links.includes(l.path) && location.pathname === l.path);
      initial[cat.labelKey] = hasActive || cat.labelKey === 'overview';
    });
    return initial;
  });

  // Auto-expand the category that contains the currently active route.
  // Only depends on location.pathname (stable string) — NOT on `visible`
  // or `CATEGORIES` (which are stable by construction: useMemo / module-scope).
  useEffect(() => {
    CATEGORIES.forEach(cat => {
      const hasActive = visible.some(l => cat.links.includes(l.path) && location.pathname === l.path);
      if (hasActive) {
        setOpenCategories(prev => {
          if (prev[cat.labelKey]) return prev; // already open — skip update to avoid re-render
          return { ...prev, [cat.labelKey]: true };
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isDark = settings.dark_mode === 'true';

  return (
    <div dir="rtl" data-theme={isDark ? 'dark' : 'light'} style={{ display:'flex', height:'100vh', background: isDark ? '#0f172a' : '#f1f5f9', color: isDark ? '#f1f5f9' : '#0f172a', overflow:'hidden' }}>

      {/* ── Hamburger toggle (tablet ≤1024px) ──────────────────────────── */}
      {!sidebarOpen && (
        <button
          className="sidebar-hamburger"
          onClick={() => setSidebarOpen(true)}
          aria-label="فتح القائمة"
          style={{ position:'fixed', top:'16px', right:'16px', zIndex:200, width:'44px', height:'44px', borderRadius:'12px', border:'none', background:'white', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>
          
        </button>
      )}

      {/* ── Overlay backdrop for mobile/tablet (click-away to close) ─────── */}
      {sidebarOpen && isMobile && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="pos-cart-overlay"
          style={{ zIndex: 49 }}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      {/* WHY className="app-sidebar" instead of inline width:
          Inline style width:'240px' has higher CSS specificity than any @media
          rule — it cannot be overridden by breakpoints in index.css.
          Removing width from the inline style and applying it via .app-sidebar
          in index.css allows @media (max-width:1024px) to freely override it. */}
      <aside
        className={`app-sidebar${sidebarOpen ? '' : ' app-sidebar--collapsed'}`}
        style={{
          background:'var(--bg-card)', display:'flex', flexDirection:'column',
          borderLeft:'1px solid var(--border-subtle)', boxShadow:'4px 0 24px rgba(0,0,0,0.03)',
          flexShrink:0, zIndex:50,
          color: 'var(--text-main)',
          transition:'width 0.2s ease, transform 0.2s ease, background-color 0.3s ease',
        }}>

        {/* Close button visible when sidebar is open at ≤1024px */}
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="إغلاق القائمة"
          style={{ position:'absolute', top:'12px', left:'12px', width:'32px', height:'32px', borderRadius:'8px', border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:'16px', alignItems:'center', justifyContent:'center' }}>
          
        </button>

        {/* Brand */}
        <div style={{ padding:'20px 16px', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
            {settings.business_logo ? (
              <img src={settings.business_logo} alt="logo"
                style={{ width:'42px', height:'42px', borderRadius:'10px', objectFit:'contain', background:'#f8fafc', border:'1px solid #e2e8f0', flexShrink:0 }} />
            ) : (
              <div style={{ width:'42px', height:'42px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', color:'white', flexShrink:0, boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}></div>
            )}
            <div className="sidebar-label-text">
              <div style={{ fontWeight:'900', fontSize:'14px', color:'#0f172a', lineHeight:1.2 }}>
                {settings.business_name_ar || t('layout.default_title')}
              </div>
              <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700' }}>{branchName}</div>
            </div>
          </div>

          <button 
            onClick={() => {
              const target = businessType === 'tailor' ? '/tailor-pos' : '/pos';
              navigate(target);
              if (businessType !== 'tailor' && window.api?.openPos) {
                window.api.openPos().catch(() => {});
              }
            }} 
            className="sidebar-label-text" 
            style={{ width:'100%', padding:'12px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'12px', fontWeight:'800', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:'0 4px 15px rgba(37,99,235,0.25)' }}>
            <span></span> {businessType === 'tailor' ? 'طلب تفصيل جديد' : t('layout.sidebar.new_invoice')}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'14px 10px', maxHeight:'calc(100vh - 200px)' }}>
          {CATEGORIES.map(cat => {
            const catLinks = visible.filter(l => cat.links.includes(l.path));
            if (catLinks.length === 0) return null;
            const isOpen = !!openCategories[cat.labelKey];

            return (
              <div key={cat.labelKey} style={{ marginBottom:'12px', borderBottom:'1px solid rgba(0,0,0,0.03)', paddingBottom:'6px' }}>
                <button
                  onClick={() => setOpenCategories(prev => ({ ...prev, [cat.labelKey]: !prev[cat.labelKey] }))}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontWeight: '800',
                    fontSize: '11px',
                    textAlign: 'right',
                    fontFamily: 'inherit',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="sidebar-label-text">{t(`layout.sidebar.categories.${cat.labelKey}`)}</span>
                  <span style={{ fontSize: '9px' }} className="sidebar-label-text">
                    {isOpen ? '▼' : '◀'}
                  </span>
                </button>

                <div style={{
                  maxHeight: isOpen ? '500px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  marginTop: isOpen ? '4px' : '0px',
                  paddingRight: '6px'
                }}>
                  {catLinks.map(l => {
                    const active = location.pathname === l.path;
                    const isStock = l.path === '/stock';
                    return (
                        <button key={l.path} onClick={() => { 
                          navigate(l.path);
                          if (l.path === '/pos' && window.api?.openPos) {
                            window.api.openPos().catch(() => {});
                          }
                          if (window.innerWidth <= 1024) setSidebarOpen(false); 
                        }}
                        style={{
                          display:'flex', alignItems:'center', gap:'10px',
                          padding:'9px 12px', borderRadius:'10px', border:'none',
                          cursor:'pointer', fontWeight: active ? '800' : '600', fontSize:'13px',
                          width:'100%', textAlign:'right', fontFamily:'inherit',
                          marginBottom:'2px', transition:'all 0.1s',
                          background: active ? (isDark ? '#1e3a8a' : '#f0f7ff') : 'transparent',
                          color: active ? (isDark ? '#60a5fa' : '#2563eb') : 'var(--text-muted)',
                          borderRight: active ? '3px solid #2563eb' : '3px solid transparent',
                          position:'relative',
                        }}>
                        <span style={{ fontSize:'16px', opacity: active ? 1 : 0.7, flexShrink:0 }}>{l.icon}</span>
                        <span className="sidebar-label-text">{t(`layout.sidebar.links.${l.labelKey}`, l.fallbackLabel || l.labelKey)}</span>
                        {/* HIDDEN-07: Low stock badge on المخزون link */}
                        {isStock && lowStockCount > 0 && (
                          <span style={{ marginRight:'auto', background:'#ef4444', color:'white', fontSize:'9px', fontWeight:'900', padding:'2px 6px', borderRadius:'99px', flexShrink:0 }}>
                            {lowStockCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="sidebar-label-text" style={{ marginTop:'20px', padding:'12px', background:'#f0f9ff', borderRadius:'14px', border:'1px solid #bae6fd' }}>
            <div style={{ fontSize:'11px', fontWeight:'800', color:'#0369a1', marginBottom:'8px' }}>
               {t('layout.sidebar.support')}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <button onClick={() => window.api?.openExternal?.('https://wa.me/966533174895')} style={supportBtnStyle}>
                 {t('layout.sidebar.whatsapp')}
              </button>
              <button onClick={() => window.api?.openExternal?.('mailto:ea.gaber10@gmail.com')} style={supportBtnStyle}>
                 {t('layout.sidebar.email')}
              </button>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div style={{ padding:'12px 8px', borderTop:'1px solid #f1f5f9', background:'#fafafa', flexShrink:0 }}>
          <div className="sidebar-label-text" style={{ display:'flex', justifyContent:'center', marginBottom:'8px' }}>
            <span style={{ fontSize:'10px', fontWeight:'900', padding:'3px 10px', borderRadius:'99px', background: String(role || '').toLowerCase() === 'admin' ? '#eff6ff' : '#f0fdf4', color: String(role || '').toLowerCase() === 'admin' ? '#2563eb' : '#16a34a', border: `1px solid ${String(role || '').toLowerCase() === 'admin' ? '#bfdbfe' : '#bbf7d0'}` }}>
              {String(role || '').toLowerCase() === 'admin' ? t('layout.sidebar.roles.admin') : String(role || '').toLowerCase() === 'manager' ? t('layout.sidebar.roles.manager') : t('layout.sidebar.roles.cashier')}
            </span>
          </div>
          <button onClick={() => navigate('/shift?action=close')} style={closeBtnStyle} className="sidebar-label-text">
             {t('layout.sidebar.close_shift')}
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} style={logoutBtnStyle} className="sidebar-label-text">
            ↩ {t('layout.sidebar.logout')}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--bg-app)', minWidth:0 }}>
        <header style={{ padding:'16px 28px', background:'var(--bg-card)', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', items:'center', flexWrap:'wrap', gap:'12px', zIndex:40, flexShrink:0 }}>
          <h1 style={{ fontSize:'20px', fontWeight:'900', color:'var(--text-main)' }}>{title}</h1>
          <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
            
            {/* Global ZATCA Phase 2 Compliance Status Badge */}
            {canAccess('pos.zatca_p2') && (
              zatcaDevice && zatcaDevice.production_csid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#10b981', background: '#ecfdf5', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '99px' }}>
                  <span style={{ display:'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  <span>️ {t('layout.header.zatca_linked')}</span>
                </div>
              ) : (
                <button 
                  onClick={() => navigate('/settings')} 
                  className="active-press" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '99px', cursor: 'pointer', fontFamily: 'inherit', borderStyle: 'solid' }}
                >
                  <span style={{ display:'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 2s infinite' }}></span>
                  <span>️ {t('layout.header.zatca_unlinked')}</span>
                </button>
              )
            )}

            {/* ZATCA STATUS WIDGET */}
            {(zatcaQueue.pending > 0 || zatcaQueue.failed > 0) && (
              <div style={{ 
                display:'flex', alignItems:'center', gap:'12px', padding:'6px 12px', 
                background: zatcaQueue.failed > 0 ? '#fef2f2' : '#eff6ff', 
                border: `1px solid ${zatcaQueue.failed > 0 ? '#fecaca' : '#bfdbfe'}`,
                borderRadius:'99px' 
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:'800', color:'#1e40af' }}>
                  <span style={{ display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', background:'#3b82f6', animation:'pulse 2s infinite' }}></span>
                  {t('layout.header.syncing', { count: zatcaQueue.pending })}
                </div>
                {zatcaQueue.failed > 0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:'800', color:'#b91c1c', borderRight:'1px solid #fecaca', paddingRight:'12px' }}>
                    ️ {t('layout.header.failed', { count: zatcaQueue.failed })}
                    <button onClick={() => window.api.retryZatcaQueue()} style={{ background:'transparent', border:'none', color:'#b91c1c', cursor:'pointer', textDecoration:'underline', fontSize:'10px' }}>{t('layout.header.retry')}</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'13px', color:'var(--text-main)', fontWeight:'800' }}>
                {formatDate(new Date(), { weekday:'long', day:'numeric', month:'long' })}
              </div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'600' }}>{branchName}</div>
            </div>
          </div>
        </header>
        <UpgradeBanner />
        <ZatcaQueueBanner />
        {/* Page Scroll Zone */}
        <div id="main-content-zone" style={{ flex:1, overflowY:'auto', overflowX:'hidden', position:'relative', minHeight:0, display:'flex', flexDirection:'column' }}>
          <div className="p-4 md:p-7" style={{ maxWidth:'1400px', margin:'0 auto', width:'100%', flex:1, display:'flex', flexDirection:'column' }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

const closeBtnStyle = { display:'flex', alignItems:'center', gap:'10px', padding:'10px 10px', borderRadius:'10px', border:'1px solid #fee2e2', cursor:'pointer', fontWeight:'700', fontSize:'12px', width:'100%', textAlign:'right', fontFamily:'inherit', background:'white', color:'#ef4444', marginBottom:'6px', transition:'all 0.2s' };
const logoutBtnStyle = { display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', borderRadius:'10px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'12px', width:'100%', textAlign:'right', fontFamily:'inherit', color:'#94a3b8', background:'transparent' };
const supportBtnStyle = { width:'100%', padding:'8px', background:'white', border:'1px solid #bae6fd', borderRadius:'10px', cursor:'pointer', fontSize:'11px', fontWeight:'700', color:'#0369a1', textAlign:'right', fontFamily:'inherit', transition:'all 0.2s' };
