import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Search, LayoutGrid as GridIcon, List as ListIcon,
  Table2, LayoutTemplate, Star, StarOff, Eye, EyeOff, ChevronUp, ChevronDown,
} from 'lucide-react';

// ── Category icons map ─────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  'مشروبات':'🥤','شاي':'🍵','قهوة':'☕','عصير':'🍹','وجبات':'🍽️',
  'برغر':'🍔','بيتزا':'🍕','دجاج':'🍗','سمك':'🐟','بيض':'🥚',
  'حلويات':'🍰','كيك':'🎂','تمر':'🌴','بسكويت':'🍪','خضار':'🥬',
  'فاكهة':'🍎','لحوم':'🥩','ألبان':'🥛','مخبوزات':'🥖','عيش':'🍞',
  'بقالة':'🛒','سوبرماركت':'🏪','ملابس':'👕','أحذية':'👟','إكسسوار':'💍',
  'أدوية':'💊','صيدلية':'🏥','إلكترونيات':'📱','كمبيوتر':'💻',
  'كاميرا':'📷','صالون':'✂️','سبا':'💆','خدمات':'🛎️','بلاستيك':'🧴',
  'مواد غذائية':'🥫','ألعاب':'🧸','سبيكة':'🔩','طحين':'🌾',
  'عام':'📦','أخرى':'📦','الكل':'🏷️','★ المفضلة':'⭐',
};

const getCategoryIcon = (cat) => {
  if (!cat) return '📦';
  for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
    if (cat.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(cat.toLowerCase())) return v;
  }
  return '🏷️';
};

const ORDER_TYPES = [
  { value: 'dineIn',   label: 'محلي',  emoji: '🍽️', color: '#6366f1' },
  { value: 'takeaway', label: 'سفري',  emoji: '📦', color: '#f59e0b' },
  { value: 'delivery', label: 'توصيل', emoji: '🛵', color: '#10b981' },
  { value: 'counter',  label: 'سريع',  emoji: '⚡', color: '#ef4444' },
];

// ── Stock status helper ────────────────────────────────────────────────────────
function stockStatus(item) {
  if (item.IsService) return 'service';
  if (item.Stock === 0) return 'out';
  if (item.Stock <= (item.MinStockLevel || 5)) return 'low';
  return 'ok';
}

