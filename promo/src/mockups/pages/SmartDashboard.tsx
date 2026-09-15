import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const salesData = [
  { date: '07-19', value: 0 },
  { date: '07-20', value: 20 },
  { date: '07-21', value: 60 },
  { date: '07-22', value: 160 },
  { date: '07-23', value: 120 },
  { date: '07-24', value: 40 },
  { date: '07-25', value: 0 },
]

function SalesChart() {
  const maxVal = 180
  const w = 400
  const h = 120
  const padX = 30
  const padY = 10
  const chartW = w - padX * 2
  const chartH = h - padY * 2

  const points = salesData.map((d, i) => {
    const x = padX + (i / (salesData.length - 1)) * chartW
    const y = padY + chartH - (d.value / maxVal) * chartH
    return { x, y }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = `${pathD} L${points[points.length - 1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Y-axis lines */}
      {[0, 90, 180].map((v) => {
        const y = padY + chartH - (v / maxVal) * chartH
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
            <text x={padX - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{v}</text>
          </g>
        )
      })}
      {/* Area fill */}
      <path id="sales-chart-area" d={areaD} fill="url(#chartGrad)" style={{ opacity: 0 }} />
      {/* Line */}
      <path id="sales-chart-line" d={pathD} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1000" strokeDashoffset="1000" />
      {/* Points */}
      <g id="sales-chart-points" style={{ opacity: 0 }}>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#3b82f6" />
        ))}
      </g>
      {/* X-axis dates */}
      {salesData.map((d, i) => {
        const x = padX + (i / (salesData.length - 1)) * chartW
        return (
          <text key={i} x={x} y={h - 1} textAnchor="middle" fontSize="7" fill="#94a3b8">
            {`07-${d.date.split('-')[1]}`}
          </text>
        )
      })}
    </svg>
  )
}

const lowStockItems = [
  { name: 'الصافي حليب طويل الأجل 1 لتر', qty: 10, point: 5, warn: true },
  { name: 'حليب مراعي 1 لتر', qty: 6, point: 5, warn: true },
  { name: 'مشكل ايدامات', qty: '—', point: 0, warn: false },
  { name: 'A', qty: 1, point: 5, warn: true },
]

export default function SmartDashboard({ navigate }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="لوحة القيادة الذكية" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-yellow-400 rounded-xl p-4 text-right">
            <div className="text-yellow-900 text-xs font-medium mb-1">إجمالي العملاء</div>
            <div className="text-yellow-900 text-3xl font-bold">17</div>
            <div className="text-yellow-800 text-[10px] mt-1">إجمالي العملاء المسجلين</div>
          </div>
          <div className="bg-orange-500 rounded-xl p-4 text-right">
            <div className="text-white text-xs font-medium mb-1">إجمالي المنتجات</div>
            <div className="text-white text-3xl font-bold">5</div>
            <div className="text-orange-100 text-[10px] mt-1">منتجات نشطة في المخزون</div>
          </div>
          <div className="bg-blue-600 rounded-xl p-4 text-right">
            <div className="text-white text-xs font-medium mb-1">عدد الفواتير</div>
            <div className="text-white text-3xl font-bold">8</div>
            <div className="text-blue-100 text-[10px] mt-1">إجمالي فواتير اليوم</div>
          </div>
          <div className="bg-slate-700 rounded-xl p-4 text-right">
            <div className="text-white text-xs font-medium mb-1">مبيعات اليوم</div>
            <div className="text-white text-3xl font-bold">SAR <span id="kpi-sales">0</span></div>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">ضعيف</span>
            </div>
          </div>
        </div>

        {/* Chart + Low Stock */}
        <div className="grid grid-cols-2 gap-4">
          {/* Sales Chart */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div />
              <h3 className="text-sm font-bold text-gray-700">أداء المبيعات (آخر 7 أيام)</h3>
            </div>
            <SalesChart />
            <div className="flex justify-between mt-1 px-7" style={{ direction: 'ltr' }}>
              {salesData.map((d, i) => (
                <span key={i} className="text-[8px] text-gray-400">2026-{d.date}</span>
              ))}
            </div>
          </div>

          {/* Low stock table */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div />
              <h3 className="text-sm font-bold text-gray-700">هيئة الزجاجة — المخزن</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-2 py-1.5 text-right font-semibold">الاسم</th>
                    <th className="px-2 py-1.5 text-center font-semibold">الكمية</th>
                    <th className="px-2 py-1.5 text-center font-semibold">النقطة</th>
                    <th className="px-2 py-1.5 text-center font-semibold">تنبيه</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-gray-700 font-medium">{item.name}</td>
                      <td className="px-2 py-1.5 text-center text-gray-600">{item.qty}</td>
                      <td className="px-2 py-1.5 text-center text-gray-600">{item.point}</td>
                      <td className="px-2 py-1.5 text-center">
                        {item.warn && <span className="text-orange-500 font-bold text-sm">⚠</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom notification */}
        <div
          className="rounded-xl p-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
          onClick={() => navigate('inventory')}
        >
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            إدارة المخزون والطلبيات
          </button>
          <div className="text-right">
            <span className="text-white text-sm font-bold">📦 مخزون درج (18)</span>
            <div className="text-slate-400 text-[10px]">طلبات معلقة تحتاج مراجعة</div>
          </div>
        </div>
      </div>
    </div>
  )
}
