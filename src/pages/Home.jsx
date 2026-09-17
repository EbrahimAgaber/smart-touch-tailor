import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, can } from '../store/useAuthStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { useAppSettings } from '../App';
import AppLayout from '../components/AppLayout';
import { 
  Scissors, Factory, Users, Package, BarChart3, Settings as SettingsIcon,
  ShoppingCart, Wallet, Award, Clock, ChevronLeft, Fingerprint,
  TrendingUp, CheckCircle2, AlertTriangle, Calendar, Truck, AlertCircle, FileText
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { name: userName, role } = useAuthStore();
  const { canAccess } = useLicenseStore();
  const { businessType } = useAppSettings();

  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ todaySalesCount: 0, todaySalesTotal: 0 });
  const [tailorStats, setTailorStats] = useState(null);
  const [hiddenClicks, setHiddenClicks] = useState(0);

  useEffect(() => {
    async function loadHomeData() {
      if (!window.api) {
        setLoading(false);
        return;
      }
      try {
        const [openShift, sales] = await Promise.all([
          window.api.getOpenShift().catch(() => null),
          window.api.getSalesHistory({ limit: 50 }).catch(() => [])
        ]);
        setShift(openShift);
        if (!openShift) {
          navigate('/shift', { replace: true });
          return;
        }

        // Calculate simple stats for today
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySales = Array.isArray(sales) 
          ? sales.filter(s => s.sale_date.startsWith(todayStr) && s.status !== 'void')
          : [];
        const total = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
        setStats({
          todaySalesCount: todaySales.length,
          todaySalesTotal: total
        });

        // Tailor-specific stats
        if (businessType === 'tailor') {
          try {
            const ts = await window.api?.tailor?.getDashboardStats?.();
            setTailorStats(ts || null);
          } catch { setTailorStats(null); }
        }
      } catch (e) {
        console.error('Failed to load home page data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, [businessType]);

  // Filter launch modules by user permissions and license tier
  const MODULES = businessType === 'tailor' ? [
    {
      id: 'tailor-pos',
      title: 'طلب تفصيل جديد',
      desc: 'استقبال عميل جديد، أخذ المقاسات، وتسجيل الطلب',
      icon: <Scissors size={24} strokeWidth={2.2} />,
      color: '#2563eb',
      path: '/tailor-pos',
      permission: null,
      feature: null
    },
    {
      id: 'orders-board',
      title: 'لوحة إنتاج المعمل',
      desc: 'متابعة مراحل الإنتاج: قص، خياطة، تشطيب، كوي، جاهز',
      icon: <Factory size={24} strokeWidth={2.2} />,
      color: '#059669',
      path: '/orders-board',
      permission: null,
      feature: null
    },
    {
      id: 'customers',
      title: 'العملاء وسجل المقاسات',
      desc: 'إدارة العملاء، عرض بروفايلات المقاسات وسجل الطلبات',
      icon: <Users size={24} strokeWidth={2.2} />,
      color: '#7c3aed',
      path: '/customers',
      permission: null,
      feature: 'customers'
    },
    {
      id: 'stock',
      title: 'مخزون الأقمشة والمواد',
      desc: 'متابعة الأقمشة المتوفرة، كميات الأمتار، وتنبيهات النفاد',
      icon: <Package size={24} strokeWidth={2.2} />,
      color: '#d97706',
      path: '/stock',
      permission: 'view_stock',
      feature: 'stock.view'
    },
    {
      id: 'dashboard',
      title: 'لوحة التحكم والتحليلات',
      desc: 'مراقبة الإيرادات والأرباح والأداء العام للمحل',
      icon: <BarChart3 size={24} strokeWidth={2.2} />,
      color: '#0284c7',
      path: '/dashboard',
      permission: 'view_dashboard',
      feature: 'dashboard'
    },
    {
      id: 'settings',
      title: 'إعدادات النظام',
      desc: 'هوية المنشأة، الطابعات، وربط هيئة الزكاة',
      icon: <SettingsIcon size={24} strokeWidth={2.2} />,
      color: '#475569',
      path: '/settings',
      permission: 'manage_settings',
      feature: null
    },
  ] : [
    {
      id: 'pos',
      title: 'نقطة البيع الكاشير',
      desc: 'بدء عمليات بيع جديدة وإصدار الفواتير الفورية',
      icon: <ShoppingCart size={24} strokeWidth={2.2} />,
      color: '#2563eb',
      path: '/pos',
      permission: null,
      feature: 'pos'
    },
    {
      id: 'dashboard',
      title: 'لوحة التحكم والتحليلات',
      desc: 'مراقبة المبيعات الحية، الأرباح، وتنبيهات المخزون',
      icon: <BarChart3 size={24} strokeWidth={2.2} />,
      color: '#059669',
      path: '/dashboard',
      permission: 'view_dashboard',
      feature: 'dashboard'
    },
    {
      id: 'stock',
      title: 'إدارة المخزون والمنتجات',
      desc: 'مراقبة كميات السلع، أوامر الشراء، والتوريد',
      icon: <Package size={24} strokeWidth={2.2} />,
      color: '#d97706',
      path: '/stock',
      permission: 'view_stock',
      feature: 'stock.view'
    },
    {
      id: 'customers',
      title: 'العملاء والولاء CRM',
      desc: 'إدارة قاعدة بيانات العملاء، النقاط، والمستويات',
      icon: <Users size={24} strokeWidth={2.2} />,
      color: '#7c3aed',
      path: '/customers',
      permission: null,
      feature: 'customers'
    },
    {
      id: 'finance',
      title: 'المركز المالي والمحاسبة',
      desc: 'القيود اليومية، القوائم المالية، وإقرارات الضريبة',
      icon: <TrendingUp size={24} strokeWidth={2.2} />,
      color: '#0284c7',
      path: '/finance-hub',
      permission: 'view_reports',
      feature: 'finance_hub'
    },
    {
      id: 'settings',
      title: 'إعدادات النظام والربط',
      desc: 'إعداد هوية المنشأة، الطابعات، وربط هيئة الزكاة',
      icon: <SettingsIcon size={24} strokeWidth={2.2} />,
      color: '#475569',
      path: '/settings',
      permission: 'manage_settings',
      feature: null
    }
  ];

  const visibleModules = MODULES.filter(m => {
    if (m.permission && !can(m.permission)) return false;
    if (m.feature && !canAccess(m.feature)) return false;
    return true;
  });

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'صباح الخير';
    if (hrs < 18) return 'مساء الخير';
    return 'طاب مساؤك';
  };

  return (
    <AppLayout title="لوحة التشغيل الرئيسية">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', flex: 1 }}>
        
        {/* Welcome Section */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px'
        }}>
          {/* Subtle Watermark */}
          <div style={{ position: 'absolute', left: '-20px', bottom: '-20px', opacity: 0.04, pointerEvents: 'none' }}>
            <Fingerprint size={200} />
          </div>

          <div style={{ zIndex: 2 }}>
            <h2 
              onClick={async () => {
                const c = hiddenClicks + 1;
                setHiddenClicks(c);
                if (c >= 5) {
                  if (window.confirm('تحذير: سيتم إلغاء تنشيط النظام وقفل التطبيق. هل أنت متأكد؟')) {
                    try {
                      await window.api.saveSettings({ activation_key: '' });
                      window.location.reload();
                    } catch(e){}
                  } else {
                    setHiddenClicks(0);
                  }
                }
              }}
              style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default', userSelect: 'none', letterSpacing: '-0.02em' }}
            >
              <span>{getGreeting()}، {userName || 'المستخدم'}</span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '400', margin: 0 }}>
              مرحباً بك في لوحة تشغيل ورديتك الحالية. ابدأ يومك التشغيلي أو تصفح الأقسام السريعة أدناه.
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            zIndex: 2
          }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={18} color="#38bdf8" />
              <div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>صلاحية الحساب</div>
                <div style={{ fontSize: '12.5px', fontWeight: '700' }}>{role === 'Admin' ? 'مدير النظام' : role === 'Manager' ? 'مشرف عام' : 'كاشير نقطة البيع'}</div>
              </div>
            </div>
            {shift && (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color="#10b981" />
                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>بدء الوردية</div>
                  <div style={{ fontSize: '12.5px', fontWeight: '700' }}>{new Date(shift.opened_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KPI Stats — tailor mode vs retail mode */}
        {businessType === 'tailor' && tailorStats ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(37,99,235,0.08)', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <FileText size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize:'11.5px', color:'var(--text-muted)', fontWeight:'600' }}>طلبات اليوم الجديدة</div>
                  <div style={{ fontSize:'22px', fontWeight:'700', color:'var(--text-main)', marginTop:'2px' }} className="font-mono">{tailorStats.newOrdersToday}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(5,150,105,0.08)', color:'#059669', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <TrendingUp size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize:'11.5px', color:'var(--text-muted)', fontWeight:'600' }}>إيراد تفصيل اليوم</div>
                  <div style={{ fontSize:'22px', fontWeight:'700', color:'var(--text-main)', marginTop:'2px' }} className="font-mono">SAR {Number(tailorStats.todayRevenue || 0).toFixed(2)}</div>
                </div>
              </div>
              <button onClick={() => navigate('/orders-board')} style={{ background:'rgba(5,150,105,0.05)', padding:'18px 20px', borderRadius:'14px', border:'1px solid rgba(5,150,105,0.2)', display:'flex', alignItems:'center', gap:'14px', cursor:'pointer', fontFamily:'inherit', textAlign:'right', transition:'all 0.15s ease' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(5,150,105,0.12)', color:'#059669', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <CheckCircle2 size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize:'11.5px', color:'#065f46', fontWeight:'700' }}>جاهز للاستلام والتسليم</div>
                  <div style={{ fontSize:'22px', fontWeight:'700', color:'#059669', marginTop:'2px' }} className="font-mono">{tailorStats.readyForPickup}</div>
                </div>
              </button>
              {tailorStats.overdue > 0 && (
                <button onClick={() => navigate('/orders-board')} style={{ background:'rgba(220,38,38,0.05)', padding:'18px 20px', borderRadius:'14px', border:'1px solid rgba(220,38,38,0.2)', display:'flex', alignItems:'center', gap:'14px', cursor:'pointer', fontFamily:'inherit', textAlign:'right', transition:'all 0.15s ease' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(220,38,38,0.12)', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <AlertTriangle size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div style={{ fontSize:'11.5px', color:'#991b1b', fontWeight:'700' }}>طلبات متأخرة بالمعمل</div>
                    <div style={{ fontSize:'22px', fontWeight:'700', color:'#dc2626', marginTop:'2px' }} className="font-mono">{tailorStats.overdue}</div>
                  </div>
                </button>
              )}
            </div>
            {/* Mulam Control Center Widgets */}
            {businessType === 'tailor' && tailorStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                 <div onClick={() => navigate('/stock')} style={{ cursor:'pointer', background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '14px', border: tailorStats.lowFabrics > 0 ? '1px solid rgba(217,119,6,0.3)' : '1px solid var(--border-subtle)', boxShadow:'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px', transition:'all 0.15s ease' }}>
                   <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'rgba(217,119,6,0.08)', color:'#d97706', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                     <AlertCircle size={20} strokeWidth={2.2} />
                   </div>
                   <div>
                     <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'600' }}>أقمشة قاربت على النفاد</div>
                     <div style={{ fontSize:'18px', fontWeight:'700', color: tailorStats.lowFabrics > 0 ? '#d97706' : 'var(--text-main)', marginTop:'2px' }} className="font-mono">{tailorStats.lowFabrics} طاقة</div>
                   </div>
                 </div>
                 <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow:'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                   <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'rgba(37,99,235,0.08)', color:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                     <Calendar size={20} strokeWidth={2.2} />
                   </div>
                   <div>
                     <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'600' }}>بروفات مجدولة اليوم</div>
                     <div style={{ fontSize:'18px', fontWeight:'700', color:'var(--text-main)', marginTop:'2px' }} className="font-mono">{tailorStats.todayFittings}</div>
                   </div>
                 </div>
                 <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow:'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                   <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'rgba(124,58,237,0.08)', color:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                     <Truck size={20} strokeWidth={2.2} />
                   </div>
                   <div>
                     <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'600' }}>شحنات موردين (٧ أيام)</div>
                     <div style={{ fontSize:'18px', fontWeight:'700', color:'var(--text-main)', marginTop:'2px' }} className="font-mono">{tailorStats.recentDeliveries} استلام</div>
                   </div>
                 </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            {shift && (
              <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow:'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink:0 }}>
                  <Wallet size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>الرصيد الافتتاحي للدرج</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }} className="font-mono">SAR {parseFloat(shift.starting_cash || 0).toFixed(2)}</div>
                </div>
              </div>
            )}
            <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow:'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.08)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink:0 }}>
                <Award size={22} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>مبيعات اليوم المحققة</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }} className="font-mono">SAR {stats.todaySalesTotal.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', boxShadow:'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink:0 }}>
                <Clock size={22} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>عدد فواتير اليوم</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }} className="font-mono">{stats.todaySalesCount} فاتورة</div>
              </div>
            </div>
          </div>
        )}

        {/* Launch Cards Grid */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '14px' }}>إطلاق سريع للمحطات التشغيلية</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {visibleModules.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(m.path)}
                className="active-press"
                style={{
                  background: 'var(--bg-card)',
                  padding: '18px 20px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--color-border-bright)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: `${m.color}12`,
                    color: m.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {m.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 3px 0' }}>{m.title}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}</p>
                  </div>
                </div>
                <ChevronLeft size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginRight: '8px' }} />
              </button>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

