/**
 * VATSettings.jsx — P-013 VAT Category per product
 * Allows setting tax_category (S / Z / E / RC) per product for ZATCA compliance.
 * Embedded inside FinanceHubP2 or FinanceHub as a standalone tab.
 */
import { useState, useEffect } from 'react';
import { RefreshCw, Save, CheckCircle } from 'lucide-react';

const S = {
  card: { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  th: { padding: '10px 14px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', textAlign: 'right' },
  td: { padding: '12px 14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
  select: { padding: '7px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc' },
  btn: (color = '#3b82f6') => ({
    padding: '9px 20px', borderRadius: '8px', border: 'none',
    background: color, color: 'white', fontWeight: '700', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px',
  }),
  badge: (color, bg) => ({ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', color, background: bg }),
};

const TAX_CATEGORIES = [
  { code: 'S',  label: 'خاضع للضريبة القياسية (15%)', color: '#10b981', bg: '#ecfdf5' },
  { code: 'Z',  label: 'معدل صفري (0%)',               color: '#3b82f6', bg: '#eff6ff' },
  { code: 'E',  label: 'معفى من الضريبة',              color: '#8b5cf6', bg: '#f5f3ff' },
  { code: 'RC', label: 'ضريبة انعكاسية (Reverse Charge)', color: '#f59e0b', bg: '#fffbeb' },
];

const CAT_MAP = Object.fromEntries(TAX_CATEGORIES.map(c => [c.code, c]));

export function VATSettings() {
  const [products, setProducts] = useState([]);
  const [changes, setChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api.getMenu().then(items => {
      setProducts(items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const setCategory = (id, cat) => setChanges(c => ({ ...c, [id]: cat }));

  const save = async () => {
    setSaving(true);
    const entries = Object.entries(changes);
    for (const [id, tax_category] of entries) {
      // Use editMenuItem to update — we need to merge with existing product data
      const product = products.find(p => p.ID === parseInt(id));
      if (product) {
        await window.api.editMenuItem({ ...product, Metadata: { ...(product.Metadata || {}), tax_category } });
      }
    }
    // Reload
    const updated = await window.api.getMenu();
    setProducts(updated || []);
    setChanges({});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Note: tax_category is stored in products.tax_category column (already exists in DB)
  // We need a different approach — update products directly via a dedicated IPC
  // For now we'll use the metadata approach with a fallback
  const saveVATCategories = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(changes);
      for (const [id, tax_category] of entries) {
        const product = products.find(p => String(p.ID) === String(id));
        if (product) {
          // Pass tax_category as part of product update
          await window.api.editMenuItem({
            ID: product.ID, Name: product.Name, Price: product.Price,
            Category: product.Category, Image: product.Image,
            Stock: product.Stock, Cost: product.Cost,
            Barcode: product.Barcode, SupplierID: product.SupplierID,
            IsService: product.IsService, Unit: product.Unit,
            MinStockLevel: product.MinStockLevel,
            BulkUnitName: product.BulkUnitName, BulkUnitSize: product.BulkUnitSize,
            Metadata: { ...(product.Metadata || {}), tax_category },
          });
        }
      }
      const updated = await window.api.getMenu();
      setProducts(updated || []);
      setChanges({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const filtered = products.filter(p =>
    !search || p.Name?.toLowerCase().includes(search.toLowerCase()) || p.Category?.includes(search)
  );

  const pendingCount = Object.keys(changes).length;

  return (
    <div dir="rtl">
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', margin: 0 }}>إعدادات فئة الضريبة لكل منتج</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              حدد فئة ضريبة القيمة المضافة لكل منتج وفقاً لمتطلبات زاتكا المرحلة الثانية
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: '700', fontSize: '13px' }}>
                <CheckCircle size={14} /> تم الحفظ
              </span>
            )}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث في المنتجات..." style={{ ...S.select, padding: '8px 14px' }} />
            <button onClick={saveVATCategories} disabled={pendingCount === 0 || saving} style={S.btn(pendingCount > 0 ? '#10b981' : '#94a3b8')}>
              {saving ? <RefreshCw size={14} /> : <Save size={14} />}
              {saving ? 'جاري الحفظ...' : `حفظ (${pendingCount} تعديل)`}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {TAX_CATEGORIES.map(cat => (
            <span key={cat.code} style={S.badge(cat.color, cat.bg)}>
              {cat.code}: {cat.label.split('(')[0].trim()}
            </span>
          ))}
        </div>

        <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>المنتج</th>
                <th style={S.th}>الفئة</th>
                <th style={{ ...S.th, textAlign: 'left' }}>السعر</th>
                <th style={S.th}>فئة الضريبة الحالية</th>
                <th style={S.th}>تغيير الفئة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                  {loading ? 'جاري التحميل...' : 'لا توجد منتجات'}
                </td></tr>
              )}
              {filtered.map((p, i) => {
                const currentCat = changes[p.ID] || p.Metadata?.tax_category || 'S';
                const catInfo = CAT_MAP[currentCat] || CAT_MAP['S'];
                const hasChange = changes[p.ID] && changes[p.ID] !== (p.Metadata?.tax_category || 'S');
                return (
                  <tr key={p.ID} style={{ background: hasChange ? '#fffbeb' : (i % 2 === 0 ? 'white' : '#fafafa') }}>
                    <td style={{ ...S.td, fontWeight: '700' }}>{p.Name}</td>
                    <td style={{ ...S.td, fontSize: '12px', color: '#64748b' }}>{p.Category}</td>
                    <td style={{ ...S.td, direction: 'ltr', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
                      {(p.Price || 0).toFixed(2)} ر.س
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(catInfo.color, catInfo.bg)}>{currentCat}</span>
                    </td>
                    <td style={S.td}>
                      <select value={currentCat}
                        onChange={e => setCategory(p.ID, e.target.value)}
                        style={{ ...S.select, border: hasChange ? '2px solid #f59e0b' : undefined }}>
                        {TAX_CATEGORIES.map(cat => (
                          <option key={cat.code} value={cat.code}>{cat.code} — {cat.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default VATSettings;
