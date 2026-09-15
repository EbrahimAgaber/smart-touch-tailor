import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const logRows = [
  {
    time: '2026-07-25 11:15',
    user: '👤 أ',
    action: 'ADD_EXPENDITURE',
    actionColor: 'bg-blue-100 text-blue-700',
    ref: 'Amount: 123 Albasam',
    change: '',
  },
  {
    time: '2026-07-25 11:14',
    user: '👤 أ',
    action: 'SALE',
    actionColor: 'bg-green-100 text-green-700',
    ref: 'jb.PointsReward: 0 CGS: 0.00 CostingMethod: #FICC',
    change: '',
  },
  {
    time: '2026-07-23 11:12',
    user: '👤 أ',
    action: 'EDIT_EXPENDITURE',
    actionColor: 'bg-amber-100 text-amber-700',
    ref: 'jb.2 Newbasin: 750',
    change: '',
  },
  {
    time: '2026-07-22 10:50',
    user: '👤 أ',
    action: 'ADD_EXPENDITURE',
    actionColor: 'bg-blue-100 text-blue-700',
    ref: 'Amount: 120 Supplier adcvd',
    change: '',
  },
  {
    time: '2026-07-22 10:48',
    user: '👤 أ',
    action: 'SALE',
    actionColor: 'bg-green-100 text-green-700',
    ref: 'jb.PointsReward: 0 CGS: 0.00 CostingMethod: #FICC',
    change: '',
  },
]

export default function SystemLog({ navigate: _navigate }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="سجل مراقبة النظام" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl p-3 shadow-sm space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex items-center border border-gray-300 rounded-lg px-3 py-1.5 gap-2 flex-1 max-w-72">
              <input
                type="text"
                placeholder="ابحث في البيانات المعاملات الفعلي..."
                className="flex-1 text-xs text-right bg-transparent focus:outline-none"
              />
              <span className="text-gray-400">🔍</span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 mr-auto">
              <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تصدير PDF</button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">التنفيذ</button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">الكل</button>
              <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                <option>المستخدم</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                <option>الوحدة</option>
              </select>
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" style={{ direction: 'ltr' }}>
                <input type="date" className="text-xs focus:outline-none border-0 bg-transparent w-28" placeholder="mm/dd/yyyy" />
                <span className="text-gray-400">—</span>
                <input type="date" className="text-xs focus:outline-none border-0 bg-transparent w-28" placeholder="mm/dd/yyyy" />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500 border-t border-gray-100 pt-2">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-gray-700">صفحة 1</span>
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <span className="font-bold text-blue-600">100</span>
              <span>المستلمات+</span>
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <span className="font-bold text-gray-800">100</span>
              <span>تقارير</span>
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <span className="font-bold text-green-600">1</span>
              <span>المستلمات</span>
            </span>
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-right font-semibold">تغيير</th>
                <th className="px-4 py-3 text-right font-semibold">المرجع / النقل</th>
                <th className="px-4 py-3 text-right font-semibold">الإجراء</th>
                <th className="px-4 py-3 text-right font-semibold">المستخدم</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {logRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400">{row.change}</td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-[10px] max-w-xs truncate">{row.ref}</td>
                  <td className="px-4 py-2.5">
                    <span className={`${row.actionColor} text-[10px] font-bold px-2 py-0.5 rounded font-mono`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>{row.user}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-[10px]">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
