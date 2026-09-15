import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const customers = [
  {
    name: 'Ahnan',
    type: 'individual',
    phone: '0562123656',
    loyalty: 20,
    level: 'عادي',
    lastPurchase: '#AMAN...',
    totalSpend: 'SAR 222',
  },
  {
    name: 'B2B Corp',
    type: 'business',
    phone: '0',
    loyalty: 0,
    level: 'عادي',
    lastPurchase: '#AMAN11',
    totalSpend: 'SAR 1150',
  },
  {
    name: 'B2B Corp',
    type: 'business',
    phone: '0',
    loyalty: 0,
    level: 'عادي',
    lastPurchase: '#AMAN11',
    totalSpend: 'SAR 1150',
  },
  {
    name: 'B2B Corp',
    type: 'business',
    phone: '0',
    loyalty: 0,
    level: 'عادي',
    lastPurchase: '#AMAN11',
    totalSpend: 'SAR 1150',
  },
  {
    name: 'B2B Corp',
    type: 'business',
    phone: '0',
    loyalty: 0,
    level: 'عادي',
    lastPurchase: '#AMAN11',
    totalSpend: 'SAR 1150',
  },
]

export default function CRM({ navigate: _navigate }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="مركز العملاء (CRM)" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 text-lg">👥</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">إجمالي العملاء</div>
              <div className="text-3xl font-bold text-gray-800">17</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⭐</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">نقاط الولاء الذكية</div>
              <div className="text-3xl font-bold text-gray-800">1,548</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-500 text-lg">💰</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">إجمالي المشتريات</div>
              <div className="text-xl font-bold text-gray-800">SAR 16,211</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center border border-gray-300 rounded-lg px-3 py-1.5 gap-2 flex-1 max-w-64">
              <input
                type="text"
                placeholder="ابحث باسم أو الجوال أو البريد..."
                className="flex-1 text-xs text-right bg-transparent focus:outline-none"
              />
              <span className="text-gray-400 text-sm">🔍</span>
            </div>
            <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white text-right focus:outline-none">
              <option>جميع الكتاب</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <span>📊</span>
              <span>حماية والنسب</span>
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <span>+</span>
              <span>إضافة عميل جديد</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-3 py-2.5 text-right font-semibold">الإجراءات</th>
                <th className="px-3 py-2.5 text-right font-semibold">إجمالي الإنفاق</th>
                <th className="px-3 py-2.5 text-right font-semibold">آخر الشراء</th>
                <th className="px-3 py-2.5 text-center font-semibold">المستوى</th>
                <th className="px-3 py-2.5 text-center font-semibold">الولاء</th>
                <th className="px-3 py-2.5 text-right font-semibold">الجوال</th>
                <th className="px-3 py-2.5 text-right font-semibold">العميل</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button className="text-blue-500 hover:text-blue-700 p-0.5 text-sm" title="تعديل">✏</button>
                      <button className="text-red-500 hover:text-red-700 p-0.5 text-sm" title="حذف">🗑</button>
                      <button className="text-gray-500 hover:text-gray-700 p-0.5 text-sm" title="عرض">📋</button>
                      <button className="text-amber-500 hover:text-amber-700 p-0.5 text-sm" title="نشاط">⚡</button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{c.totalSpend}</td>
                  <td className="px-3 py-2.5 text-blue-600 font-medium text-[11px]">{c.lastPurchase}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">{c.level}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {c.loyalty > 0 ? (
                      <span className="flex items-center justify-center gap-0.5 text-amber-600 font-bold">
                        <span>🏆</span>
                        <span>{c.loyalty}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 flex items-center gap-1">
                    {c.phone !== '0' && <span className="text-green-500 text-sm">📱</span>}
                    <span>{c.phone}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{c.type === 'individual' ? '👤' : '🏢'}</span>
                      <span className="font-semibold text-gray-800">{c.name}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
