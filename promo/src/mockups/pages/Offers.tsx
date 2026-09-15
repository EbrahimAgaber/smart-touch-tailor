import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

type OfferType = 'total' | 'bxgy' | 'wholesale'

export default function Offers({ navigate: _navigate }: Props) {
  const [showModal, setShowModal] = useState(true)
  const [offerType, setOfferType] = useState<OfferType>('total')
  const [offerName, setOfferName] = useState('')
  const [minPurchase, setMinPurchase] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('10')
  const [discountUnit, setDiscountUnit] = useState('%')
  const [success, setSuccess] = useState(false)

  // Demo helper exposed to window so VideoStudio can trigger the type-in effect
  if (typeof window !== 'undefined') {
    ;(window as any).__typeOfferName = (val: string) => setOfferName(val)
  }

  const handleActivate = () => {
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      setShowModal(false)
    }, 2500)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="إدارة العروض والخصومات" />

      <div className="flex-1 overflow-y-auto p-4 relative">
        {/* Background content (offer list placeholder) */}
        <div className={`space-y-4 ${showModal ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>+</span> إنشاء عرض جديد
            </button>
            <h2 className="text-sm font-bold text-gray-800">قائمة العروض والخصومات</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">🎁</div>
              <div className="text-sm">لا توجد عروض حالية</div>
            </div>
          </div>
        </div>

        {/* Modal overlay */}
        {showModal && (
          <div className="absolute inset-0 flex items-start justify-center pt-4 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ direction: 'rtl' }}>
              {/* Modal header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-light transition-colors"
                >
                  ✕
                </button>
                <h2 className="text-base font-bold text-gray-800">إنشاء عرض جديد</h2>
              </div>

              <div className="p-5 space-y-5">
                {/* Offer name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-right">
                    اسم العرض (يظهر للموظف)
                  </label>
                  <input
                    id="input-offer-name"
                    type="text"
                    value={offerName}
                    onChange={(e) => setOfferName(e.target.value)}
                    placeholder="مثال: خصم شراء الأعياد"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                </div>

                {/* Offer type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 text-right">نوع العرض</label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* على الإجمالي */}
                    <button
                      onClick={() => setOfferType('total')}
                      className={`border-2 rounded-xl p-3 text-right transition-all ${
                        offerType === 'total'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="text-sm font-bold text-gray-800 mb-0.5">على الإجمالي</div>
                      <div className="text-[10px] text-gray-500">خصم على مبلغ الفاتورة</div>
                    </button>

                    {/* Buy X Get Y */}
                    <button
                      onClick={() => setOfferType('bxgy')}
                      className={`border-2 rounded-xl p-3 text-right transition-all ${
                        offerType === 'bxgy'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="text-sm font-bold text-gray-800 mb-0.5">Buy X Get Y</div>
                      <div className="text-[10px] text-gray-500">اشتر منتج واحصل على آخر</div>
                    </button>

                    {/* سعر الجملة */}
                    <button
                      onClick={() => setOfferType('wholesale')}
                      className={`border-2 rounded-xl p-3 text-right transition-all ${
                        offerType === 'wholesale'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="text-sm font-bold text-gray-800 mb-0.5">سعر الجملة</div>
                      <div className="text-[10px] text-gray-500">خصم عند شراء كمية معينة</div>
                    </button>
                  </div>
                </div>

                {/* Amount fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-right">مقدار الخصم</label>
                    <div className="flex items-center gap-1">
                      <select
                        value={discountUnit}
                        onChange={(e) => setDiscountUnit(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option>%</option>
                        <option>ر.س</option>
                      </select>
                      <input
                        type="number"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-right">
                      الحد الأدنى للمشتريات (SAR)
                    </label>
                    <input
                      type="number"
                      value={minPurchase}
                      onChange={(e) => setMinPurchase(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>

                {/* Date fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-right">
                      تاريخ الانتهاء (اختياري)
                    </label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="mm/dd/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-right">تاريخ البدء</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="mm/dd/yyyy"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button id="btn-activate-offer" onClick={handleActivate} className={`w-full font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 ${success ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                  {success ? (
                    <span>🎉 تم تفعيل العرض بنجاح!</span>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>تفعيل العرض الترويجي</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Success Confetti overlay */}
            {success && (
              <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[2px] transition-opacity" />
                <div className="bg-emerald-600 text-white text-3xl font-black px-12 py-8 rounded-3xl shadow-[0_20px_50px_rgba(16,185,129,0.5)] transform scale-110 animate-[bounce_0.5s_infinite]">
                  🎉 تم التفعيل! 🎉
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
