import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useLicenseStore } from './store/useLicenseStore';
import FeatureGate from './components/FeatureGate';
import Login from './pages/Login';
import Shift from './pages/Shift';
import Pos from './pages/Pos';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import TailorPos from './pages/TailorPos';
import Alterations from './pages/Alterations';
import Expenditures from './pages/Expenditures';
import Stock from './pages/Stock';
import MenuAdmin from './pages/MenuAdmin';
import FinanceHub from './pages/FinanceHub';
import FinanceHubP2 from './pages/FinanceHubP2';
import SalesHistory from './pages/SalesHistory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Tables from './pages/Tables';
import KDS from './pages/KDS';
import Staff from './pages/Staff';
import AuditLogs from './pages/AuditLogs';
import Promotions from './pages/Promotions';
import Services from './pages/Services';
import OrdersBoard from './pages/OrdersBoard';
import MeasurementCapture from './pages/MeasurementCapture';
import CustomerMenu from './pages/CustomerMenu';
import CustomerOrderTracker from './pages/CustomerOrderTracker';
import FabricRemnants from './pages/FabricRemnants';
import Sponsors from './pages/Sponsors';
import CustomerDisplay from './pages/CustomerDisplay';
import Onboarding from './pages/Onboarding';
import SubscriptionHub from './pages/SubscriptionHub';
import Home from './pages/Home';
import SecurityGuard from './components/SecurityGuard';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import { ToastProvider } from './components/ToastManager';
import './styles/index.css';
// useSubscriptionStore is no longer imported in App.jsx — it is only used
// inside SubscriptionHub.jsx where simulation is purely a display concern.

// ── Global Date Formatting Override ─────────────────────────────────────────
const originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function(locale, options) {
  if (locale === 'ar-SA' || !locale) {
    const format = window.__dateFormat__ || 'hijri';
    const calendar = format === 'gregorian' ? 'gregory' : 'islamic-umalqura';
    return originalToLocaleDateString.call(this, 'ar-SA', { calendar, ...options });
  }
  return originalToLocaleDateString.call(this, locale, options);
};

const originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function(locale, options) {
  if (locale === 'ar-SA' || !locale) {
    const format = window.__dateFormat__ || 'hijri';
    const calendar = format === 'gregorian' ? 'gregory' : 'islamic-umalqura';
    return originalToLocaleString.call(this, 'ar-SA', { calendar, ...options });
  }
  return originalToLocaleString.call(this, locale, options);
};

// ── Global settings context ────────────────────────────────────────────────
import { createContext, useContext, useCallback } from 'react';

const SettingsCtx = createContext({ businessType: 'retail', reloadSettings: () => {} });
export const useAppSettings = () => useContext(SettingsCtx);

// ── Route guards ───────────────────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const role = useAuthStore(s => s.role);
  return role ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { businessType } = useAppSettings();
  const role = String(useAuthStore(s => s.role) || '').toLowerCase();
  if (!role) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to={businessType === 'tailor' ? '/tailor-pos' : '/pos'} replace />;
  return children;
};

const RestaurantRoute = ({ children }) => {
  const { businessType } = useAppSettings();
  const role = useAuthStore(s => s.role);
  if (!role) return <Navigate to="/login" replace />;
  if (businessType !== 'restaurant') return <Navigate to={businessType === 'tailor' ? '/tailor-pos' : '/pos'} replace />;
  return children;
};

// ── Per-page error boundary wrappers ───────────────────────────────────────
const P = ({ children }) => (
  <PrivateRoute><ErrorBoundary>{children}</ErrorBoundary></PrivateRoute>
);
const A = ({ children }) => (
  <AdminRoute><ErrorBoundary>{children}</ErrorBoundary></AdminRoute>
);
const R = ({ children }) => (
  <RestaurantRoute><ErrorBoundary>{children}</ErrorBoundary></RestaurantRoute>
);

