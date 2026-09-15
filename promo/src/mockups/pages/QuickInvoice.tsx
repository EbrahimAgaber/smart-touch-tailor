import { useState } from 'react'
import type { Page } from '../App'

interface Props {
  navigate: (p: Page) => void
}

interface InvoiceRow {
  id: number
  barcode: string
  name: string
  unit: string
  qty: number
  unitPrice: number
  total: number
  tax: number
  totalWithTax: number
}

const emptyRow: InvoiceRow = {
  id: 1,
  barcode: '',
  name: '',
  unit: '—',
  qty: 1,
  unitPrice: 0,
  total: 0,
  tax: 0,
  totalWithTax: 0,
}

export default function QuickInvoice({ navigate }: Props) {
  const [invoiceType, setInvoiceType] = useState<'b2c' | 'b2b'>('b2c')
  const [demoFilled, setDemoFilled] = useState(false)
  const [rows] = useState<InvoiceRow[]>([emptyRow])
  const [success, setSuccess] = useState(false)

  // Exposed to window for VideoStudio beat
  if (typeof window !== 'undefined') {
    ;(window as any).__fillQuickInvoice = () => setDemoFilled(true)
    ;(window as any).__saveQuickInvoice = () => {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    }
  }

  const subtotal = demoFilled ? 12450.00 : 0
  const tax = subtotal * 0.15
  const net = subtotal + tax

  const actionBtns1 = [
    { id: 'btn-save-print', label: 'حفظ وطباعة (F2)', bg: 'bg-blue-700', text: 'text-white' },
    { label: 'طباعة A4', bg: 'bg-gray-800', text: 'text-white' },
    { label: 'تعليق (F3)', bg: 'bg-emerald-600', text: 'text-white' },
    { label: 'حذف (F4)', bg: 'bg-red-600', text: 'text-white' },
    { label: 'حفظ بدون طباعة (F5)', bg: 'bg-gray-700', text: 'text-white' },
  ]
  const actionBtns2 = [
    { label: 'جديد (Ctrl+N)', bg: 'bg-gray-800', text: 'text-white' },
    { label: 'عرض سعر', bg: 'bg-purple-600', text: 'text-white' },
    { label: 'نقد سريع', bg: 'bg-gray-500', text: 'text-white' },
    { label: 'بطاقة سريع', bg: 'bg-gray-500', text: 'text-white' },
    { label: 'خصم / نقاط', bg: 'bg-amber-700', text: 'text-white' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white" style={{ direction: 'rtl' }}>
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('pos')}
            className={`flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold transition-colors ${
              false ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span>⊞</span> شبكي
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold bg-gray-800 text-white border-gray-800"
          >
            <span>☰</span> جدولي
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs">٣:٠٩ م</span>
          <h1 className="text-base font-bold text-gray-800">إدخال الفاتورة السريع</h1>
        </div>
      </div>

      {/* Form fields row */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex-wrap">
        {/* Invoice number */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-600 font-semibold">:رقم الفاتورة</span>
          <span className="bg-white border border-gray-300 text-red-600 font-bold px-2 py-0.5 rounded text-xs">AUTO</span>
        </div>
        {/* Payment method */}
        <div className="flex items-center gap-1 text-xs">
          <select className="border border-gray-300 rounded px-2 py-0.5 text-xs bg-white text-right focus:outline-none">
            <option>نقد</option>
            <option>بطاقة</option>
          </select>
          <span className="text-gray-600 font-semibold">:طريقة الدفع</span>
        </div>
        {/* Invoice type */}
        <div className="flex items-center gap-1 text-xs">
          <div className="flex rounded overflow-hidden border border-gray-300">
            <button
              onClick={() => setInvoiceType('b2b')}
              className={`px-2 py-0.5 text-xs font-semibold flex items-center gap-0.5 transition-colors ${
                invoiceType === 'b2b' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-[9px]">🏢</span> كاملة (B2B)
            </button>
            <button
              onClick={() => setInvoiceType('b2c')}
              className={`px-2 py-0.5 text-xs font-semibold transition-colors ${
                invoiceType === 'b2c' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              مبسطة (B2C)
            </button>
          </div>
          <span className="text-gray-600 font-semibold">:نوع الفاتورة</span>
        </div>
        {/* Client */}
        <div className="flex items-center gap-1 text-xs flex-1">
          <div className="flex items-center gap-1 border border-gray-300 rounded bg-white px-2 py-0.5 flex-1 max-w-48">
            <span className="text-gray-400 text-[10px]">👤</span>
            <input type="text" placeholder="بحث عن عميل..." className="flex-1 text-xs text-right bg-transparent focus:outline-none" />
          </div>
          <span className="text-gray-600 font-semibold">:العميل</span>
        </div>
        {/* Branch */}
        <div className="flex items-center gap-1 text-xs">
          <select className="border border-gray-300 rounded px-2 py-0.5 text-xs bg-white text-right focus:outline-none">
            <option>الرئيسي</option>
          </select>
          <span className="text-gray-600 font-semibold">:المستودع</span>
        </div>
      </div>

      {/* Invoice table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-3 py-2.5 text-right font-semibold">#</th>
                <th className="px-3 py-2.5 text-right font-semibold">رقم الصنف / الباركود</th>
                <th className="px-3 py-2.5 text-right font-semibold">اسم الصنف</th>
                <th className="px-3 py-2.5 text-center font-semibold">الوحدة</th>
                <th className="px-3 py-2.5 text-center font-semibold">الكمية</th>
                <th className="px-3 py-2.5 text-center font-semibold">سعر الوحدة</th>
                <th className="px-3 py-2.5 text-center font-semibold">المجموع (غ.ض)</th>
                <th className="px-3 py-2.5 text-center font-semibold">الضريبة</th>
                <th className="px-3 py-2.5 text-center font-semibold">شامل الضريبة</th>
              </tr>
            </thead>
            <tbody>
              {demoFilled ? (
                <>
                  <tr className="border-b border-gray-200 hover:bg-blue-50 bg-blue-50/30">
                    <td className="px-3 py-2 text-blue-600 font-bold">1</td>
                    <td className="px-3 py-2 font-mono">1029384756</td>
                    <td className="px-3 py-2 text-gray-800 font-bold">لابتوب ديل اكس بي اس 15</td>
                    <td className="px-3 py-2 text-center text-gray-600">حبة</td>
                    <td className="px-3 py-2 text-center text-gray-800 font-bold">2</td>
                    <td className="px-3 py-2 text-center text-gray-600">4,500.00</td>
                    <td className="px-3 py-2 text-center text-gray-800">9,000.00</td>
                    <td className="px-3 py-2 text-center text-gray-600">1,350.00</td>
                    <td className="px-3 py-2 text-center font-bold text-gray-800">10,350.00</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-blue-50 bg-blue-50/30">
                    <td className="px-3 py-2 text-blue-600 font-bold">2</td>
                    <td className="px-3 py-2 font-mono">8273645192</td>
                    <td className="px-3 py-2 text-gray-800 font-bold">شاشة ال جي 27 بوصة 4K</td>
                    <td className="px-3 py-2 text-center text-gray-600">حبة</td>
                    <td className="px-3 py-2 text-center text-gray-800 font-bold">3</td>
                    <td className="px-3 py-2 text-center text-gray-600">1,150.00</td>
                    <td className="px-3 py-2 text-center text-gray-800">3,450.00</td>
                    <td className="px-3 py-2 text-center text-gray-600">517.50</td>
                    <td className="px-3 py-2 text-center font-bold text-gray-800">3,967.50</td>
                  </tr>
                </>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-200 hover:bg-blue-50">
                    <td className="px-3 py-2 text-blue-600 font-bold">*</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="امسح الباركود أو ابحث عن صنف... (F1)"
                        className="w-full text-xs text-right bg-transparent focus:outline-none text-gray-500 placeholder-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-400">—</td>
                    <td className="px-3 py-2 text-center text-gray-400">—</td>
                    <td className="px-3 py-2 text-center text-gray-600">1</td>
                    <td className="px-3 py-2 text-center text-gray-400">0.00</td>
                    <td className="px-3 py-2 text-center text-gray-400">0.00</td>
                    <td className="px-3 py-2 text-center text-gray-400">0.00</td>
                    <td className="px-3 py-2 text-center text-gray-400">0.00</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex-1 bg-white" />

        {/* Bottom: totals + action buttons */}
        <div className="flex-shrink-0 border-t border-gray-200">
          <div className="flex" style={{ direction: 'rtl' }}>
            {/* Totals - right side in RTL */}
            <div className="bg-gray-50 border-l border-gray-200 p-4 w-52 flex-shrink-0">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-semibold text-lg">{subtotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                  <span className="text-gray-700 font-semibold">:الإجمالي</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-lg">{tax.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                  <span className="text-gray-700 font-semibold">:(الضريبة (15%</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-300 pt-2">
                  <span className="text-red-600 font-bold text-2xl">{net.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                  <span className="text-gray-700 font-bold">:الصافي</span>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-[10px] text-gray-500">
                <div className="flex items-center justify-between">
                  <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-semibold">نقد</span>
                  <span>:طريقة الدفع</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold">B2C مبسطة</span>
                  <span>:نوع الفاتورة</span>
                </div>
              </div>
            </div>

            {/* Action buttons - left side */}
            <div className="flex-1 p-3 space-y-2">
              {/* Row 1 */}
              <div className="grid grid-cols-5 gap-1.5">
                {actionBtns1.map((btn) => (
                  <button
                    key={btn.label}
                    id={btn.id}
                    className={`${btn.bg} ${btn.text} text-[11px] font-semibold py-2.5 px-1 rounded-lg hover:opacity-90 transition-opacity text-center`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              {/* Row 2 */}
              <div className="grid grid-cols-5 gap-1.5">
                {actionBtns2.map((btn) => (
                  <button
                    key={btn.label}
                    className={`${btn.bg} ${btn.text} text-[11px] font-semibold py-2.5 px-1 rounded-lg hover:opacity-90 transition-opacity text-center`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              {/* Row 3 - full width */}
              <button className="w-full bg-gray-400 hover:bg-gray-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors">
                💳 الدفع الكامل (تفاصيل)
              </button>
            </div>
          </div>
        </div>

        {/* Success overlay */}
        {success && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-blue-900/10 backdrop-blur-[1px]" />
            <div className="bg-white px-10 py-8 rounded-2xl shadow-2xl flex flex-col items-center transform scale-110 animate-[popIn_0.3s_ease-out]">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-green-500">
                ✅
              </div>
              <h2 className="text-2xl font-bold text-gray-800">تم حفظ الفاتورة بنجاح</h2>
              <p className="text-gray-500 mt-2 text-sm">جاري الطباعة...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
