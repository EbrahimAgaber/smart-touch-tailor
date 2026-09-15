import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const topTabs = [
  'دفاتر الأستاذ',
  'الميزانية',
  'المستحقات',
  'إقرار الضريبة',
  'مطابقة البنك',
  'الرواتب',
  'الأصول الثابتة',
  'أعمار الذمم',
  'كشف الحساب',
  'الإيراد المؤجل',
  'نقطة التعادل',
  'إعدادات الضريبة',
  'تكلفة المخزون',
]

const subTabs = ['مطابقة الأستاذ العام', 'دفتر العملاء', 'دفتر الموردين']

const ledgerRows = [
  {
    date: '2026-07-01',
    ref: 'INV-B2B-1782917634273',
    desc: 'فاتورة مبيعات',
    debit: '1,150.00',
    credit: '—',
    balance: '1,150.00',
    balanceColor: 'text-green-600',
  },
]

export default function AdvancedAccounting({ navigate: _navigate }: Props) {
  const [activeTop, setActiveTop] = useState('دفاتر الأستاذ')
  const [activeSub, setActiveSub] = useState('دفتر العملاء')
  const [customer, setCustomer] = useState('B2B Corp')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="المحاسبة المتقدمة — المراحل 2 و 3" />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Top tab bar */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center overflow-x-auto px-1 border-b border-gray-100">
            {topTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTop(tab)}
                className={`px-3 py-2.5 text-xs whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1 ${
                  activeTop === tab
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab === 'دفاتر الأستاذ' && <span className="text-[10px]">📒</span>}
                {tab === 'الميزانية' && <span className="text-[10px]">📊</span>}
                {tab === 'مطابقة البنك' && <span className="text-[10px]">🏦</span>}
                {tab === 'الرواتب' && <span className="text-[10px]">💰</span>}
                {tab === 'الأصول الثابتة' && <span className="text-[10px]">🏢</span>}
                {tab === 'أعمار الذمم' && <span className="text-[10px]">👥</span>}
                {tab === 'كشف الحساب' && <span className="text-[10px]">📋</span>}
                {tab === 'الإيراد المؤجل' && <span className="text-[10px]">📈</span>}
                {tab === 'نقطة التعادل' && <span className="text-[10px]">⚖</span>}
                {tab === 'إعدادات الضريبة' && <span className="text-[10px]">⚙</span>}
                {tab === 'تكلفة المخزون' && <span className="text-[10px]">📦</span>}
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-tabs + filters */}
        <div className="bg-white rounded-xl shadow-sm p-3 space-y-3">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2 justify-end">
            {subTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSub(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeSub === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Customer dropdown */}
            <div className="flex items-center gap-1">
              <select
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white min-w-36"
              >
                <option>B2B Corp</option>
                <option>Ahnan</option>
              </select>
              <span className="text-gray-400 text-sm">▾</span>
            </div>
            {/* Date range */}
            <div className="flex items-center gap-2" style={{ direction: 'ltr' }}>
              <span className="text-xs text-gray-500">إلى</span>
              <input type="date" defaultValue="2026-07-25" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <span className="text-xs text-gray-500">من</span>
              <input type="date" defaultValue="2026-05-01" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        </div>

        {/* Ledger table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Group header */}
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between">
            <div />
            <div className="text-right">
              <span className="font-bold text-gray-800 text-sm">{customer}</span>
              <span className="text-gray-500 text-sm"> — الرصيد الختامي: </span>
              <span className="text-green-600 font-bold text-sm">1,150.00 ر.س</span>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">التاريخ</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">المرجع</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">البيان</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">مدين</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">دائن</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{row.date}</td>
                  <td className="px-4 py-3 text-blue-600 font-medium">{row.ref}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{row.desc}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-semibold">{row.debit}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{row.credit}</td>
                  <td className={`px-4 py-3 text-center font-bold ${row.balanceColor}`}>{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
