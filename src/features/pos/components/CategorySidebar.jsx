import React from 'react';
import { Search, Monitor, Printer, LayoutGrid, AlertTriangle, ChevronRight, Settings, BarChart2, Clock } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const CATEGORY_ICONS = {
  'مشروبات': '🥤', 'شاي': '🍵', 'قهوة': '☕', 'عصير': '🍹',
  'وجبات': '🍽️', 'برغر': '🍔', 'بيتزا': '🍕', 'دجاج': '🍗', 'سمك': '🐟', 'بيض': '🥚',
  'حلويات': '🍰', 'كيك': '🎂', 'تمر': '🌴', 'بسكويت': '🍪',
  'خضار': '🥬', 'فاكهة': '🍎', 'لحوم': '🥩', 'ألبان': '🥛',
  'مخبوزات': '🥖', 'عيش': '🍞', 'بقالة': '🛒', 'سوبرماركت': '🏪',
  'ملابس': '👕', 'أحذية': '👟', 'إكسسوار': '💍',
  'أدوية': '💊', 'صيدلية': '🏥', 'مستلزمات طبية': '🩺',
  'إلكترونيات': '📱', 'كمبيوتر': '💻', 'كاميرا': '📷',
  'صالون': '✂️', 'سبا': '💆', 'خدمات': '🛎️',
  'عام': '📦', 'أخرى': '📦',
};

const getCategoryIcon = (cat) => {
  if (!cat) return '📦';
  const lower = cat.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return icon;
  }
  return '🏷️';
};

const CategorySidebar = React.memo(({
  settings,
  search,
  setSearch,
  activeCategory,
  setActiveCategory,
  categories,
  heldOrdersCount,
  setShowHeld,
  hwStatus,
  minimal = false,
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.currentUser);

  const printerOk = hwStatus?.printer !== 'error';
  const printerBusy = hwStatus?.printer === 'printing';
  const drawerOpen = hwStatus?.drawer === 'open';

  if (minimal) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
              activeCategory === c
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white text-slate-600 hover:bg-slate-100 shadow-sm ring-1 ring-slate-200'
            }`}
          >
            <span className="ml-2">{c === 'الكل' ? '📦' : getCategoryIcon(c)}</span>
            {c}
          </button>
        ))}
      </div>
    );
  }

  return (
    <aside
      className="pos-sidebar glass-panel"
      style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', background: 'white' }}
    >
      {/* ── Brand header ── */}
      <div
        className="sidebar-brand"
        style={{ padding: '18px 16px 14px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.3)' }}>
            {settings?.business_logo
              ? <img src={settings.business_logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
              : '💠'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="sidebar-label" style={{ fontSize: '14px', fontWeight: '900', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {settings?.business_name_ar || 'البصمة الذكية'}
            </div>
            <div className="sidebar-label" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
              {currentUser?.name || 'Guest'} — {currentUser?.role === 'Admin' ? 'مدير' : 'كاشير'}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="sidebar-search" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="البحث بالاسم أو الباركود..."
            autoFocus
            style={{
              width: '100%',
              padding: '10px 36px 10px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Printer warning */}
      {!printerOk && (
        <div style={{ margin: '10px 12px 0', padding: '9px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', color: '#92400e', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={14} /> الطابعة غير متصلة
        </div>
      )}

      {/* ── Categories ── */}
      <div className="sidebar-search" style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', padding: '4px 10px 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>التصنيفات</div>
        {categories.map(c => {
          const isActive = activeCategory === c;
          return (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                background: isActive ? '#6366f1' : 'transparent',
                color: isActive ? 'white' : '#475569',
                fontWeight: '800',
                fontSize: '13px',
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.18s',
                boxShadow: isActive ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '17px', lineHeight: 1 }}>{c === 'الكل' ? '📦' : getCategoryIcon(c)}</span>
              <span className="sidebar-label">{c}</span>
              {isActive && <ChevronRight size={14} style={{ marginRight: 'auto', opacity: 0.7 }} />}
            </button>
          );
        })}
      </div>

      {/* ── Footer actions ── */}
      <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fafbff', flexShrink: 0 }}>
        {/* Held orders */}
        <button
          onClick={() => setShowHeld(true)}
          style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: '800', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: '#475569', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} color="#6366f1" />
            <span className="sidebar-label">الطلبات المعلقة</span>
          </div>
          {heldOrdersCount > 0 && (
            <span style={{ background: '#6366f1', color: 'white', padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: '900' }}>
              {heldOrdersCount}
            </span>
          )}
        </button>

        {/* Nav buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px', gap: '6px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', color: '#475569' }}
          >
            <BarChart2 size={14} color="#6366f1" />
            <span className="sidebar-label">لوحة التحكم</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            style={{ padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Customer display */}
        <button
          onClick={() => window.api?.openCustomerDisplay?.().catch(() => {})}
          style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', color: '#475569' }}
        >
          <Monitor size={14} color="#6366f1" />
          <span className="sidebar-label">شاشة العميل</span>
        </button>

        {/* HW status strip */}
        <div style={{ padding: '10px 12px', background: 'white', borderRadius: '10px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '800', color: !printerOk ? '#d97706' : printerBusy ? '#6366f1' : '#475569' }}>
              <Printer size={11} />
              <span className="sidebar-label">{!printerOk ? 'خطأ في الطابعة' : printerBusy ? 'جاري الطباعة...' : 'الطابعة جاهزة'}</span>
            </div>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: !printerOk ? '#f59e0b' : printerBusy ? '#6366f1' : '#10b981' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '800', color: drawerOpen ? '#d97706' : '#475569' }}>
              <LayoutGrid size={11} />
              <span className="sidebar-label">{drawerOpen ? 'الدرج مفتوح' : 'الدرج مغلق'}</span>
            </div>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: drawerOpen ? '#f59e0b' : '#10b981' }} />
          </div>
        </div>
      </div>
    </aside>
  );
});

export default CategorySidebar;
