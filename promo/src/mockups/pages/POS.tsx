import { useState } from 'react'
import type { Page } from '../App'

interface Props {
  navigate: (p: Page) => void
}

const categories = ['الكل', 'أيبار', 'حليب', 'عام', 'سندولشات']

const products = [
  { id: 1, name: 'الصافي حليب طويل الأجل 1 لتر', price: 10.0, cat: 'أيبار', emoji: '🥛' },
  { id: 2, name: 'حليب مراعي 1 لتر', price: 7.0, cat: 'حليب', emoji: '🥛' },
  { id: 3, name: 'مشكل ايدامات', price: 1.0, cat: 'سندولشات', emoji: '🥪' },
  { id: 4, name: '222', price: 100.0, cat: 'عام', emoji: '📦', discount: true },
  { id: 5, name: 'A', price: 130.0, cat: 'عام', emoji: '📦', discount: 2 },
  { id: 6, name: 'قوة', price: 16.0, cat: 'عام', emoji: '⚡' },
  { id: 7, name: 'تاتش', price: 15.0, cat: 'عام', emoji: '📱' },
  { id: 8, name: 'screen fix', price: 110.0, cat: 'عام', emoji: '🔧' },
]

interface CartItem {
  id: number
  name: string
  price: number
  qty: number
}

interface AddProductForm {
  name: string
  price: string
  barcode: string
  category: string
}

export default function POS({ navigate }: Props) {
  const [activeCat, setActiveCat] = useState('الكل')
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addForm, setAddForm] = useState<AddProductForm>({ name: '', price: '', barcode: '', category: 'عام' })
  const [paid, setPaid] = useState(false)

  const filtered = products.filter((p) => {
    const matchCat = activeCat === 'الكل' || p.cat === activeCat
    const matchSearch = !search || p.name.includes(search)
    return matchCat && matchSearch
  })

  const addToCart = (p: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === p.id)
      if (existing) return prev.map((c) => c.id === p.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const tax = subtotal * 0.15
  const total = subtotal + tax

  return (
    <div className="flex h-full overflow-hidden" style={{ direction: 'rtl' }}>
      {/* Order panel - left side (end in RTL) */}
      <div className="w-64 bg-white border-l border-gray-200 flex flex-col flex-shrink-0" style={{ order: 2 }}>
        {/* Header */}
        <div className="bg-gray-800 text-white px-3 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button className="text-gray-400 hover:text-white text-xs">🗑</button>
            <span className="text-sm font-bold">الطلب الحالي</span>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-4xl">🛒</span>
              <span className="text-xs">الطلب فارغ</span>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 text-xs">
                <div className="text-gray-500">{item.qty}×</div>
                <div className="flex-1 text-right px-2">
                  <div className="font-medium text-gray-800 text-[11px]">{item.name}</div>
                  <div className="text-gray-500">SAR {item.price.toFixed(2)}</div>
                </div>
                <div className="font-semibold text-gray-800">SAR {(item.price * item.qty).toFixed(2)}</div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 p-3 flex-shrink-0">
          <div className="space-y-1 text-xs mb-3">
            <div className="flex justify-between text-gray-600">
              <span>SAR {subtotal.toFixed(2)}</span>
              <span>الإجمالي</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>SAR {tax.toFixed(2)}</span>
              <span>الضريبة</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 text-sm border-t border-gray-200 pt-1 mt-1">
              <span>SAR {total.toFixed(2)}</span>
              <span>الصافي</span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="flex gap-1 mb-2">
            <button className="flex-1 bg-blue-600 text-white text-xs py-1 rounded font-semibold">بطاقة</button>
            <button className="flex-1 bg-gray-700 text-white text-xs py-1 rounded font-semibold">نقد</button>
          </div>

          {/* SAR 0.00 display */}
          <div className="text-center text-gray-400 text-[10px] mb-2">SAR 0.00</div>

          {/* Complete payment */}
          <button
            id="pos-pay-btn"
            onClick={() => {
              if (cart.length === 0 || paid) return
              setPaid(true)
              setTimeout(() => { setCart([]); setPaid(false) }, 2400)
            }}
            className={`w-full font-bold py-2 rounded-lg text-sm transition-all ${paid ? 'bg-emerald-400 text-white ring-4 ring-emerald-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
          >
            {paid ? '✅ تم الدفع بنجاح' : 'إتمام الدفع'}
          </button>
        </div>
      </div>

      {/* Center content: products */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50" style={{ order: 1 }}>
        {/* Product area header */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2 py-1 rounded transition-colors"
              >
                {showAddProduct ? '✕ إغلاق' : '+ منتج جديد'}
              </button>
              <button
                onClick={() => navigate('quick-invoice')}
                className="bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold px-2 py-1 rounded transition-colors"
              >
                📋 جدولي
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1 text-xs w-48 text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <h2 className="text-sm font-bold text-gray-800">المنتجات</h2>
            </div>
          </div>
          {/* Category tabs */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`px-3 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  activeCat === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 gap-2.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  id={`pos-item-${p.id}`}
                  onClick={() => addToCart(p)}
                  className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-200 transition-all text-right"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-3xl border border-gray-100">
                      {p.emoji}
                    </div>
                    <div className="w-full">
                      <div className="text-[11px] font-semibold text-gray-800 text-center leading-tight line-clamp-2">{p.name}</div>
                      <div className="text-center mt-1">
                        <span className="text-blue-700 font-bold text-sm">SAR {p.price.toFixed(2)}</span>
                      </div>
                      {p.discount && (
                        <div className="flex justify-center mt-1">
                          <span className="bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            {typeof p.discount === 'number' ? `${p.discount} مخفض` : 'مخفض'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Add product panel (screen 8) */}
          {showAddProduct && (
            <div className="w-60 bg-white border-r border-gray-200 p-3 flex-shrink-0 overflow-y-auto">
              <h3 className="text-sm font-bold text-gray-800 text-right mb-3">إضافة منتج جديد</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1 text-right">اسم المنتج</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="أدخل اسم المنتج"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1 text-right">
                    سعر البيع <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={addForm.price}
                    onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                    className="w-full border border-red-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1 text-right">الباركود</label>
                  <input
                    type="text"
                    value={addForm.barcode}
                    onChange={(e) => setAddForm({ ...addForm, barcode: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="اقرأ أو أدخل الباركود"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1 text-right">القسم</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {categories.filter((c) => c !== 'الكل').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="عام">عام</option>
                  </select>
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                  💾 حفظ المنتج
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
