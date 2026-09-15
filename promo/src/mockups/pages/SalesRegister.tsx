import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const invoices = [
  {
    date: '٢٠٢٦-٠٧-٢٣ ١١:٢٤ م',
    client: '2176480929326',
    invoiceNo: 'INV-#',
    total: 'SAR 12.00',
    tax: 'SAR 1.57',
    payType: 'نقد',
    discount: 'SAR',
    status: 'تفصيل',
  },
  {
    date: '٢٠٢٦-٠٧-٢٣',
    client: '1768449004523',
    invoiceNo: 'INV-#',
    total: 'SAR 7.00',
    tax: 'SAR 0.91',
    payType: 'نقد',
    discount: '',
    status: 'تفصيل',
  },
]

export default function SalesRegister({ navigate: _navigate }: Props) {
  const [activeTab, setActiveTab] = useState<'sales' | 'quotes'>('sales')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="سجل المبيعات والفواتير"
        rightContent={
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('quotes')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${activeTab === 'quotes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              عروض الأسعار
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              المبيعات
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-lg">✕</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">فواتير ملغاة</div>
              <div className="text-2xl font-bold text-gray-800">0</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 text-lg">📄</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">عدد الفواتير</div>
              <div className="text-2xl font-bold text-gray-800">100</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-500 text-lg">%</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">ضريبة المبالغ المقفلة</div>
              <div className="text-xl font-bold text-gray-800">SAR 2377.43</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-amber-500 text-lg">⬆</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">إجمالي المبالغ</div>
              <div className="text-xl font-bold text-gray-800">SAR 18227.00</div>
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تصدير CRM</button>
            <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تصدير PDF</button>
            <button className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تصدير Excel</button>
            <button className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تحديث 🔄</button>
          </div>
          <div className="flex items-center gap-1 mr-auto">
            <span className="text-xs text-gray-500">إلى</span>
            <input type="date" defaultValue="2026-06-30" className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none" />
            <span className="text-xs text-gray-500">من</span>
            <input type="date" defaultValue="2026-07-25" className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-3 py-2.5 text-right font-semibold">الإجراءات</th>
                <th className="px-3 py-2.5 text-right font-semibold">الخصم</th>
                <th className="px-3 py-2.5 text-right font-semibold">نوع الدفع</th>
                <th className="px-3 py-2.5 text-right font-semibold">مبلغ الضريبة</th>
                <th className="px-3 py-2.5 text-right font-semibold">الإجمالي</th>
                <th className="px-3 py-2.5 text-right font-semibold">رقم الفاتورة</th>
                <th className="px-3 py-2.5 text-right font-semibold">العميل</th>
                <th className="px-3 py-2.5 text-right font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] bg-blue-50 px-1.5 py-0.5 rounded">تفصيل</button>
                      <button className="text-green-600 hover:text-green-800 text-[11px] bg-green-50 px-1.5 py-0.5 rounded">تعديل</button>
                      <button className="text-red-500 hover:text-red-700">🗑</button>
                      <button className="text-gray-500 hover:text-gray-700">✏</button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{inv.discount}</td>
                  <td className="px-3 py-2">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-semibold">{inv.payType}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{inv.tax}</td>
                  <td className="px-3 py-2 font-semibold text-gray-800">{inv.total}</td>
                  <td className="px-3 py-2 text-blue-600 font-medium">{inv.invoiceNo}</td>
                  <td className="px-3 py-2 text-gray-600">{inv.client}</td>
                  <td className="px-3 py-2 text-gray-500">{inv.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
