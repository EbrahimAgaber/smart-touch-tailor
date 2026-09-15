import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const inventoryItems = [
  {
    name: 'الصافي حليب طويل الأجل 1 لتر',
    barcode: 'بدون باركود',
    section: 'أيبان',
    sellPrice: 'SAR 10.00',
    cost: 'SAR 7.00',
    qty: '10 وحدة / قطعة (PCE)',
    qtyColor: 'text-green-600',
    warn: false,
  },
  {
    name: 'حليب مراعي 1 لتر',
    barcode: '0001',
    section: 'حليب',
    sellPrice: 'SAR 7.00',
    cost: 'SAR 6.00',
    qty: '6 وحدة / قطعة (PCE)',
    qtyColor: 'text-green-600',
    warn: false,
  },
  {
    name: 'مشكل ايدامات',
    barcode: 'بدون باركود',
    section: 'سندولشات فطور',
    sellPrice: 'SAR 1.00',
    cost: 'SAR 0.00',
    qty: 'خدمة',
    qtyColor: 'text-amber-600',
    warn: true,
    service: true,
  },
  {
    name: 'A',
    barcode: 'بدون باركود',
    section: 'عام',
    sellPrice: 'SAR 120.00',
    cost: 'SAR 100.00',
    qty: '5 وحدة',
    qtyColor: 'text-orange-600',
    warn: true,
  },
]

const tabs = ['المخزون', 'تقرير حركة المنتجات', 'تدقيق الهوامش', 'إعدادات الملصق']

export default function Inventory({ navigate: _navigate }: Props) {
  const [activeTab, setActiveTab] = useState('المخزون')
  const [search, setSearch] = useState('')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="إدارة المخزون والباركود" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 text-lg">📦</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">إجمالي المنتجات</div>
              <div className="text-3xl font-bold text-gray-800">17</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-500 text-xl">⚠</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">تنبيهات المخزون</div>
              <div className="text-3xl font-bold text-gray-800">5</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-500 text-lg">📈</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">قيمة المخزون</div>
              <div className="text-xl font-bold text-gray-800">SAR 6,178.5</div>
            </div>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="bg-white rounded-xl p-3 shadow-sm space-y-3">
          {/* Search */}
          <div className="flex items-center gap-2 justify-end">
            <div className="flex items-center border border-gray-300 rounded-lg px-3 py-1.5 gap-2 w-64">
              <input
                type="text"
                placeholder="ابحث بالاسم أو الباركود..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-xs text-right bg-transparent focus:outline-none"
              />
              <span className="text-gray-400 text-sm">🔍</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <span>✏</span> إدارة المنتجات
            </button>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-right font-semibold">المنتج / الباركود</th>
                <th className="px-4 py-3 text-right font-semibold">القسم</th>
                <th className="px-4 py-3 text-right font-semibold">سعر البيع</th>
                <th className="px-4 py-3 text-right font-semibold">التكلفة</th>
                <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                <th className="px-4 py-3 text-right font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-gray-800">{item.name}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                      <span>☰</span>
                      <span>{item.barcode}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold">{item.section}</span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{item.sellPrice}</td>
                  <td className="px-4 py-2.5 text-gray-600">{item.cost}</td>
                  <td className="px-4 py-2.5">
                    <div className={`flex items-center gap-1 font-semibold ${item.qtyColor}`}>
                      {item.warn && <span className="text-orange-500">⚠</span>}
                      {item.service && <span className="text-amber-600 font-bold">🔧</span>}
                      <span>{item.qty}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button className="text-red-500 hover:text-red-700 p-0.5">🗑</button>
                      <button className="text-blue-500 hover:text-blue-700 p-0.5">✏</button>
                      <button className="text-gray-500 hover:text-gray-700 p-0.5">☰</button>
                      <button className="text-gray-500 hover:text-gray-700 p-0.5">🕐</button>
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
