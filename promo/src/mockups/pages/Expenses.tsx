import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

interface Expense {
  date: string
  desc: string
  amount: string
  total: string
  category: string
  ref: string
  isNew?: boolean
}

const initialExpenses: Expense[] = [
  { date: '2026-07-25', desc: 'Albasam', amount: 'SAR 123.00', total: 'SAR 16.56', category: 'أمين', ref: '' },
  { date: '2026-07-23', desc: 'adcvd', amount: 'SAR 120.00', total: 'SAR 15.93', category: '', ref: '' },
  { date: '2026-07-20', desc: 'عم المساعد الذكي', amount: 'SAR 150.00', total: 'SAR 15.17', category: '', ref: '' },
]

export default function Expenses({ navigate: _navigate }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showAdd, setShowAdd] = useState(false)
  const [demoSave, setDemoSave] = useState(false)

  const handleDemoAdd = () => {
    setShowAdd(true)
    setTimeout(() => {
      setDemoSave(true)
      setTimeout(() => {
        setDemoSave(false)
        setShowAdd(false)
        const newExp: Expense = {
          date: '2026-07-26',
          desc: 'فاتورة انترنت',
          amount: 'SAR 299.00',
          total: 'SAR 44.85',
          category: 'مصاريف تشغيلية',
          ref: 'EXP-992',
          isNew: true
        }
        setExpenses(prev => [newExp, ...prev])
        setTimeout(() => {
          setExpenses(prev => prev.map(e => e === newExp ? { ...e, isNew: false } : e))
        }, 2000)
      }, 800)
    }, 1000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="المصروفات والمشتريات التشغيلية" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 text-lg">🪙</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">صافي التدفق</div>
              <div className="text-xl font-bold text-gray-800">SAR 391.74</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-lg">⬇</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">قيمة المدفوعات للموردين</div>
              <div className="text-xl font-bold text-gray-800">SAR 51.26</div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-500 text-lg">$</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">إيراد النقدية</div>
              <div className="text-xl font-bold text-gray-800">SAR 443</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تصدير Excel</button>
            <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تصدير PDF</button>
            <button id="btn-add-expense" onClick={handleDemoAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <span>+</span> إضافة مصروف جديد
            </button>
          </div>
          <div className="flex items-center gap-1 mr-auto">
            <button className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">تطبيق</button>
            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
              <input type="date" className="px-2 py-1 text-xs focus:outline-none border-0" />
              <span className="text-gray-400 text-xs px-1">/</span>
              <input type="date" className="px-2 py-1 text-xs focus:outline-none border-0" />
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>mm/dd/yyyy</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-4 py-3 text-right font-semibold">الإجراءات</th>
                <th className="px-4 py-3 text-right font-semibold">التعريفة</th>
                <th className="px-4 py-3 text-right font-semibold">الإجمالي شامل الضريبة</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">الوصف</th>
                <th className="px-4 py-3 text-right font-semibold">العودة</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => (
                <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-1000 ${exp.isNew ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button className="text-blue-500 hover:text-blue-700 p-0.5">👁</button>
                      <button className="text-red-500 hover:text-red-700 p-0.5">🗑</button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{exp.total}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{exp.amount}</td>
                  <td className="px-4 py-2.5 text-gray-700">{exp.amount}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-medium">{exp.desc}</td>
                  <td className="px-4 py-2.5 text-gray-500">{exp.category}</td>
                  <td className="px-4 py-2.5 text-gray-500">{exp.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Modal */}
        {showAdd && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-[400px] p-5 animate-[slideIn_0.3s_ease-out]">
              <h3 className="text-lg font-bold text-gray-800 text-right mb-4">إضافة مصروف جديد</h3>
              <div className="space-y-3 text-right text-sm">
                <div>
                  <label className="block text-gray-600 mb-1">المبلغ (SAR)</label>
                  <input type="text" value="299.00" readOnly className="w-full border rounded px-3 py-2 text-right bg-gray-50" />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">الوصف</label>
                  <input type="text" value="فاتورة انترنت" readOnly className="w-full border rounded px-3 py-2 text-right bg-gray-50" />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">القسم</label>
                  <input type="text" value="مصاريف تشغيلية" readOnly className="w-full border rounded px-3 py-2 text-right bg-gray-50" />
                </div>
                <button
                  className={`w-full font-bold py-2.5 rounded-lg text-white transition-colors mt-2 ${demoSave ? 'bg-green-500' : 'bg-blue-600'}`}
                >
                  {demoSave ? 'تم الحفظ ✅' : 'حفظ المصروف'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
