import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, can } from '../store/useAuthStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { useAppSettings } from '../App';
import AppLayout from '../components/AppLayout';
import HomePrototypes from '../components/HomePrototypes';
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
  const [selectedDesign, setSelectedDesign] = useState(() => {
    return localStorage.getItem('smart_touch_home_design') || 'bento';
  });

  const handleSelectDesign = (id) => {
    setSelectedDesign(id);
    localStorage.setItem('smart_touch_home_design', id);
  };

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
    <AppLayout title="لوحة التشغيل الرئيسية للمحل" hideSidebar={true}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', flex: 1, paddingBottom: '30px' }}>
        
        {/* Live Interactive Prototypes (Contains the 5 Canvas Designs) */}
        <HomePrototypes
          currentDesign={selectedDesign}
          onSelectDesign={handleSelectDesign}
          stats={stats}
          tailorStats={tailorStats}
          shift={shift}
          userName={userName}
          businessType={businessType}
        />

      </div>
    </AppLayout>
  );
}
