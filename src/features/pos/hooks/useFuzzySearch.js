import { useState, useDeferredValue, useMemo, useCallback, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';

// ── Arabic normalization ───────────────────────────────────────────────────────
// Strips tashkeel (diacritics) and normalises alef variants for robust matching
function normalizeArabic(str) {
  if (!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '')   // Remove tashkeel
    .replace(/[أإآٱ]/g, 'ا')                  // Normalise alef
    .replace(/ة/g, 'ه')                       // Normalise ta marbuta
    .replace(/ى/g, 'ي')                       // Normalise alef maqsura
    .toLowerCase()
    .trim();
}

const HISTORY_KEY = 'pos-search-history';
const MAX_HISTORY = 10;
const MAX_RECENTS = 8;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (_) {}
}

export function useFuzzySearch(menuItems) {
  const [search, setSearchRaw] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [searchHistory, setSearchHistory] = useState(loadHistory);
  const [recentItems, setRecentItems] = useState([]);

  // Persist history on change
  useEffect(() => {
    saveHistory(searchHistory);
  }, [searchHistory]);

  const deferredSearch   = useDeferredValue(search);
  const deferredCategory = useDeferredValue(activeCategory);

  // Build Fuse instance whenever menu changes
  const fuseRef = useRef(null);
  useMemo(() => {
    fuseRef.current = new Fuse(menuItems, {
      keys: [
        { name: 'Name',     weight: 0.45 },
        { name: 'NameNorm', weight: 0.35 },
        { name: 'Barcode',  weight: 0.35 },
        { name: 'SKU',      weight: 0.25 },
        { name: 'Category', weight: 0.15 },
        { name: 'Tags',     weight: 0.10 },
      ],
      threshold: 0.38,
      includeScore: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
    });
  }, [menuItems]);

  // Pre-compute normalised names for Arabic fuzzy matching
  const normalizedMenu = useMemo(() =>
    menuItems.map(item => ({
      ...item,
      NameNorm: normalizeArabic(item.Name),
    })),
  [menuItems]);

  // Rebuild Fuse with normalized items
  useMemo(() => {
    fuseRef.current = new Fuse(normalizedMenu, {
      keys: [
        { name: 'Name',     weight: 0.45 },
        { name: 'NameNorm', weight: 0.35 },
        { name: 'Barcode',  weight: 0.35 },
        { name: 'SKU',      weight: 0.25 },
        { name: 'Category', weight: 0.15 },
        { name: 'Tags',     weight: 0.10 },
      ],
      threshold: 0.38,
      includeScore: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
    });
  }, [normalizedMenu]);

  const filteredMenu = useMemo(() => {
    const catAll = deferredCategory === 'الكل';
    const isFav  = deferredCategory === '★ المفضلة';

    // Category-only filter (no search)
    let pool = normalizedMenu;
    if (!catAll && !isFav) {
      pool = pool.filter(item => (item.Category || 'عام') === deferredCategory);
    }

    if (!deferredSearch) {
      return pool;
    }

    // Attempt direct barcode / SKU match first (exact)
    const exactBarcode = pool.find(item =>
      item.Barcode && item.Barcode === deferredSearch.trim()
    );
    if (exactBarcode) return [exactBarcode];

    const exactSku = pool.find(item =>
      item.SKU && item.SKU.toLowerCase() === deferredSearch.toLowerCase().trim()
    );
    if (exactSku) return [exactSku];

    // Fuzzy search on current pool
    const normalizedQ = normalizeArabic(deferredSearch);
    const queryTokens  = [deferredSearch, normalizedQ].filter(Boolean);

    // Build a temporary Fuse over the current pool
    const localFuse = new Fuse(pool, {
      keys: [
        { name: 'Name',     weight: 0.45 },
        { name: 'NameNorm', weight: 0.35 },
        { name: 'Barcode',  weight: 0.35 },
        { name: 'SKU',      weight: 0.25 },
        { name: 'Category', weight: 0.15 },
        { name: 'Tags',     weight: 0.10 },
      ],
      threshold: 0.38,
      includeScore: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
    });

    const rawResults = localFuse.search(normalizedQ.length >= 2 ? normalizedQ : deferredSearch);
    return rawResults.map(r => r.item);
  }, [normalizedMenu, deferredCategory, deferredSearch]);

  // ── Search history helpers ─────────────────────────────────────────────────
  const setSearch = useCallback((q) => {
    setSearchRaw(q);
  }, []);

  const commitSearch = useCallback((q) => {
    if (!q || q.trim().length < 2) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h !== q.trim());
      return [q.trim(), ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    saveHistory([]);
  }, []);

  const removeHistoryItem = useCallback((q) => {
    setSearchHistory(prev => prev.filter(h => h !== q));
  }, []);

  // ── Recent items tracking ──────────────────────────────────────────────────
  const trackRecentItem = useCallback((item) => {
    setRecentItems(prev => {
      const filtered = prev.filter(r => r.ID !== item.ID);
      return [item, ...filtered].slice(0, MAX_RECENTS);
    });
  }, []);

  return {
    search,
    setSearch,
    commitSearch,
    activeCategory,
    setActiveCategory,
    filteredMenu,
    searchHistory,
    clearHistory,
    removeHistoryItem,
    recentItems,
    trackRecentItem,
    normalizeArabic,
  };
}
