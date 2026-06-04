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
      } catch (e) {
        console.error('Failed to load home page data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  // Filter launch modules by user permissions and license tier
  const MODULES = [
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
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{getGreeting()}، {userName || 'المستخدم'}</span>
              <span className="animate-bounce">👋</span>
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
                <div style={{ fontSize: '13px', fontWeight: '800' }}>{role === 'Admin' ? '🛡️ مدير النظام' : role === 'Manager' ? '👔 مشرف' : '💼 كاشير'}</div>
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

        {/* Shift Dashboard Stats */}
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
