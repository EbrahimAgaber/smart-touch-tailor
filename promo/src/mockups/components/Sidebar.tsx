import type { Page } from '../App'

interface Props {
  page: Page
  navigate: (p: Page) => void
  posMode: boolean
}

type Section = 'overview' | 'sales' | 'stock' | 'finance' | 'admin'

function getSection(page: Page): Section {
  if (page === 'dashboard' || page === 'smart-dashboard') return 'overview'
  if (page === 'pos' || page === 'quick-invoice' || page === 'sales-register') return 'sales'
  if (page === 'inventory' || page === 'purchases') return 'stock'
  if (page === 'expenses' || page === 'financial' || page === 'advanced-accounting') return 'finance'
  if (page === 'crm' || page === 'system-log' || page === 'offers' || page === 'settings') return 'admin'
  return 'overview'
}

interface NavItemProps {
  label: string
  active?: boolean
  badge?: string
  badgeColor?: string
  onClick?: () => void
}

function NavItem({ label, active, badge, badgeColor = 'bg-orange-500', onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between pr-4 pl-2 py-1.5 rounded-md text-[11px] transition-colors text-right ${
        active
          ? 'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      <span className="truncate">{label}</span>
      {badge && (
        <span className={`${badgeColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center flex-shrink-0`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function SectionHeader({
  label,
  expanded,
  onToggle,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-2 py-1 mt-0.5 text-[10px] text-gray-400 font-bold uppercase tracking-wide hover:text-gray-600 transition-colors"
    >
      <span className="text-[10px]">{expanded ? '▾' : '◂'}</span>
      <span>{label}</span>
    </button>
  )
}

export default function Sidebar({ page, navigate, posMode }: Props) {
  const activeSection = getSection(page)

  return (
    <div
      className="w-52 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden flex-shrink-0"
      style={{ direction: 'rtl' }}
    >
      {/* Company header */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start gap-2 mb-2.5">
          <div className="w-9 h-9 bg-indigo-900 rounded-lg flex items-center justify-center flex-shrink-0 relative">
            <div className="text-white text-[9px] font-bold text-center leading-none">
              <div>24</div>
              <div className="text-[7px]">hrs</div>
            </div>
            <div className="absolute -top-1 -left-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">!</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-gray-800 leading-tight">Maximum Speed Tech</div>
            <div className="text-[11px] font-bold text-gray-800">Supply LTD</div>
            <div className="text-[10px] text-gray-400">الفرع الرئيسي</div>
          </div>
        </div>
        <button
          onClick={() => navigate('quick-invoice')}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>⚡</span>
          <span>فاتورة جديدة</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {posMode ? (
          <>
            <div className="text-[10px] text-gray-400 px-2 py-1 font-bold">كاونتر</div>
            <NavItem label="الطلبات المعلقة" badge="0" badgeColor="bg-blue-500" />
            <NavItem label="لوحة التحكم" onClick={() => navigate('smart-dashboard')} />
          </>
        ) : (
          <>
            {/* نظرة عامة */}
            <SectionHeader label="نظرة عامة" expanded={activeSection === 'overview'} onToggle={() => navigate('dashboard')} />
            {activeSection === 'overview' && (
              <div className="space-y-0.5">
                <NavItem label="الرئيسية" active={page === 'dashboard'} onClick={() => navigate('dashboard')} />
                <NavItem label="لوحة التحكم" active={page === 'smart-dashboard'} onClick={() => navigate('smart-dashboard')} />
              </div>
            )}

            {/* المبيعات والكاشير */}
            <SectionHeader label="المبيعات والكاشير" expanded={activeSection === 'sales'} onToggle={() => navigate('sales-register')} />
            {activeSection === 'sales' && (
              <div className="space-y-0.5">
                <NavItem label="نقطة البيع" active={page === 'pos'} onClick={() => navigate('pos')} />
                <NavItem label="إدخال الفاتورة السريع" active={page === 'quick-invoice'} onClick={() => navigate('quick-invoice')} />
                <NavItem label="سجل المبيعات" active={page === 'sales-register'} onClick={() => navigate('sales-register')} />
              </div>
            )}

            {/* المخزون والتوريد */}
            <SectionHeader label="المخزون والتوريد" expanded={activeSection === 'stock'} onToggle={() => navigate('inventory')} />
            {activeSection === 'stock' && (
              <div className="space-y-0.5">
                <NavItem label="المخزون" active={page === 'inventory'} badge="2" badgeColor="bg-orange-500" onClick={() => navigate('inventory')} />
                <NavItem label="المشتريات" active={page === 'purchases'} onClick={() => navigate('purchases')} />
                <NavItem label="الموردون" />
                <NavItem label="إدارة المنتجات" />
              </div>
            )}

            {/* المالية والتقارير */}
            <SectionHeader label="المالية والتقارير" expanded={activeSection === 'finance'} onToggle={() => navigate('financial')} />
            {activeSection === 'finance' && (
              <div className="space-y-0.5">
                <NavItem label="المصروفات" active={page === 'expenses'} onClick={() => navigate('expenses')} />
                <NavItem label="المالية والتقارير" active={page === 'financial'} onClick={() => navigate('financial')} />
                <NavItem
                  label="محاسبة متقدمة"
                  active={page === 'advanced-accounting'}
                  onClick={() => navigate('advanced-accounting')}
                />
              </div>
            )}

            {/* إدارات النظام */}
            <SectionHeader label="إدارات النظام" expanded={activeSection === 'admin'} onToggle={() => navigate('crm')} />
            {activeSection === 'admin' && (
              <div className="space-y-0.5">
                <NavItem label="العملاء (CRM)" active={page === 'crm'} onClick={() => navigate('crm')} />
                <NavItem label="الموظفون" />
                <NavItem label="سجل المراقبة" active={page === 'system-log'} onClick={() => navigate('system-log')} />
                <NavItem label="العروض والخصومات" active={page === 'offers'} onClick={() => navigate('offers')} />
                <NavItem label="الاشتراكات والإضافات" />
                <NavItem label="الإعدادات" active={page === 'settings'} onClick={() => navigate('settings')} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom section */}
      <div className="p-2 border-t border-gray-100 flex-shrink-0 space-y-1.5">
        <div className="text-center text-[11px] text-gray-500 font-medium">🎧 الدعم الفني</div>
        <div className="flex gap-1">
          <button className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold py-1 rounded-md transition-colors">واتساب الدعم</button>
          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold py-1 rounded-md transition-colors">إيميل الدعم</button>
        </div>
        <div className="text-center">
          <span className="text-blue-600 text-[11px] cursor-pointer hover:underline">مدير ©</span>
        </div>
        <button className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[11px] font-semibold py-1.5 px-3 rounded-md text-center transition-colors flex items-center justify-center gap-1">
          <span>🚪</span>
          <span>إغلاق الوردية</span>
        </button>
        <div className="text-center">
          <span className="text-gray-400 text-[10px] cursor-pointer hover:text-gray-600">← خروج أمن</span>
        </div>
      </div>
    </div>
  )
}
