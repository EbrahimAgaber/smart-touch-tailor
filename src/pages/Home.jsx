import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, can } from '../store/useAuthStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { useAppSettings } from '../App';
import AppLayout from '../components/AppLayout';
import { 
  Play, BarChart2, Package, Shield, Settings, 
  Users, CreditCard, ChevronLeft, Clock, Wallet, Award, Coffee
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
      icon: <Play size={24} />,
      color: '#6366f1',
      path: '/tailor-pos',
      permission: null,
      feature: null
    },
    {
      id: 'orders-board',
      title: 'شاشة المعمل',
      desc: 'متابعة مراحل الإنتاج: قص، خياطة، تشطيب، كوي، جاهز',
      icon: <Package size={24} />,
      color: '#10b981',
      path: '/orders-board',
      permission: null,
      feature: null
    },
    {
      id: 'customers',
      title: 'العملاء وسجل المقاسات',
      desc: 'إدارة العملاء، عرض بروفايلات المقاسات وسجل الطلبات',
      icon: <Users size={24} />,
      color: '#8b5cf6',
      path: '/customers',
      permission: null,
      feature: 'customers'
    },
    {
      id: 'stock',
      title: 'مخزون الأقمشة والمواد',
      desc: 'متابعة الأقمشة المتوفرة، كميات الأمتار، وتنبيهات النفاد',
      icon: <BarChart2 size={24} />,
      color: '#f59e0b',
      path: '/stock',
      permission: 'view_stock',
      feature: 'stock.view'
    },
    {
      id: 'dashboard',
      title: 'لوحة التحكم والتحليلات',
      desc: 'مراقبة الإيرادات والأرباح والأداء العام للمحل',
      icon: <CreditCard size={24} />,
      color: '#ec4899',
      path: '/dashboard',
      permission: 'view_dashboard',
      feature: 'dashboard'
    },
    {
      id: 'settings',
      title: 'إعدادات النظام',
      desc: 'هوية المنشأة، الطابعات، وربط هيئة الزكاة',
      icon: <Settings size={24} />,
      color: '#64748b',
      path: '/settings',
      permission: 'manage_settings',
      feature: null
    },
  ] : [
    {
      id: 'pos',
      title: 'نقطة البيع الكاشير',
      desc: 'بدء عمليات بيع جديدة وإصدار الفواتير الفورية',
      icon: <Play size={24} />,
      color: '#3b82f6',
      path: '/pos',
      permission: null,
      feature: 'pos'
    },
    {
      id: 'dashboard',
      title: 'لوحة التحكم والتحليلات',
      desc: 'مراقبة المبيعات الحية، الأرباح، وتنبيهات المخزون',
      icon: <BarChart2 size={24} />,
      color: '#10b981',
      path: '/dashboard',
      permission: 'view_dashboard',
      feature: 'dashboard'
    },
    {
      id: 'stock',
      title: 'إدارة المخزون والمنتجات',
      desc: 'مراقبة كميات السلع، أوامر الشراء، والتوريد',
      icon: <Package size={24} />,
      color: '#f59e0b',
      path: '/stock',
      permission: 'view_stock',
      feature: 'stock.view'
    },
    {
      id: 'customers',
      title: 'العملاء والولاء CRM',
      desc: 'إدارة قاعدة بيانات العملاء، النقاط، والمستويات',
      icon: <Users size={24} />,
      color: '#8b5cf6',
      path: '/customers',
      permission: null,
      feature: 'customers'
    },
    {
      id: 'finance',
      title: 'المركز المالي والمحاسبة',
      desc: 'القيود اليومية، القوائم المالية، وإقرارات الضريبة',
      icon: <CreditCard size={24} />,
      color: '#ec4899',
      path: '/finance-hub',
      permission: 'view_reports',
      feature: 'finance_hub'
    },
    {
      id: 'settings',
      title: 'إعدادات النظام والربط',
      desc: 'إعداد هوية المنشأة، الطابعات، وربط هيئة الزكاة',
      icon: <Settings size={24} />,
      color: '#64748b',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
        
        {/* Welcome Section */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '24px',
          padding: '28px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px'
        }}>
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
              style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default', userSelect: 'none' }}
            >
              <span>{getGreeting()}، {userName || 'المستخدم'}</span>
              <span className="animate-bounce"></span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>
              مرحباً بك في لوحة تشغيل ورديتك الحالية. ابدأ يومك التشغيلي أو تصفح الأقسام أدناه.
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            zIndex: 2
          }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 18px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Coffee size={20} color="#3b82f6" />
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>صلاحية الموظف</div>
                <div style={{ fontSize: '13px', fontWeight: '800' }}>{role === 'Admin' ? '️ مدير النظام' : role === 'Manager' ? ' مشرف' : ' كاشير'}</div>
              </div>
            </div>
            {shift && (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 18px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="#10b981" />
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>بدء الوردية</div>
                  <div style={{ fontSize: '13px', fontWeight: '800' }}>{new Date(shift.opened_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KPI Stats — tailor mode vs retail mode */}
        {businessType === 'tailor' && tailorStats ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(99,102,241,0.1)', color:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>️</div>
              <div><div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700' }}>طلبات اليوم</div><div style={{ fontSize:'22px', fontWeight:'900', color:'var(--text-main)' }}>{tailorStats.newOrdersToday}</div></div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(16,185,129,0.1)', color:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}></div>
              <div><div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700' }}>إيراد اليوم</div><div style={{ fontSize:'22px', fontWeight:'900', color:'var(--text-main)' }}>SAR {Number(tailorStats.todayRevenue || 0).toFixed(2)}</div></div>
            </div>
            <button onClick={() => navigate('/orders-board')} style={{ background:'#ecfdf5', padding:'18px', borderRadius:'18px', border:'2px solid #a7f3d0', display:'flex', alignItems:'center', gap:'14px', cursor:'pointer', fontFamily:'inherit', textAlign:'right' }}>
              <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(16,185,129,0.2)', color:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}></div>
              <div><div style={{ fontSize:'11px', color:'#065f46', fontWeight:'800' }}>جاهز للاستلام</div><div style={{ fontSize:'26px', fontWeight:'900', color:'#10b981' }}>{tailorStats.readyForPickup}</div></div>
            </button>
            {tailorStats.overdue > 0 && (
              <button onClick={() => navigate('/orders-board')} style={{ background:'#fef2f2', padding:'18px', borderRadius:'18px', border:'2px solid #fecaca', display:'flex', alignItems:'center', gap:'14px', cursor:'pointer', fontFamily:'inherit', textAlign:'right' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(239,68,68,0.15)', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>️</div>
                <div><div style={{ fontSize:'11px', color:'#7f1d1d', fontWeight:'800' }}>طلبات متأخرة</div><div style={{ fontSize:'26px', fontWeight:'900', color:'#ef4444' }}>{tailorStats.overdue}</div></div>
              </button>
            )}
          </div>
          {/* Mulam Control Center Widgets */}
          {businessType === 'tailor' && tailorStats && (
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
               <div onClick={() => navigate('/stock')} style={{ cursor:'pointer', background: 'var(--bg-card)', padding: '18px', borderRadius: '18px', border: tailorStats.lowFabrics > 0 ? '2px solid #f59e0b' : '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                 <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(245,158,11,0.1)', color:'#f59e0b', display:'flex', alignItems:'center', justifyContent:'center' }}>⚠️</div>
                 <div><div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700' }}>أقمشة على وشك النفاد</div><div style={{ fontSize:'22px', fontWeight:'900', color: tailorStats.lowFabrics > 0 ? '#d97706' : 'var(--text-main)' }}>{tailorStats.lowFabrics} طاقة</div></div>
               </div>
               <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                 <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(59,130,246,0.1)', color:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center' }}>📅</div>
                 <div><div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700' }}>بروفات مجدولة اليوم</div><div style={{ fontSize:'22px', fontWeight:'900', color:'var(--text-main)' }}>{tailorStats.todayFittings}</div></div>
               </div>
               <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                 <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(139,92,246,0.1)', color:'#8b5cf6', display:'flex', alignItems:'center', justifyContent:'center' }}>🚚</div>
                 <div><div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700' }}>شحنات موردين (٧ أيام)</div><div style={{ fontSize:'22px', fontWeight:'900', color:'var(--text-main)' }}>{tailorStats.recentDeliveries} استلام</div></div>
               </div>
            </div>
          )}
        </>
        ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          {shift && (
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <Wallet size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>الرصيد الافتتاحي للدرج</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', marginTop: '2px' }}>SAR {parseFloat(shift.starting_cash || 0).toFixed(2)}</div>
              </div>
            </div>
          )}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>مبيعات اليوم المحققة</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', marginTop: '2px' }}>SAR {stats.todaySalesTotal.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>عدد فواتير اليوم</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', marginTop: '2px' }}>{stats.todaySalesCount} فاتورة</div>
            </div>
          </div>
        </div>
        )}

        {/* Launch Cards Grid */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px' }}>إطلاق سريع للمحطات التشغيلية</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {visibleModules.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(m.path)}
                className="active-press"
                style={{
                  background: 'var(--bg-card)',
                  padding: '20px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  outline: 'none',
                  transition: 'background-color 0.15s ease, transform 0.1s ease',
                  fontFamily: 'inherit'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: `${m.color}15`,
                    color: m.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {m.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{m.title}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}</p>
                  </div>
                </div>
                <ChevronLeft size={20} color="var(--text-muted)" style={{ flexShrink: 0, marginRight: '10px' }} />
              </button>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
