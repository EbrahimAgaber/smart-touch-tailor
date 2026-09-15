import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { TrendingUp, TrendingDown, Package, Users, ArrowUpRight, Shield, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useCanAccess } from '../store/useLicenseStore';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasCustomers = useCanAccess('customers');
  const [stats, setStats] = useState({ todaySales:0, todayVat:0, todayExpenses:0, netProfit:0, lowStockCount:0, totalCustomers:0 });
  const [yesterday, setYesterday] = useState({ sales:0, expenses:0 });
  const [recentSales, setRecentSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isManagerMode, setIsManagerMode] = useState(false);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    if (!window.api) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const startTimeline = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [report, expenses, customers, menu, sales, yday, timelineData] = await Promise.all([
        window.api.getFinancialReport({ startDate: today, endDate: today }),
        window.api.getExpenditures({ startDate: today, endDate: today }),
        window.api.getCustomers(),
        window.api.getMenu(),
        window.api.getSalesHistory({ limit: 8 }),
        window.api.getYesterdayStats(),
        window.api.getFinancialTimeline({ startDate: startTimeline, endDate: today })
      ]);

      const totalExp = Number(report?.expenses || 0);
      const lowStockCount = Array.isArray(menu) ? menu.filter(m => !m.IsService && Number(m.Stock||0) <= (m.MinStockLevel || 5)).length : 0;
      const totalSales = Number(report?.totalSales || 0);
      const grossProfit = Number(report?.grossProfit || 0);
      const netProfit = Number(report?.netProfit || 0);

      setStats({
        todaySales: totalSales,
        todayVat: Number(report?.vatOutput || 0),
        todayExpenses: totalExp,
        grossProfit,
        netProfit,
        grossMarginPct: Number(report?.grossMarginPct || 0),
        netMarginPct: Number(report?.netMarginPct || 0),
        lowStockCount,
        totalCustomers: Array.isArray(customers) ? customers.length : 0,
      });
      setYesterday({ sales: yday?.sales || 0, expenses: yday?.expenses || 0 });
      setRecentSales(Array.isArray(sales) ? sales : []);
      setTopProducts(Array.isArray(report?.topProducts) ? report.topProducts.slice(0,5) : []);
      setTimeline(Array.isArray(timelineData) ? timelineData : []);
    } catch (e) { console.error('Dashboard error:', e); }
    setLoading(false);
  };

  const trendPct = (today, yest) => {
    if (!yest || yest === 0) return today > 0 ? '+جديد' : null;
    const pct = ((today - yest) / yest * 100).toFixed(0);
    return (pct >= 0 ? '+' : '') + pct + '%';
  };

  const salesTrend  = trendPct(stats.todaySales, yesterday.sales);
  const profitTrend = trendPct(stats.netProfit, yesterday.sales - yesterday.expenses);

  return (
    <AppLayout title={t('dashboard.title')}>
      <div style={{ display:'flex', flexDirection:'column', gap:'28px', flex:1, minHeight:0 }}>

        {/* ── Top bar: subtitle + manager mode toggle ── */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', fontWeight:'700' }}>{t('dashboard.subtitle')}</p>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'var(--bg-card)', padding:'6px 12px', borderRadius:'12px', border:'1px solid var(--border-subtle)', flexShrink:0 }}>
            <span style={{ fontSize:'12px', fontWeight:'800', color: isManagerMode ? '#3b82f6' : '#94a3b8' }}>
              {isManagerMode ? t('dashboard.manager_mode_active') : t('dashboard.view_mode')}
            </span>
            <button onClick={() => setIsManagerMode(!isManagerMode)}
              style={{ width:'40px', height:'20px', background: isManagerMode ? '#3b82f6' : '#cbd5e1', borderRadius:'20px', position:'relative', border:'none', cursor:'pointer', transition:'0.3s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:'2px', left: isManagerMode ? '22px' : '2px', width:'16px', height:'16px', background:'white', borderRadius:'50%', transition:'0.3s' }}/>
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid gap-5" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <KpiCard title={t('dashboard.kpi.today_sales')} value={`SAR ${stats.todaySales.toLocaleString()}`}
            trend={salesTrend} icon={<TrendingUp size={22}/>} color="#3b82f6" loading={loading}/>

          {isManagerMode ? (
            <KpiCard title={t('dashboard.kpi.net_profit')} value={`SAR ${stats.netProfit.toLocaleString()}`}
              trend={profitTrend} subtitle={t('dashboard.kpi.net_margin', { val: stats.netMarginPct?.toFixed(1) })}
              icon={stats.netProfit >= 0 ? <TrendingUp size={22}/> : <TrendingDown size={22}/>}
              color={stats.netProfit >= 0 ? '#10b981' : '#ef4444'} loading={loading}/>
          ) : (
            <KpiCard title={t('dashboard.kpi.invoice_count')} value={recentSales.length}
              subtitle={t('dashboard.kpi.processed_today')} icon={<ArrowUpRight size={22}/>} color="#10b981" loading={loading}/>
          )}

          <KpiCard title={t('dashboard.kpi.stock_alerts')} value={stats.lowStockCount}
            subtitle={t('dashboard.kpi.needs_restock')} icon={<Package size={22}/>} color="#f59e0b" loading={loading}/>
          <KpiCard title={t('dashboard.kpi.total_customers')} value={stats.totalCustomers}
            icon={<Users size={22}/>} color="#8b5cf6" loading={loading}/>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(300px,380px)] gap-6">

          {/* LEFT: charts + table */}
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            <div style={dashCard}>
              <h3 style={cardTitle}>{t('dashboard.sales_chart')}</h3>
              <div style={{ height:'260px', width:'100%', minWidth:0, direction:'ltr' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top:10, right:30, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)"/>
                    <XAxis dataKey="period" tick={{ fontSize:11, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={val => `SAR ${val}`}/>
                    <Tooltip contentStyle={{ background:'var(--bg-card)', borderRadius:'12px', border:'1px solid var(--border-subtle)', color:'var(--text-main)', boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}/>
                    <Area type="monotone" dataKey="total_sales" name={t('dashboard.sales_series')} stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={dashCard}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right', minWidth:'400px' }}>
                  <thead style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                    <tr>{[t('dashboard.table.transaction_no'),t('dashboard.table.time'),t('dashboard.table.customer'),t('dashboard.table.value'),t('dashboard.table.status')].map(h =>
                      <th key={h} style={{ padding:'10px 0', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase' }}>{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {recentSales.slice(0,6).map((s,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                        <td style={{ padding:'12px 0', fontSize:'13px', fontWeight:'700', color:'#3b82f6' }}>#{s.invoice}</td>
                        <td style={{ padding:'12px 0', fontSize:'12px', color:'var(--text-muted)' }}>{new Date(s.sale_date).toLocaleTimeString('ar-SA',{ hour:'2-digit', minute:'2-digit' })}</td>
                        <td style={{ padding:'12px 0', fontSize:'13px', color:'var(--text-main)' }}>{s.customer_name || t('dashboard.table.cash_general')}</td>
                        <td style={{ padding:'12px 0', fontWeight:'800', color:'var(--text-main)' }}>SAR {Number(s.total||0).toFixed(2)}</td>
                        <td style={{ padding:'12px 0' }}>
                          <span style={{ padding:'4px 10px', borderRadius:'99px', fontSize:'10px', fontWeight:'800', background: s.status==='void' ? '#fef2f2' : '#ecfdf5', color: s.status==='void' ? '#ef4444' : '#10b981' }}>
                            {s.status==='void' ? t('dashboard.table.voided') : t('dashboard.table.executed')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT: widgets */}
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            {/* ── ZATCA Compliance Card ── */}
            <ZatcaDashboardCard navigate={navigate}/>

            {/* ── Stock alerts ── */}
            <div style={{ ...dashCard, background:'linear-gradient(180deg, #1e293b, #0f172a)', color:'white', border:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
                <div style={{ width:'32px', height:'32px', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Package size={18}/>
                </div>
                <h3 style={{ fontSize:'15px', fontWeight:'800' }}>{t('dashboard.widgets.critical_stock', { count: stats.lowStockCount })}</h3>
              </div>
              {stats.lowStockCount === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:'13px' }}>{t('dashboard.widgets.all_available')}</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', lineHeight:'1.5' }}>{t('dashboard.widgets.stock_warning')}</p>
                  <button onClick={() => navigate('/stock')} style={{ padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'10px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', fontSize:'13px' }}>
                    {t('dashboard.widgets.manage_stock')}
                  </button>
                </div>
              )}
            </div>

            {/* ── Top products ── */}
            <div style={dashCard}>
              <h3 style={cardTitle}>{t('dashboard.widgets.top_selling')}</h3>
              <div style={{ height:'200px', width:'100%', minWidth:0, direction:'ltr' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top:0, right:30, left:20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)"/>
                    <XAxis type="number" hide/>
                    <YAxis dataKey="item_name" type="category" width={80} tick={{ fontSize:11, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}/>
                    <Tooltip cursor={{ fill:'transparent' }} contentStyle={{ background:'var(--bg-card)', borderRadius:'12px', border:'1px solid var(--border-subtle)', color:'var(--text-main)', boxShadow:'0 4px 20px rgba(0,0,0,0.2)', textAlign:'right' }}/>
                    <Bar dataKey="qtySold" name={t('dashboard.widgets.qty_sold')} radius={[0,4,4,0]} barSize={16}>
                      {topProducts.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899'][index % 5]}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Customers quick stat ── */}
            {hasCustomers ? (
              <div style={{ ...dashCard, background:'rgba(99,102,241,0.05)', border:'1px solid var(--primary)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ fontSize:'24px' }}>⭐</div>
                  <div>
                    <div style={{ fontSize:'11px', color:'var(--primary)', fontWeight:'800' }}>{t('dashboard.widgets.customer_base')}</div>
                    <div style={{ fontSize:'16px', fontWeight:'900', color:'var(--text-main)' }}>{t('dashboard.widgets.registered_customer', { count: stats.totalCustomers })}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ ...dashCard, opacity: 0.85, background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ fontSize:'20px' }}>🔒</div>
                  <div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'800' }}>{t('dashboard.widgets.crm')}</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop: '2px' }}>{t('dashboard.widgets.growth_plan')}</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── ZATCA Compliance Dashboard Card ──────────────────────────────────────────
// Renders a persistent ZATCA compliance card in the dashboard right column.
// States handled:
//   1. Loading — spinner while data arrives
//   2. Not onboarded — device is null OR has no production_csid → CTA to settings
//   3. Nominal — queue counters, acceptance rate bar, cert expiry
//   4. Error — rejected invoices with inline retry button
function ZatcaDashboardCard({ navigate }) {
  const { t } = useTranslation();
  const hasZatcaP2 = useCanAccess('pos.zatca_p2');
  const [queue,    setQueue]    = useState(null);
  const [device,   setDevice]   = useState(undefined); // undefined = still loading
  const [retrying, setRetrying] = useState(false);
  const [phase,    setPhase]    = useState('phase_2');

  const refresh = useCallback(async () => {
    try {
      const [q, d, s] = await Promise.all([
        // Support both invoke-style and direct method
        (window.api.getZatcaQueueStatus?.() ??
         window.api.invoke?.('zatca:getQueueStatus')),
        window.api.getZatcaDevice?.(),
        window.api.getSettings?.()
      ]);
      if (q !== undefined) setQueue(q || null);
      // d can be null (not onboarded) or an object — both are valid
      setDevice(d ?? null);
      if (s) setPhase(s.zatca_phase || 'phase_2');
    } catch {
      setDevice(null); // treat fetch error as not-onboarded
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await (window.api.invoke?.('zatca:retryQueue') ??
             window.api.retryZatcaQueue?.());
      await refresh();
    } catch {}
    setRetrying(false);
  };

  if (phase !== 'phase_2') {
    return null;
  }

  if (!hasZatcaP2) {
    return (
      <div style={{ ...dashCard, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-card)', opacity: 0.85 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '32px', height: '32px', background: 'rgba(245,158,11,0.15)', color: '#b45309', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔒
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>{t('dashboard.zatca.title')}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('dashboard.zatca.requires_growth')}</div>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '12px' }}>
          {t('dashboard.zatca.inactive_desc')}
        </p>
        <button onClick={() => navigate('/subscription-hub')}
          style={{ padding: '8px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', width: '100%' }}>
          {t('dashboard.zatca.upgrade_now')}
        </button>
      </div>
    );
  }

  // ── State 1: Still loading ────────────────────────────────────────────
  if (device === undefined) {
    return (
      <div style={{ ...dashCard, display:'flex', alignItems:'center', gap:'12px', padding:'20px' }}>
        <div style={{ width:'32px', height:'32px', background:'#eff6ff', color:'#93c5fd', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Shield size={17}/>
        </div>
        <div>
          <div style={{ fontSize:'14px', fontWeight:'800', color:'var(--text-main)' }}>{t('dashboard.zatca.compliance')}</div>
          <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>{t('dashboard.zatca.loading')}</div>
        </div>
      </div>
    );
  }

  // ── State 2: Not onboarded ────────────────────────────────────────────
  // device is null (no record) or exists but has no production_csid
  if (!device || !device.production_csid) {
    return (
      <div style={{ ...dashCard, border: '1px solid rgba(226, 232, 240, 0.6)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={17} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>{t('dashboard.zatca.title')}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('dashboard.zatca.not_linked')}</div>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '14px' }}>
          {t('dashboard.zatca.link_desc')}
        </p>
        <button onClick={() => navigate('/settings')}
          style={{ padding: '8px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%', transition: 'background-color 0.15s ease' }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--primary-dark)'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
        >
          {t('dashboard.zatca.go_to_settings')}
        </button>
      </div>
    );
  }

  // ── State 3 & 4: Onboarded — show queue + acceptance ─────────────────
  const pending   = queue?.pendingCount  || 0;
  const reported  = queue?.reportedCount || 0;
  const rejected  = queue?.rejectedCount || 0;
  const total     = pending + reported + rejected;
  const acceptPct = total > 0 ? Math.round((reported / total) * 100) : 100;
  const hasFailed = rejected > 0;
  const isHalted  = queue?.isHalted;

  // Cert expiry — backend may use either field name
  const certExpiry = device.cert_expires_at || device.pcsid_expires_at || device.certExpiresAt || null;

  return (
    <div style={{
      ...dashCard,
      border: hasFailed
        ? '1.5px solid #fca5a5'
        : '1px solid var(--border-subtle)',
    }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'32px', height:'32px', background: hasFailed ? '#fef2f2' : '#ecfdf5', color: hasFailed ? '#ef4444' : '#10b981', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Shield size={17}/>
          </div>
          <div>
            <div style={{ fontSize:'14px', fontWeight:'800', color:'var(--text-main)' }}>{t('dashboard.zatca.compliance')}</div>
            <div style={{ fontSize:'11px', color:'#64748b', marginTop:'1px' }}>
              {device.device_id ? t('dashboard.zatca.device', { id: device.device_id }) : t('dashboard.zatca.refreshes')}
            </div>
          </div>
        </div>
        <span style={{
          padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:'800', flexShrink:0,
          background: hasFailed ? '#fef2f2' : (isHalted ? '#fffbeb' : '#ecfdf5'),
          color:       hasFailed ? '#b91c1c' : (isHalted ? '#92400e' : '#065f46'),
        }}>
          {hasFailed ? t('dashboard.zatca.rejected_badge') : isHalted ? t('dashboard.zatca.halted_badge') : t('dashboard.zatca.active_badge')}
        </span>
      </div>

      {/* ── Queue counters ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
        {[
          { label: t('dashboard.zatca.pending'),  val: pending,  bg:'#fffbeb', color:'#92400e'  },
          { label: t('dashboard.zatca.reported'), val: reported, bg:'#ecfdf5', color:'#065f46' },
          { label: t('dashboard.zatca.rejected'), val: rejected, bg:'#fef2f2', color:'#b91c1c'  },
        ].map(s => (
          <div key={s.label} style={{ padding:'10px 8px', background:s.bg, borderRadius:'10px', textAlign:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'900', color:s.color }}>{s.val}</div>
            <div style={{ fontSize:'10px', color:s.color, marginTop:'2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Acceptance rate bar ── */}
      {total > 0 && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', fontSize:'11px', color:'#64748b' }}>
            <span>{t('dashboard.zatca.acceptance_rate')}</span>
            <span style={{ fontWeight:'800', color: acceptPct === 100 ? '#10b981' : acceptPct >= 95 ? '#f59e0b' : '#ef4444' }}>
              {acceptPct}%
            </span>
          </div>
          <div style={{ height:'5px', background:'#f1f5f9', borderRadius:'99px', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:'99px',
              background: acceptPct === 100 ? '#10b981' : acceptPct >= 95 ? '#f59e0b' : '#ef4444',
              width: `${acceptPct}%`, transition:'width 0.5s ease'
            }}/>
          </div>
        </div>
      )}

      {/* ── Error state: inline retry ── */}
      {hasFailed && (
        <div style={{ padding:'10px 12px', background:'#fef2f2', borderRadius:'10px', border:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
          <span style={{ fontSize:'12px', color:'#b91c1c', fontWeight:'700' }}>
            {t('dashboard.zatca.rejected_invoices', { count: rejected, status: isHalted ? t('dashboard.zatca.halted') : t('dashboard.zatca.active') })}
          </span>
          <button onClick={handleRetry} disabled={retrying}
            style={{ padding:'7px 14px', background:'#ef4444', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'12px', display:'flex', alignItems:'center', gap:'6px', fontFamily:'inherit', opacity: retrying ? 0.7 : 1, flexShrink:0 }}>
            <RefreshCw size={13}/> {retrying ? t('dashboard.zatca.processing') : t('dashboard.zatca.retry')}
          </button>
        </div>
      )}

      {/* ── Certificate expiry ── */}
      {certExpiry && (
        <div style={{ fontSize:'11px', color:'#64748b', display:'flex', alignItems:'center', gap:'5px' }}>
          <CheckCircle2 size={12} color="#10b981"/>
          {t('dashboard.zatca.cert_valid', { date: new Date(certExpiry).toLocaleDateString('ar-SA') })}
        </div>
      )}

      {/* ── Deep link to settings ── */}
      <button onClick={() => navigate('/settings')}
        style={{ background:'transparent', border:'none', color:'#3b82f6', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', textAlign:'right', padding:0, display:'flex', alignItems:'center', gap:'4px' }}>
        {t('dashboard.zatca.detailed_settings')}
      </button>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ title, value, trend, subtitle, icon, color, loading }) {
  const isPos = trend && trend.startsWith('+');
  return (
    <div style={{ 
      background: 'var(--bg-card)', 
      padding: '24px', 
      borderRadius: '20px', 
      border: '1px solid rgba(226, 232, 240, 0.6)', 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      position: 'relative', 
      textAlign: 'center',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
    }}
    onMouseOver={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)';
    }}
    onMouseOut={e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
    }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        background: `${color}15`, 
        color: color, 
        borderRadius: '50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: '12px' 
      }}>
        {icon}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '6px', textTransform: 'uppercase' }}>
        {title}
      </div>

      <div style={{ 
        fontSize: '26px', 
        fontWeight: '900', 
        color: 'var(--text-main)', 
        fontFamily: "'Inter', sans-serif", 
        lineHeight: 1.2,
        opacity: loading ? 0.4 : 1 
      }}>
        {value}
      </div>

      {trend && (
        <div style={{ 
          background: isPos ? '#ecfdf5' : '#fef2f2', 
          color: isPos ? '#10b981' : '#ef4444', 
          padding: '4px 10px', 
          borderRadius: '99px', 
          fontSize: '11px', 
          fontWeight: '900',
          marginTop: '8px'
        }}>
          {trend}
        </div>
      )}

      {subtitle && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>{subtitle}</div>}
    </div>
  );
}

const dashCard = { background:'var(--bg-card)', padding:'22px', borderRadius:'24px', border:'1px solid var(--border-subtle)', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' };
const cardTitle = { fontSize:'15px', fontWeight:'800', color:'var(--text-main)', marginBottom:'18px' };
