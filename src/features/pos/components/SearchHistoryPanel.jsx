import React from 'react';
import { Clock, TrendingUp, X, Trash2 } from 'lucide-react';

/**
 * SearchHistoryPanel
 * Dropdown below the search bar showing:
 *  - Recent searches (clickable chips)
 *  - Recently added items (avatar + name + price)
 */
export default function SearchHistoryPanel({
  searchHistory = [],
  recentItems = [],
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
  onSelectItem,
  onClose,
}) {
  const hasHistory = searchHistory.length > 0;
  const hasRecents = recentItems.length > 0;

  if (!hasHistory && !hasRecents) return null;

  return (
    <div className="pos-search-history" onClick={e => e.stopPropagation()}>

      {/* Recent Searches */}
      {hasHistory && (
        <div className="p-3 border-b border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-muted uppercase tracking-widest">
              <Clock size={11}/> بحث حديث
            </span>
            <button onClick={onClearHistory}
              className="text-[10px] font-bold text-muted hover:text-rose-500 transition-colors flex items-center gap-1">
              <Trash2 size={10}/> مسح الكل
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {searchHistory.map((q, i) => (
              <div key={i} className="pos-search-history__chip group">
                <button onClick={() => onSelectHistory?.(q)} className="flex items-center gap-1">
                  <Clock size={10}/> {q}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onRemoveHistory?.(q); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hover:text-rose-500">
                  <X size={9}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Added Items */}
      {hasRecents && (
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={11} className="text-muted"/>
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">أضفت مؤخراً</span>
          </div>
          <div className="space-y-1">
            {recentItems.slice(0, 5).map((item) => (
              <button key={item.ID} onClick={() => onSelectItem?.(item)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-hover transition-colors text-right group">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-lg shrink-0 group-hover:bg-indigo-100 transition-colors">
                  {item.Image
                    ? <img src={item.Image} alt={item.Name} className="w-full h-full object-cover rounded-lg"/>
                    : '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[13px] font-black text-main truncate group-hover:text-primary transition-colors">{item.Name}</p>
                  <p className="m-0 text-[10px] text-muted font-bold">{item.Category || 'عام'}</p>
                </div>
                <span className="text-sm font-black text-indigo-600 shrink-0">{item.Price?.toFixed(2)} <small className="text-[9px]">ر.س</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