// ── License banner component ───────────────────────────────────────────────
// Shown as a persistent top bar when the license is in grace period or expired.
// Grace  → amber warning with countdown (client still has time to re-activate)
// Expired → red hard-block directing client to contact support immediately
function LicenseBanner({ banner, onEnterKey }) {
  if (!banner) return null;

  const isExpired = banner.type === 'expired';

  const bg      = isExpired ? '#dc2626' : '#d97706';   // red-600 / amber-600
  const bgLight = isExpired ? '#fef2f2' : '#fffbeb';
  const border  = isExpired ? '#fca5a5' : '#fde68a';
  const text    = isExpired ? '#7f1d1d' : '#78350f';

  // Inline styles: this banner must render even if Tailwind purges its classes
  const barStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 10000,
    background: bg,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '0 20px',
    height: '48px',
    fontFamily: 'inherit',
    fontWeight: '800',
    fontSize: '13px',
    direction: 'rtl',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };

  const iconStyle = { fontSize: '18px', flexShrink: 0 };

  const supportBtnStyle = {
    marginRight: '14px',
    padding: '4px 14px',
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '800',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  };

  const handleSupport = () => {
    window.api?.openExternal?.('https://wa.me/966533174895');
  };

  if (isExpired) {
    return (
      <div style={barStyle}>
        <span style={iconStyle}>🔴</span>
        <span>انتهت صلاحية الترخيص — النظام في وضع القراءة فقط. تواصل مع الدعم الفني لتجديد الاشتراك.</span>
        <button style={supportBtnStyle} onClick={handleSupport}>تواصل الآن</button>
      </div>
    );
  }

  // Grace period banner
  const h = banner.hoursLeft ?? 48;
  const hoursText = h <= 1 ? 'أقل من ساعة' : `${h} ساعة`;

  // Also show a softer "days left" variant when it's a normal expiry warning
  // (daysLeft is passed from App via the grace event when hoursLeft > 0)
  if (banner.daysLeft !== undefined && banner.daysLeft > 0) {
    return (
      <div style={barStyle}>
        <span style={iconStyle}>⚠️</span>
        <span>
          تحذير: صلاحية الترخيص ستنتهي خلال{' '}
          <strong>{banner.daysLeft} {banner.daysLeft === 1 ? 'يوم' : 'أيام'}</strong>.
          {' '}يرجى التواصل مع الدعم للحصول على رمز التجديد.
        </span>
        <button style={supportBtnStyle} onClick={handleSupport}>احصل على الرمز</button>
        {onEnterKey && <button style={{ ...supportBtnStyle, background:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.6)' }} onClick={onEnterKey}>⌨️ أدخل الرمز</button>}
      </div>
    );
  }

  return (
    <div style={barStyle}>
      <span style={iconStyle}>⚠️</span>
      <span>
        تحديث النظام يتطلب رمز تنشيط جديد — لديك{' '}
        <strong>{hoursText}</strong>
        {' '}لإدخال الرمز قبل تعليق عمليات الكتابة. تواصل مع الدعم للحصول على الرمز.
      </span>
      <button style={supportBtnStyle} onClick={handleSupport}>احصل على الرمز</button>
      {onEnterKey && <button style={{ ...supportBtnStyle, background:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.6)' }} onClick={onEnterKey}>⌨️ أدخل الرمز الآن</button>}
    </div>
  );
}

export default function App() {
  const [businessType, setBusinessType] = useState('tailor'); // STRICTLY FORCED TO TAILOR
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  // null = no banner | { type: 'grace', hoursLeft } | { type: 'expired' } | { type: 'days', daysLeft }
  const [licenseBanner, setLicenseBanner] = useState(null);
  const forceReactivate = useLicenseStore(s => s.forceReactivate);
  const setForceReactivate = useLicenseStore(s => s.setForceReactivate);

  const loadSettings = useCallback(async () => {
    if (!window.api?.getSettings) {
      window.__vatRate__ = 0.15;
      setLoading(false);
      return;
    }
    try {
      const s = await window.api.getSettings();
      setBusinessType('tailor'); // STRICTLY FORCED TO TAILOR
      if (!s?.business_name_ar) setNeedsOnboarding(true);
      window.__vatRate__ = parseFloat(s?.vat_rate || '0.15');
      window.__dateFormat__ = s?.date_format || 'hijri';
    } catch (err) {
      console.error('App Settings Load Error:', err);
      window.__vatRate__ = 0.15;
      window.__dateFormat__ = 'hijri';
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Settings reload effect ─────────────────────────────────────────────
  useEffect(() => {
    loadSettings();
    const handler = () => loadSettings();
    window.addEventListener('app:settings-updated', handler);
    return () => window.removeEventListener('app:settings-updated', handler);
  }, [loadSettings]);

  // ── Load license tier once on mount ───────────────────────────────────────
  useEffect(() => {
    useLicenseStore.getState().loadLicense();
  }, []);

  // ── Restore Backend Session on Reload ─────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      const user = useAuthStore.getState().currentUser;
      if (user && window.api?.setSession) {
        await window.api.setSession(user);
      }
    };
    restoreSession();
  }, []);

  // ── Session expiry ─────────────────────────────────────────────────────
  useEffect(() => {
    if (window.api?.onSessionExpired) {
      window.api.onSessionExpired(() => {
        useAuthStore.getState().logout();
        window.location.hash = '#/login';
      });
    }
  }, []);

  // ── License grace / expiry push events from main process ──────────────
  useEffect(() => {
    // On mount: check if we're already inside a grace period (app may have
    // restarted mid-grace — main process pushes the event 2s after launch,
    // but poll once immediately to avoid a flash of no-banner).
    window.api?.getLicenseGraceStatus?.().then(status => {
      if (status?.active) {
        setLicenseBanner({ type: 'grace', hoursLeft: status.hoursLeft });
      }
    }).catch(() => {});

    // Grace period started or still active
    const unlistenGrace = window.api?.onLicenseGrace?.(({ hoursLeft }) => {
      setLicenseBanner({ type: 'grace', hoursLeft: hoursLeft ?? 48 });
    });

    // Grace period expired — write IPC is now blocked
    const unlistenExpired = window.api?.onLicenseExpired?.(() => {
      setLicenseBanner({ type: 'expired' });
    });

    // When a valid new key is activated, SecurityGuard re-mounts children,
    // App re-renders, and the banner clears because licenseBanner resets to null.

    return () => {
      unlistenGrace?.();
      unlistenExpired?.();
    };
  }, []);

  if (loading) return null;

  // Banner adds 48px to the top — shift the entire app down to avoid overlap
  const hasBanner = !!licenseBanner;
  const settingsValue = { businessType, reloadSettings: loadSettings };

  return (
    <SettingsCtx.Provider value={settingsValue}>
      <ToastProvider>
        <SecurityGuard forceReactivate={forceReactivate} onReactivated={() => { setForceReactivate(false); setLicenseBanner(null); }}>
          {/* ── License banner (grace or expired) ── */}
          <LicenseBanner banner={licenseBanner} onEnterKey={() => setForceReactivate(true)} />

          {/* Version watermark */}
          <div style={{
            position: 'fixed',
            bottom: 5, left: 5,
            fontSize: '9px',
            color: 'rgba(0,0,0,0.2)',
            zIndex: 9999,
            pointerEvents: 'none',
            // shift up if banner is present so it's not hidden under it
            top: hasBanner ? 'auto' : undefined,
          }}>
            {import.meta.env.VITE_APP_VERSION || 'v2'}
          </div>

          <OfflineBanner />

          {/* Push the app content down so banner doesn't overlap the nav */}
          <div style={{ paddingTop: hasBanner ? '48px' : '0' }}>
            <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                {/* ── Public ── */}
                <Route path="/login"            element={<ErrorBoundary><Login /></ErrorBoundary>} />
                <Route path="/onboarding"       element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
                <Route path="/customer-display" element={<CustomerDisplay />} />

                {/* ── Shift ── */}
                <Route path="/shift"            element={<P><Shift /></P>} />
                <Route path="/home"             element={<P><Home /></P>} />

                {/* ── POS ── */}
                <Route path="/pos"              element={<P><Pos /></P>} />

                {/* ── Customer-facing ── */}
                <Route path="/customers"        element={<P><FeatureGate feature="customers"><Customers /></FeatureGate></P>} />
                <Route path="/sponsors"         element={<P><Sponsors /></P>} />
                <Route path="/services"         element={<P><Services /></P>} />
                
                {/* ── Public Customer Self-Service Tracking ── */}
                <Route path="/track"            element={<CustomerOrderTracker />} />
                <Route path="/track/:orderId"   element={<CustomerOrderTracker />} />

                {/* ── Tailor-specific ── */}
                <Route path="/tailor-pos"       element={<P><TailorPos /></P>} />
                <Route path="/alterations"       element={<P><Alterations /></P>} />
                <Route path="/orders-board"     element={<P><OrdersBoard /></P>} />
                <Route path="/measurements"     element={<P><MeasurementCapture /></P>} />
                <Route path="/fabric-remnants"  element={<P><FabricRemnants /></P>} />
                <Route path="/customer-menu"    element={<CustomerMenu />} />

                {/* ── Admin-only ── */}
                <Route path="/dashboard"        element={<A><FeatureGate feature="dashboard"><Dashboard /></FeatureGate></A>} />
                <Route path="/settings"         element={<A><Settings /></A>} />
                <Route path="/expenditures"     element={<A><FeatureGate feature="expenditures"><Expenditures /></FeatureGate></A>} />
                <Route path="/stock"            element={<A><Stock /></A>} />
                <Route path="/menu-admin"       element={<A><FeatureGate feature="menu_admin"><MenuAdmin /></FeatureGate></A>} />
                <Route path="/finance-hub"      element={<A><FeatureGate feature="finance_hub"><FinanceHub /></FeatureGate></A>} />
                <Route path="/finance-hub-p2"   element={<A><FeatureGate feature="finance_hub_p2"><FinanceHubP2 /></FeatureGate></A>} />
                <Route path="/sales-history"    element={<A><FeatureGate feature="sales_history"><SalesHistory /></FeatureGate></A>} />
                <Route path="/suppliers"        element={<A><FeatureGate feature="suppliers"><Suppliers /></FeatureGate></A>} />
                <Route path="/purchases"        element={<A><FeatureGate feature="purchases"><Purchases /></FeatureGate></A>} />
                <Route path="/staff"            element={<A><FeatureGate feature="staff.multi"><Staff /></FeatureGate></A>} />
                <Route path="/audit-logs"       element={<A><FeatureGate feature="audit_logs"><AuditLogs /></FeatureGate></A>} />
                <Route path="/promotions"       element={<A><FeatureGate feature="promotions"><Promotions /></FeatureGate></A>} />

                {/* ── Restaurant-only ── */}
                <Route path="/tables"           element={<R><FeatureGate feature="tables"><Tables /></FeatureGate></R>} />
                <Route path="/kds"              element={<R><FeatureGate feature="kds"><KDS /></FeatureGate></R>} />

                {/* ── Fallback ── */}
                <Route path="/subscription-hub" element={<A><SubscriptionHub /></A>} />
                <Route path="*" element={
                  needsOnboarding
                    ? <Navigate to="/onboarding" replace />
                    : <Navigate to="/home" replace />
                } />
              </Routes>
            </HashRouter>
          </div>
        </SecurityGuard>
      </ToastProvider>
    </SettingsCtx.Provider>
  );
}