// ── A) Card Grid ──────────────────────────────────────────────────────────────
function ProductCard({ item, onAdd, showImages, cardSize }) {
  const status = stockStatus(item);
  const isOut  = status === 'out';
  const isLow  = status === 'low';

  const sizeMap = { sm: 'h-[80px]', md: 'h-[100px]', lg: 'h-[130px]' };
  const imgH = sizeMap[cardSize] || sizeMap.md;

  return (
    <button
      disabled={isOut}
      onClick={() => !isOut && onAdd(item)}
      className={`relative flex flex-col items-stretch text-right bg-card p-3 rounded-2xl border-2 transition-all duration-300 font-tajawal group
        ${isOut
          ? 'opacity-50 border-subtle cursor-not-allowed grayscale-[0.5]'
          : 'border-transparent hover:border-primary cursor-pointer hover:shadow-lg hover:-translate-y-1'
        }`}
    >
      {/* Stock ring */}
      {!item.IsService && (
        <span className={`absolute top-2 left-2 h-2.5 w-2.5 rounded-full shadow-sm z-10
          ${status === 'ok'  ? 'bg-emerald-400 shadow-emerald-400/50' :
            status === 'low' ? 'bg-amber-400 shadow-amber-400/50'    :
                               'bg-red-500 shadow-red-500/50'}`}
        />
      )}

      {/* Image / icon */}
      {showImages && (
        <div className={`w-full ${imgH} rounded-xl bg-hover flex items-center justify-center text-4xl mb-3 overflow-hidden relative group-hover:shadow-inner transition-shadow`}>
          {item.Image
            ? <img src={item.Image} alt={item.Name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            : null}
          <span className="group-hover:scale-125 transition-transform duration-300">{getCategoryIcon(item.Category)}</span>
          {isLow && !isOut && (
            <div className="absolute bottom-1 right-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
              باقي {item.Stock}
            </div>
          )}
          {item.IsService && (
            <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">خدمة</div>
          )}
        </div>
      )}

      <p className="m-0 text-[10px] font-black text-primary tracking-wider mb-1">{item.Category || 'عام'}</p>
      <h4 className="m-0 text-sm font-black text-main leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors">{item.Name}</h4>

      <div className="flex items-center justify-between pt-2 border-t border-subtle mt-auto">
        <span className="text-base font-black text-indigo-700">
          {item.Price?.toFixed(2)} <small className="text-[10px]">ر.س</small>
        </span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300
          ${isOut ? 'bg-hover text-muted' : 'bg-indigo-50 text-primary group-hover:bg-primary group-hover:text-white group-hover:rotate-90'}`}>
          <Plus size={16} strokeWidth={3} />
        </div>
      </div>

      {isOut && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-2xl">
          <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg shadow-rose-500/30 rotate-12 scale-110 border-2 border-white">نفذ المخزون</span>
        </div>
      )}
    </button>
  );
}

// ── B) Dense Grid Row ──────────────────────────────────────────────────────────
function DenseRow({ item, onAdd, density, isSelected, onFocus }) {
  const status = stockStatus(item);
  const isOut  = status === 'out';
  const densityClass = density === 'ultra' ? 'pos-dense-row--ultra' : density === 'compact' ? 'pos-dense-row--compact' : '';

  return (
    <div
      tabIndex={0}
      onClick={() => !isOut && onAdd(item)}
      onFocus={onFocus}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isOut) onAdd(item); }}
      className={`pos-dense-row ${densityClass} ${isOut ? 'pos-dense-row--out' : ''} ${isSelected ? 'pos-dense-row--selected' : ''}`}
    >
      {/* SKU / # */}
      <span className="text-[11px] text-muted font-bold truncate">{item.SKU || item.ID}</span>
      {/* Name */}
      <div className="min-w-0">
        <p className="text-sm font-black text-main truncate">{item.Name}</p>
        <p className="text-[10px] text-muted font-bold">{item.Category || 'عام'}</p>
      </div>
      {/* Stock */}
      <span className={`text-xs font-black text-center
        ${status === 'ok'  ? 'text-emerald-600' :
          status === 'low' ? 'text-amber-500'   :
          status === 'out' ? 'text-red-500'      : 'text-indigo-500'}`}>
        {item.IsService ? '—' : item.Stock}
      </span>
      {/* Price */}
      <span className="text-sm font-black text-indigo-700 text-center">{item.Price?.toFixed(2)}</span>
      {/* Tax */}
      <span className="text-[11px] text-muted text-center">{item.TaxRate ? `${item.TaxRate}%` : '15%'}</span>
      {/* Add btn */}
      <button
        disabled={isOut}
        onClick={e => { e.stopPropagation(); !isOut && onAdd(item); }}
        className={`h-7 w-7 rounded-md flex items-center justify-center mx-auto transition-all
          ${isOut ? 'bg-hover text-muted cursor-not-allowed' : 'bg-indigo-50 text-primary hover:bg-primary hover:text-white active:scale-95'}`}
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  );
}

// ── C) List Row ────────────────────────────────────────────────────────────────
function ProductRow({ item, onAdd, isLast, sortKey }) {
  const isOut = stockStatus(item) === 'out';
  const isLow = stockStatus(item) === 'low';

  return (
    <tr
      onClick={() => !isOut && onAdd(item)}
      className={`group transition-colors duration-200
        ${isOut ? 'opacity-50 cursor-not-allowed bg-card' : 'cursor-pointer hover:bg-hover bg-card'}
        ${!isLast ? 'border-b border-subtle' : ''}`}
    >
      <td className="py-2 px-3 w-12 rounded-r-xl">
        <div className="h-10 w-10 rounded-xl bg-hover flex items-center justify-center text-xl overflow-hidden group-hover:shadow-sm">
          {item.Image
            ? <img src={item.Image} alt={item.Name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
            : getCategoryIcon(item.Category)}
        </div>
      </td>
      <td className="py-2 px-2">
        <p className="m-0 text-sm font-black text-main group-hover:text-primary transition-colors">{item.Name}</p>
        <p className="m-0 text-[10px] font-bold text-muted">{item.SKU || (item.Category || 'عام')}</p>
      </td>
      <td className="py-2 px-2 text-[11px] text-muted font-bold">{item.Category || 'عام'}</td>
      <td className="py-2 px-2 text-center">
        {item.IsService
          ? <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">خدمة</span>
          : <span className={`text-xs font-black ${isLow ? 'text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full' : 'text-slate-500'}`}>
              {item.Stock} <small className="text-[9px]">{item.Unit}</small>
            </span>}
      </td>
      <td className="py-2 px-2 text-center font-black text-sm text-indigo-700">{item.Price?.toFixed(2)} <small className="text-[10px]">ر.س</small></td>
      <td className="py-2 px-3 text-center rounded-l-xl">
        <div className={`h-8 w-8 rounded-lg mx-auto flex items-center justify-center transition-all duration-300
          ${isOut ? 'bg-hover text-muted' : 'bg-indigo-50 text-primary group-hover:bg-primary group-hover:text-white group-hover:rotate-90 shadow-sm'}`}>
          <Plus size={16} strokeWidth={3} />
        </div>
      </td>
    </tr>
  );
}

// ── D) Category Tiles ──────────────────────────────────────────────────────────
function CategoryTiles({ categories, categoryCounts, onSelect }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-4 animate-fade-in">
      {categories.filter(c => c !== 'الكل').map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className="pos-category-tile"
        >
          <span className="pos-category-tile__icon">{getCategoryIcon(cat)}</span>
          <span className="pos-category-tile__name">{cat}</span>
          <span className="pos-category-tile__count">{categoryCounts[cat] || 0} صنف</span>
        </button>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const ProductGrid = React.memo(({
  isLoading, filteredMenu, handleItemClick,
  orderType, setOrderType,
  activeCategory, categories, setActiveCategory,
  // From PosPrefs (passed down)
  viewMode: vmProp, setViewMode: setVmProp,
  density: densityProp, setDensity: setDensityProp,
  showImages: showImagesProp, setShowImages: setShowImagesProp,
  cardSize: cardSizeProp, setCardSize: setCardSizeProp,
  favCategories, toggleFavCategory,
  menuItems, // full list for counts
}) => {
  // Local fallbacks if prefs not wired
  const [localVm, setLocalVm]           = useState('grid');
  const [localDensity, setLocalDensity] = useState('comfortable');
  const [localImages, setLocalImages]   = useState(true);
  const [localCardSize, setLocalCardSz] = useState('md');
  const [denseSelected, setDenseSel]    = useState(0);
  const [sortKey, setSortKey]           = useState(null);
  const [sortDir, setSortDir]           = useState('asc');

  const viewMode    = vmProp       ?? localVm;
  const setViewMode = setVmProp    ?? setLocalVm;
  const density     = densityProp  ?? localDensity;
  const setDensity  = setDensityProp ?? setLocalDensity;
  const showImages  = showImagesProp ?? localImages;
  const setShowImages = setShowImagesProp ?? setLocalImages;
  const cardSize    = cardSizeProp ?? localCardSize;

  const onAdd = useCallback((item) => handleItemClick(item), [handleItemClick]);

  // Category item counts
  const categoryCounts = useMemo(() => {
    const src = menuItems || filteredMenu;
    const counts = {};
    src.forEach(item => {
      const cat = item.Category || 'عام';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [menuItems, filteredMenu]);

  // Build augmented categories: add Favorites virtual category
  const allCategories = useMemo(() => {
    const base = categories || [];
    if ((favCategories || []).length > 0) return ['الكل', '★ المفضلة', ...base.filter(c => c !== 'الكل')];
    return base;
  }, [categories, favCategories]);

  // Sorted list for list view
  const sortedMenu = useMemo(() => {
    if (!sortKey || viewMode !== 'list') return filteredMenu;
    return [...filteredMenu].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredMenu, sortKey, sortDir, viewMode]);

  const cycleViewMode = useCallback(() => {
    const modes = ['grid', 'dense', 'list', 'tiles'];
    const idx = modes.indexOf(viewMode);
    setViewMode(modes[(idx + 1) % modes.length]);
  }, [viewMode, setViewMode]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const VIEW_MODES = [
    { m:'grid',  ic:<GridIcon size={16}/>,      tip:'شبكة البطاقات' },
    { m:'dense', ic:<Table2 size={16}/>,        tip:'عرض مكثف' },
    { m:'list',  ic:<ListIcon size={16}/>,       tip:'قائمة' },
    { m:'tiles', ic:<LayoutTemplate size={16}/>, tip:'تصنيفات' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-app font-tajawal relative z-10">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between p-3 border-b border-subtle bg-card shrink-0 shadow-sm relative z-20 gap-2 flex-wrap">
        {/* Order type pills */}
        <div className="flex gap-1 bg-hover p-1 rounded-xl border border-subtle overflow-x-auto scrollbar-hide">
          {ORDER_TYPES.map(o => {
            const act = orderType === o.value;
            return (
              <button key={o.value} onClick={() => setOrderType(o.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-black text-xs transition-all duration-300 whitespace-nowrap
                  ${act ? 'text-white shadow-md transform scale-105' : 'text-muted hover:text-main hover:bg-white/50'}`}
                style={{ backgroundColor: act ? o.color : 'transparent' }}
              >
                <span className="text-sm">{o.emoji}</span>
                <span className={window.innerWidth < 640 ? 'hidden' : 'inline'}>{o.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right toolbar */}
        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
          <div className="flex items-center gap-2">
            {/* Density (grid/dense only) */}
            {(viewMode === 'grid' || viewMode === 'dense') && (
              <select
                value={density}
                onChange={e => setDensity(e.target.value)}
                className="h-8 px-2 rounded-lg border border-subtle bg-hover text-[11px] font-black text-muted outline-none cursor-pointer hover:border-primary transition-colors"
              >
                <option value="comfortable">مريح</option>
                <option value="compact">مضغوط</option>
                <option value="ultra">مكثف</option>
              </select>
            )}

            {/* Image toggle (grid only) */}
            {viewMode === 'grid' && (
              <button onClick={() => setShowImages(v => !v)}
                title={showImages ? 'إخفاء الصور' : 'إظهار الصور'}
                className={`p-2 rounded-lg border border-subtle transition-all text-xs font-black flex items-center gap-1
                  ${showImages ? 'bg-indigo-50 text-primary border-indigo-100' : 'bg-hover text-muted'}`}
              >
                {showImages ? <Eye size={14}/> : <EyeOff size={14}/>}
                <span className="hidden lg:inline">{showImages ? 'صور' : 'بدون صور'}</span>
              </button>
            )}
          </div>

          {/* 4-mode switcher */}
          <div className="flex bg-hover p-1 rounded-xl border border-subtle gap-0.5">
            {VIEW_MODES.map(({ m, ic, tip }) => (
              <button key={m} onClick={() => setViewMode(m)} title={tip}
                className={`pos-view-btn ${viewMode === m ? 'pos-view-btn--active' : ''}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category bar ── */}
      {viewMode !== 'tiles' && (
        <div className="p-3 border-b border-subtle bg-card shrink-0 relative z-10 shadow-sm">
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide snap-x">
            {allCategories.map(cat => {
              const act   = activeCategory === cat;
              const count = cat === 'الكل' ? (menuItems || filteredMenu).length : (categoryCounts[cat] || 0);
              const isFav = cat === '★ المفضلة';
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`pos-category-pill snap-center shrink-0 ${act ? 'pos-category-pill--active' : ''}`}
                >
                  <span className={`text-xl ${act && !isFav ? 'animate-bounce' : ''}`} style={{ animationDuration:'2s' }}>
                    {getCategoryIcon(cat)}
                  </span>
                  <span>{cat}</span>
                  <span className="pos-category-pill__count">{count}</span>
                  {/* Star toggle */}
                  {!isFav && cat !== 'الكل' && toggleFavCategory && (
                    <span
                      onClick={e => { e.stopPropagation(); toggleFavCategory(cat); }}
                      className="text-xs opacity-40 hover:opacity-100 transition-opacity ml-0.5"
                      title="تثبيت التصنيف"
                    >
                      {(favCategories || []).includes(cat) ? '⭐' : '☆'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Product area ── */}
      <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-hide relative z-0">
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 p-4 animate-pulse">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-[200px] rounded-2xl bg-hover border border-subtle" />
            ))}
          </div>
        ) : filteredMenu.length === 0 && viewMode !== 'tiles' ? (
          <div className="flex flex-col items-center justify-center h-full text-muted opacity-80 animate-fade-in">
            <div className="h-24 w-24 rounded-full bg-hover flex items-center justify-center mb-4">
              <Search size={48} className="text-slate-300" />
            </div>
            <p className="font-black text-lg text-main m-0">لا توجد نتائج</p>
            <p className="font-bold text-sm mt-2 text-slate-400">جرّب تصنيفاً مختلفاً أو كلمة بحث أخرى</p>
          </div>
        ) : viewMode === 'tiles' ? (
          <CategoryTiles
            categories={allCategories}
            categoryCounts={categoryCounts}
            onSelect={cat => { setActiveCategory(cat); setViewMode('grid'); }}
          />
        ) : viewMode === 'grid' ? (
          <div className={`grid gap-2 sm:gap-3 p-3 sm:p-4 animate-fade-in [will-change:transform]
            ${density === 'ultra'   ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' :
              density === 'compact' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' :
                                     'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}
          >
            {filteredMenu.map(item => (
              <ProductCard key={item.ID} item={item} onAdd={onAdd} showImages={showImages} cardSize={cardSize} />
            ))}
          </div>
        ) : viewMode === 'dense' ? (
          <div className="animate-slide-up [will-change:transform]">
            {/* Dense header */}
            <div className="pos-dense-header sticky top-0 z-20 shadow-sm backdrop-blur-md bg-card/90">
              <span>رمز</span>
              <span>الصنف</span>
              <span className="text-center">المخزون</span>
              <span className="text-center">السعر</span>
              <span className="text-center">ضريبة</span>
              <span className="text-center">+</span>
            </div>
            {filteredMenu.map((item, idx) => (
              <DenseRow
                key={item.ID}
                item={item}
                onAdd={onAdd}
                density={density}
                isSelected={denseSelected === idx}
                onFocus={() => setDenseSel(idx)}
              />
            ))}
          </div>
        ) : (
          /* List view */
          <div className="bg-card rounded-2xl border-2 border-subtle overflow-hidden shadow-sm animate-slide-up m-4 [will-change:transform]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-hover border-b-2 border-subtle sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="py-3 px-3 text-center text-[11px] font-black text-muted w-12"></th>
                  <th onClick={() => toggleSort('Name')} className="py-3 px-2 text-right text-[11px] font-black text-muted tracking-wider cursor-pointer hover:text-primary transition-colors">
                    <span className="flex items-center gap-1 uppercase">الصنف <SortIcon k="Name"/></span>
                  </th>
                  <th className="py-3 px-2 text-right text-[11px] font-black text-muted hidden sm:table-cell uppercase">التصنيف</th>
                  <th onClick={() => toggleSort('Stock')} className="py-3 px-2 text-center text-[11px] font-black text-muted cursor-pointer hover:text-primary transition-colors">
                    <span className="flex items-center justify-center gap-1 uppercase">المخزون <SortIcon k="Stock"/></span>
                  </th>
                  <th onClick={() => toggleSort('Price')} className="py-3 px-2 text-center text-[11px] font-black text-muted cursor-pointer hover:text-primary transition-colors">
                    <span className="flex items-center justify-center gap-1 uppercase">السعر <SortIcon k="Price"/></span>
                  </th>
                  <th className="py-3 px-3 text-center text-[11px] font-black text-muted w-12 hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {sortedMenu.map((item, idx) => (
                  <ProductRow key={item.ID} item={item} onAdd={onAdd} isLast={idx === sortedMenu.length - 1} sortKey={sortKey} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';
export default ProductGrid;
