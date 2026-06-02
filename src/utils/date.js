// ── Global Date Formatter ──────────────────────────────────────────────────
// Reads the global date format preference from window.__dateFormat__ (set in App.jsx)

export const formatDate = (dateInput, options = {}) => {
  const d = new Date(dateInput);
  if (isNaN(d)) return dateInput;
  
  const format = window.__dateFormat__ || 'hijri';
  const calendar = format === 'gregorian' ? 'gregory' : 'islamic-umalqura';
  
  return d.toLocaleDateString('ar-SA', { calendar, ...options });
};

export const formatDateTime = (dateInput, options = {}) => {
  const d = new Date(dateInput);
  if (isNaN(d)) return dateInput;
  
  const format = window.__dateFormat__ || 'hijri';
  const calendar = format === 'gregorian' ? 'gregory' : 'islamic-umalqura';
  
  return d.toLocaleString('ar-SA', { calendar, ...options });
};
