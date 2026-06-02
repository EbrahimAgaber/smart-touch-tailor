/**
 * InventoryCostingTab.jsx — P-018 Inventory Costing Viewer
 * Displays open inventory batches per product (FIFO / AVCO).
 * Costing method is read from business settings and can be toggled here.
 */
import { useState, useEffect } from 'react';
import { RefreshCw, Package } from 'lucide-react';

const sar = (n) => (parseFloat(n) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const S = {
  card: { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  th: { padding: '10px 14px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
  select: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc' },
  btn: (color = '#3b82f6') => ({ padding: '9px 18px', borderRadius: '8px', border: 'none', background: color, color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }),
  badge: (color, bg) => ({ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', color, background: bg }),
};

export function InventoryCostingTab() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [batches, setBatches] = useState([]);
  const [costingMethod, setCostingMethod] = useState('AVCO');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    window.api.getMenu().then(items => setProducts(items || [])).catch(() => {});
    window.api.getSettings().then(s => {
      setSettings(s);
      setCostingMethod(s?.costing_method || 'AVCO');
    }).catch(() => {});
  }, []);

  const loadBatches = async (pid) => {
    setSelectedId(pid);
    setLoading(true);
    try {
      const rows = await window.api.p2.getInventoryBatches ? 
        await window.api.p2.getInventoryBatches({ productId: pid }) :
        [];
      setBatches(rows || []);
    } catch(e) { setBatches([]); }
    setLoading(false);
  };

  const saveMethod = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg('');
    try {
      await window.api.saveSettings({ ...settings, costing_method: costingMethod });
      setMsg(`✓ تم حفظ طريقة التكلفة: ${costingMethod}`);
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { setMsg('فشل الحفظ'); }
    setSaving(false);
  };

  const selectedProduct = products.find(p => p.ID === selectedId);

  // Compute AVCO from open batches
  const totalQty = batches.reduce((s, b) => s + (b.quantity_remaining || 0), 0);
  const totalCostValue = batches.reduce((s, b) => s + (b.quantity_remaining || 0) * (b.unit_cost || 0), 0);
  const avco = totalQty > 0 ? totalCostValue / totalQty : 0;

  return (
    <div dir="rtl">
      {/* Settings card */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', margin: 0 }}>طريقة تقييم المخزون</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              تؤثر على حسابات تكلفة البضاعة المباعة (COGS) عند كل عملية بيع
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select value={costingMethod} onChange={e => setCostingMethod(e.target.value)} style={S.select}>
              <option value="AVCO">AVCO — متوسط التكلفة المرجح</option>
              <option value="FIFO">FIFO — الأول في، الأول خارج</option>
            </select>
            <button onClick={saveMethod} disabled={saving} style={S.btn('#10b981')}>
              {saving ? <RefreshCw size={14}/> : null} حفظ الطريقة
            </button>
          </div>
        </div>
        {msg && (
          <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: '700', color: msg.startsWith('✓') ? '#10b981' : '#ef4444' }}>
            {msg}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'AVCO', title: 'متوسط التكلفة المرجح', desc: 'يحسب متوسط تكلفة جميع الكميات المتاحة. أبسط وأكثر استقراراً.', active: costingMethod === 'AVCO', color: '#3b82f6' },
            { label: 'FIFO', title: 'الأول في، الأول خارج', desc: 'يستخدم تكلفة أقدم دفعة أولاً. يعطي تكلفة أدق لأسعار المخزون المتذبذبة.', active: costingMethod === 'FIFO', color: '#8b5cf6' },
          ].map(m => (
            <div key={m.label} style={{ flex: 1, minWidth: '220px', padding: '14px', borderRadius: '10px', border: `2px solid ${m.active ? m.color : '#e2e8f0'}`, background: m.active ? `${m.color}08` : '#f8fafc', cursor: 'pointer' }}
              onClick={() => setCostingMethod(m.label)}>
              <div style={{ fontWeight: '900', fontSize: '13px', color: m.active ? m.color : '#374151', marginBottom: '4px' }}>{m.label} — {m.title}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch viewer */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', margin: 0 }}>
            <Package size={16} style={{ marginLeft: '8px', verticalAlign: 'middle' }} />
            دفعات المخزون المتاحة
          </h3>
          <select value={selectedId || ''} onChange={e => e.target.value && loadBatches(parseInt(e.target.value))} style={{ ...S.select, minWidth: '240px' }}>
            <option value="">اختر منتجاً لعرض دفعاته...</option>
            {products.filter(p => !p.IsService).map(p => (
              <option key={p.ID} value={p.ID}>{p.Name} ({p.Category})</option>
            ))}
          </select>
        </div>

        {!selectedId && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            اختر منتجاً من القائمة أعلاه لعرض دفعاته المخزنية
          </div>
        )}

        {selectedId && (
          <>
            {/* Summary row */}
            {!loading && batches.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'إجمالي الكميات المتاحة', val: totalQty.toLocaleString('ar-SA') + ' وحدة', color: '#3b82f6' },
                  { label: 'إجمالي القيمة (تكلفة)', val: `${sar(totalCostValue)} ر.س`, color: '#10b981' },
                  { label: costingMethod === 'AVCO' ? 'التكلفة المتوسطة المرجحة' : 'تكلفة أقدم دفعة (FIFO)', val: `${sar(costingMethod === 'AVCO' ? avco : (batches[0]?.unit_cost || 0))} ر.س`, color: '#8b5cf6' },
                  { label: 'عدد الدفعات المفتوحة', val: batches.length, color: '#f59e0b' },
                ].map((item, i) => (
                  <div key={i} style={{ flex: 1, minWidth: '150px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: item.color }}>{item.val}</div>
                  </div>
                ))}
              </div>
            )}

            {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>جاري التحميل...</div>}

            {!loading && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>تاريخ الاستلام</th>
                    <th style={S.th}>الكمية المستلمة</th>
                    <th style={S.th}>الكمية المتبقية</th>
                    <th style={S.th}>تكلفة الوحدة (ر.س)</th>
                    <th style={S.th}>القيمة الإجمالية (ر.س)</th>
                    <th style={S.th}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                        لا توجد دفعات مخزنية لهذا المنتج — أضف دفعات عبر استلام أوامر الشراء
                      </td>
                    </tr>
                  )}
                  {batches.map((b, i) => {
                    const pctConsumed = b.quantity_received > 0 ? ((b.quantity_received - b.quantity_remaining) / b.quantity_received) * 100 : 0;
                    return (
                      <tr key={b.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ ...S.td, color: '#94a3b8', fontSize: '11px' }}>{b.id}</td>
                        <td style={S.td}>{b.received_date}</td>
                        <td style={{ ...S.td, direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{b.quantity_received}</td>
                        <td style={{ ...S.td, direction: 'ltr', fontWeight: '800', color: b.quantity_remaining > 0 ? '#0f172a' : '#94a3b8' }}>
                          {b.quantity_remaining}
                        </td>
                        <td style={{ ...S.td, direction: 'ltr', fontWeight: '700', color: '#3b82f6' }}>{sar(b.unit_cost)}</td>
                        <td style={{ ...S.td, direction: 'ltr', fontWeight: '700', color: '#10b981' }}>
                          {sar(b.quantity_remaining * b.unit_cost)}
                        </td>
                        <td style={S.td}>
                          {b.quantity_remaining === 0
                            ? <span style={S.badge('#94a3b8', '#f1f5f9')}>مستنفد</span>
                            : b.quantity_remaining < b.quantity_received
                              ? <span style={S.badge('#f59e0b', '#fffbeb')}>جزئي ({pctConsumed.toFixed(0)}% مستخدم)</span>
                              : <span style={S.badge('#10b981', '#ecfdf5')}>كامل</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InventoryCostingTab;
