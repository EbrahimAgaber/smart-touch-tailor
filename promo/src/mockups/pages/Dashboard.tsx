import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const modules = [
  {
    icon: '📦',
    bg: 'bg-amber-500',
    title: 'إدارة المخزون والمنتجات',
    sub: 'منتجات, الباركود, المخزون, والبريد',
    page: 'inventory' as Page,
  },
  {
    icon: '📊',
    bg: 'bg-blue-600',
    title: 'لوحة التحكم والتحليلات',
    sub: 'إحصاءات المبيعات اليومية والتحليلات',
    page: 'smart-dashboard' as Page,
  },
  {
    icon: '▶',
    bg: 'bg-emerald-600',
    title: 'إطلاق البيع الكاشير',
    sub: 'نقطة البيع والكاشير الكامل',
    page: 'pos' as Page,
    featured: true,
  },
  {
    icon: '⚙️',
    bg: 'bg-red-600',
    title: 'إعدادات النظام والرواتب',
    sub: 'عرض بيانات النظام والموظفين',
    page: null,
  },
  {
    icon: '💰',
    bg: 'bg-green-600',
    title: 'المركز المالي والمحاسبة',
    sub: 'عرض الإدارة المالية والتقارير',
    page: 'financial' as Page,
  },
  {
    icon: '👥',
    bg: 'bg-purple-600',
    title: 'العملاء والموارد CRM',
    sub: 'إدارة العملاء والموارد البشرية',
    page: null,
  },
]

export default function Dashboard({ navigate }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden" id="dashboard-container" style={{ transformStyle: 'preserve-3d' }}>
      <div className="ui-layer pop-out-layer-1" style={{ transform: 'translateZ(10px)' }}>
        <PageHeader title="لوحة التشغيل الرئيسية" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ transformStyle: 'preserve-3d' }}>
        {/* Welcome card */}
        <div className="ui-layer pop-out-layer-2 rounded-xl overflow-hidden shadow-sm" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 40%, #1e1b4b 100%)', transform: 'translateZ(20px)' }}>
          <div className="flex items-center justify-between p-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🔥</span>
                <h2 className="text-white text-xl font-bold">مساء الخير، المستخدم</h2>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed max-w-md">
                مرحباً في لوحة التشغيل الرئيسية، هذه لوحة تحكم خاصة بك لتسهل من الأقسام أدناه
              </p>
            </div>
            <div className="bg-white/10 rounded-xl px-6 py-3 text-center border border-white/20 flex-shrink-0 ml-4">
              <div className="text-white text-2xl font-bold">٣:٣٥</div>
              <div className="text-blue-200 text-xs mt-0.5">مدير النظام</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3" style={{ transformStyle: 'preserve-3d' }}>
          <div className="metric-card bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 transition-transform duration-300" style={{ transform: 'translateZ(30px)' }}>
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-500 text-lg">🧾</span>
            </div>
            <div>
              <div className="text-xs text-gray-500">عدد فواتير اليوم</div>
              <div className="text-lg font-bold text-gray-800">0 فاتورة</div>
            </div>
          </div>
          <div className="metric-card bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 transition-transform duration-300" style={{ transform: 'translateZ(40px)' }}>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-500 text-lg">📈</span>
            </div>
            <div>
              <div className="text-xs text-gray-500">صافي اليوم</div>
              <div className="text-lg font-bold text-gray-800">SAR 0.00</div>
            </div>
          </div>
          <div className="metric-card bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 transition-transform duration-300" style={{ transform: 'translateZ(50px)' }}>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 text-lg">⬆️</span>
            </div>
            <div>
              <div className="text-xs text-gray-500">آخر فاتورة المقفلة</div>
              <div className="text-lg font-bold text-gray-800">SAR 144.50</div>
            </div>
          </div>
        </div>

        {/* Quick launch */}
        <div className="ui-layer pop-out-layer-1" style={{ transform: 'translateZ(20px)' }}>
          <div className="flex items-center justify-between mb-3">
            <div />
            <div className="text-right">
              <h3 className="text-sm font-bold text-gray-700">إطلاق سريع للمحطات التشغيلية</h3>
              <p className="text-xs text-gray-400">اختر القسم المناسب لبدء العمل بسرعة من الأقسام أدناه</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3" style={{ transformStyle: 'preserve-3d' }}>
            {modules.map((mod, i) => (
              <button
                key={i}
                onClick={() => mod.page && navigate(mod.page)}
                disabled={!mod.page}
                className={`module-card bg-white rounded-xl p-4 shadow-sm text-right hover:shadow-lg transition-all duration-300 border border-transparent hover:border-blue-100 disabled:opacity-60 disabled:cursor-not-allowed ${
                  mod.featured ? 'ring-2 ring-emerald-400 ring-offset-1' : ''
                }`}
                style={{ transform: `translateZ(${10 + i * 5}px)` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 ${mod.bg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-white text-xl">{mod.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800 leading-tight mb-1">{mod.title}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">{mod.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
