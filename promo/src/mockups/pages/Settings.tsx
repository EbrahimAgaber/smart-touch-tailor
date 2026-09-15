import { useState } from 'react'
import type { Page } from '../App'
import PageHeader from '../components/PageHeader'

interface Props {
  navigate: (p: Page) => void
}

const settingsTabs = [
  { id: 'identity', label: 'هوية المنشأة', icon: '🏢' },
  { id: 'zatca', label: 'هيئة الزكاة', icon: '✓' },
  { id: 'printing', label: 'القوائم والطباعة', icon: '🖨' },
  { id: 'tax', label: 'الضريبة والعملات', icon: '💱' },
  { id: 'system', label: 'النظام', icon: '⚙' },
  { id: 'ui', label: 'واجهة المستخدم', icon: '🖥' },
]

type ZatcaPhase = 'none' | 'phase1' | 'phase2'

export default function Settings({ navigate: _navigate }: Props) {
  const [activeTab, setActiveTab] = useState('zatca')
  const [zatcaPhase, setZatcaPhase] = useState<ZatcaPhase>('phase2')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="إعدادات المنشأة" />

      <div className="flex-1 overflow-hidden flex" style={{ direction: 'rtl' }}>
        {/* Left settings nav (appears on right in RTL - but we want it on left visually) */}
        <div className="w-52 bg-white border-l border-gray-200 flex-shrink-0 p-2 space-y-0.5" style={{ order: 2 }}>
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-right transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-sm flex-shrink-0">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'zatca' && activeTab === 'zatca' && (
                <span className="mr-auto text-blue-600 text-sm">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Settings content */}
        <div className="flex-1 overflow-y-auto p-5" style={{ order: 1 }}>
          {activeTab === 'zatca' && (
            <div className="max-w-2xl space-y-5">
              {/* ZATCA header */}
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-lg mt-0.5">ℹ</span>
                <div>
                  <h2 className="text-base font-bold text-gray-800">هيئة الزكاة</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    إدارة ربط الجهاز بنظام هيئة الشهادات والإرسال
                  </p>
                </div>
              </div>

              {/* ZATCA Phase */}
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-gray-500 text-sm">ℹ</span>
                  <h3 className="text-sm font-bold text-gray-700">مرحلة الالتزام (ZATCA Phase)</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setZatcaPhase('none')}
                    className={`border-2 rounded-xl p-3 text-center transition-all ${
                      zatcaPhase === 'none'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-800 mb-0.5">غير مسجل في ضريبة القيمة المضافة</div>
                    <div className="text-[10px] text-gray-400">Not Registered</div>
                  </button>
                  <button
                    onClick={() => setZatcaPhase('phase1')}
                    className={`border-2 rounded-xl p-3 text-center transition-all ${
                      zatcaPhase === 'phase1'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-800 mb-0.5">المرحلة الأولى (الإصدار والحفظ)</div>
                    <div className="text-[10px] text-gray-400">Phase 1</div>
                  </button>
                  <button
                    onClick={() => setZatcaPhase('phase2')}
                    className={`border-2 rounded-xl p-3 text-center transition-all ${
                      zatcaPhase === 'phase2'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-800 mb-0.5">المرحلة الثانية (الربط والتكامل)</div>
                    <div className="text-[10px] text-gray-400">Phase 2</div>
                  </button>
                </div>
              </div>

              {/* Submission queue status */}
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-gray-500 text-sm">ℹ</span>
                  <h3 className="text-sm font-bold text-gray-700">حالة قائمة الإرسال</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">0</div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-yellow-700 font-semibold mt-1">
                      <span>⚠</span>
                      <span>معلق</span>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-green-700 font-semibold mt-1">
                      <span>✓</span>
                      <span>مُرسل</span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">0</div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-red-700 font-semibold mt-1">
                      <span>✕</span>
                      <span>مرفوض</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating environment */}
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-gray-500 text-sm">🖥</span>
                  <h3 className="text-sm font-bold text-gray-700">بيئة التشغيل</h3>
                </div>
                <div className="text-xs text-gray-500 text-right mb-2">اختر البيئة</div>
                <div className="flex gap-3 justify-end">
                  <div className="border-2 border-blue-500 bg-blue-50 rounded-xl p-4 flex flex-col items-center gap-1.5 w-28 cursor-pointer">
                    <span className="text-2xl">🖥</span>
                    <div className="text-xs font-bold text-gray-800">بيئة الإنتاج</div>
                    <div className="text-[10px] text-gray-500">Core</div>
                  </div>
                </div>
              </div>

              {/* Warning banner */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-base flex-shrink-0">⚠</span>
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-800">
                      البيئة التجريبية (Sandbox) — الفواتير لن تُرسل إلى ZATCA الفعلي
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      استخدم هذه البيئة للاختبار فقط قبل الانطلاق الفعلي، غير الإعداد إلى &quot;إنتاج&quot;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'zatca' && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">⚙</div>
                <div className="text-sm">اختر قسماً من القائمة الجانبية</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
