import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const topTabs = [
  'القوائم المالية',
  'قائمة الدخل',
  'الميزانية',
  'التدفق النقدي',
  'الأرصدة الافتتاحية',
  'اليومية',
  'دفتر اليومية',
  'الفترات',
]

const bottomTabs = [
  'التقارير والدفاتر',
  'ميزان المراجعة',
  'دليل الأسعار',
  'ضريبة القيمة المضافة',
]

const quickDates = ['اليوم', 'هذا الشهر', 'هذا العام', 'هذا الشهر', 'الربع', 'الربع الماضي', 'السنة الماضية']

export default function Financial({ navigate: _navigate }: Props) {
  const [activeBottomTab, setActiveBottomTab] = useState('ضريبة القيمة المضافة')

  const outputVAT = 2373.91
  const inputVAT = 1259.51
  const maxBar = outputVAT

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="المركز المالي والمحاسبة" />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Top tab row */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center overflow-x-auto border-b border-gray-100 px-2">
            {topTabs.map((tab) => (
              <button
                key={tab}
                className="px-3 py-2.5 text-xs text-gray-600 hover:text-gray-800 whitespace-nowrap hover:bg-gray-50 transition-colors border-b-2 border-transparent hover:border-gray-300"
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Bottom tab row */}
          <div className="flex items-center overflow-x-auto px-2">
            {bottomTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveBottomTab(tab)}
                className={`px-3 py-2 text-xs whitespace-nowrap transition-colors border-b-2 ${
                  activeBottomTab === tab
                    ? 'text-blue-700 border-blue-600 font-semibold bg-blue-50'
                    : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Date filters */}
        <div className="bg-white rounded-xl p-2.5 shadow-sm flex items-center gap-1.5 flex-wrap">
          <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-2 py-1 rounded transition-colors">طباعة</button>
          {quickDates.map((d) => (
            <button
              key={d}
              className="bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 text-xs px-2.5 py-1 rounded transition-colors"
            >
              {d}
            </button>
          ))}
          <div className="flex items-center gap-1 mr-auto" style={{ direction: 'ltr' }}>
            <input type="date" defaultValue="2026-01-07" className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none" />
            <span className="text-gray-400 text-xs">—</span>
            <input type="date" defaultValue="2026-07-25" className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-blue-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-500 text-xl">📊</span>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">97 فاتورة</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">المبيعات الخاضعة</div>
              <div className="text-xl font-bold text-gray-800">15,826.09</div>
              <div className="text-xs text-gray-500">ر.س</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-500 text-xl">🔥</span>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">المدفوعة من العملاء</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">ضريبة المخرجات</div>
              <div className="text-xl font-bold text-gray-800">2,373.91</div>
              <div className="text-xs text-gray-500">ر.س</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-green-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-500 text-xl">⬇</span>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">المدفوعة للموردين</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">ضريبة المدخلات</div>
              <div className="text-xl font-bold text-gray-800">1,259.51</div>
              <div className="text-xs text-gray-500">ر.س</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-teal-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-teal-500 text-xl">✓</span>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">مستحقة الدفع</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">صافي الضريبة</div>
              <div className="text-xl font-bold text-gray-800">1,114.40</div>
              <div className="text-xs text-gray-500">ر.س</div>
            </div>
          </div>
        </div>

        {/* VAT Analysis */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div />
            <h3 className="text-sm font-bold text-gray-800">
              تحليل ضريبة القيمة المضافة ( 2026-07-01 — 2026-07-25 )
            </h3>
          </div>

          <div className="space-y-4">
            {/* Output VAT bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-red-600">ر.س {outputVAT.toLocaleString()}</span>
                <span className="text-xs text-gray-700 font-semibold">ضريبة المخرجات (Output VAT)</span>
              </div>
              <div className="h-7 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${(outputVAT / maxBar) * 100}%` }}
                />
              </div>
            </div>

            {/* Input VAT bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-green-600">ر.س {inputVAT.toLocaleString()}</span>
                <span className="text-xs text-gray-700 font-semibold">ضريبة المدخلات (Input VAT)</span>
              </div>
              <div className="h-7 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(inputVAT / maxBar) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Net VAT box */}
          <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="text-xs text-gray-600">
                <div className="flex items-center gap-1 text-amber-600 font-semibold mb-1">
                  <span>⚠</span>
                  <span>ضريبة مستحقة الدفع لهيئة الزكاة</span>
                </div>
                <div className="text-gray-500">الفرق بين ضريبة المخرجات والمدخلات</div>
                <div className="text-red-600 font-semibold mt-1">واجبة السداد</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-red-600">1,114.40</div>
                <div className="text-sm text-red-500">ر.س</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
