import React, { createContext, useContext } from 'react';
import { usePosPreferences } from '../hooks/usePosPreferences';
import { useAuthStore } from '../../../store/useAuthStore';

const PosPrefsContext = createContext(null);

export function PosPrefsProvider({ children }) {
  const currentUser = useAuthStore(s => s.currentUser);
  const { prefs, setPrefs, resetPrefs, toggleFavCategory } = usePosPreferences(currentUser?.id);

  return (
    <PosPrefsContext.Provider value={{ prefs, setPrefs, resetPrefs, toggleFavCategory }}>
      {children}
    </PosPrefsContext.Provider>
  );
}

export function usePosPrefs() {
  const ctx = useContext(PosPrefsContext);
  if (!ctx) throw new Error('usePosPrefs must be used within PosPrefsProvider');
  return ctx;
}

export default PosPrefsContext;
