import { useState, useCallback, useEffect } from 'react';

const DEFAULT_PREFS = {
  viewMode: 'grid',       // 'grid' | 'dense' | 'list' | 'tiles'
  density: 'comfortable', // 'comfortable' | 'compact' | 'ultra'
  showImages: true,
  showSKU: true,
  cardSize: 'md',         // 'sm' | 'md' | 'lg'
  favCategories: [],
  activeCategory: 'الكل',
};

function getStorageKey(userId, deviceId) {
  return `pos-prefs-${userId || 'guest'}-${deviceId || 'default'}`;
}

function getDeviceId() {
  let id = localStorage.getItem('pos-device-id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem('pos-device-id', id);
  }
  return id;
}

export function usePosPreferences(userId) {
  const key = getStorageKey(userId, getDeviceId());

  const [prefs, setPrefsState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    } catch (_) {}
    return { ...DEFAULT_PREFS };
  });

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch (_) {}
  }, [prefs, key]);

  const setPrefs = useCallback((patch) => {
    setPrefsState(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState({ ...DEFAULT_PREFS });
    localStorage.removeItem(key);
  }, [key]);

  const toggleFavCategory = useCallback((cat) => {
    setPrefsState(prev => {
      const favs = prev.favCategories || [];
      const next = favs.includes(cat) ? favs.filter(c => c !== cat) : [...favs, cat];
      return { ...prev, favCategories: next };
    });
  }, []);

  return { prefs, setPrefs, resetPrefs, toggleFavCategory };
}
