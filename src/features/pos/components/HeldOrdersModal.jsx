import { memo, useEffect } from 'react';
import { X, Clock, ShoppingCart, RotateCcw, Trash2, FileDown } from 'lucide-react';
import { useToast } from '../../../components/ToastManager';

/**
 * HeldOrdersModal
 *
 * Props from Pos.jsx:
 *   heldOrders     {array}   — list of held order objects
 *   setHeldOrders  {fn}      — state setter for held orders
 *   clearCart      {fn}      — clears the current cart before restoring
 *   order          {array}   — current cart items (warn if non-empty)
 *   onClose        {fn}      — close handler
 */
const HeldOrdersModal = memo(function HeldOrdersModal({
  heldOrders,
  setHeldOrders,
  clearCart,
  order,
  onClose,
  settings = {},
}) {
  const { toast } = useToast();
  useEffect(() => {
    document.body.dataset.modalOpen = '1';
    return () => delete document.body.dataset.modalOpen;
  }, []);

  const handleRestore = async (heldOrder) => {
    // Warn if cart has items
    if (order && order.length > 0) {
      const confirmed = window.confirm('السلة الحالية تحتوي على أصناف. هل تريد مسحها واسترجاع الطلب المعلق؟');
      if (!confirmed) return;
    }
    try {
      // Delete from held_orders table
      if (window.api?.deleteHeldOrder) {
        await window.api.deleteHeldOrder(heldOrder.id);
      }
      // Restore items to cart via useCartStore
      if (clearCart) clearCart();
      // We push items back — import useCartStore is not available here,
      // so we dispatch through window event for Pos.jsx to catch
      window.dispatchEvent(new CustomEvent('pos:restore-held', { detail: heldOrder }));
      // Refresh held orders list
      if (window.api?.getHeldOrders) {
        const updated = await window.api.getHeldOrders();
        setHeldOrders(updated || []);
      }
      onClose();
      toast(`تم استرجاع الطلب: ${heldOrder.label}`, 'success');
    } catch (e) {
      toast('خطأ في استرجاع الطلب: ' + e.message, 'error');
    }
  };

  const handlePrintQuote = (h) => {
    const total = (h.items || []).reduce((acc, i) => acc + (i.Price * i.Qty), 0);
    const subtotal = total / 1.15;
    const vatAmt = total - subtotal;
    const c = h.customer || {};
    const quoteHtml = `
      <html dir="rtl">
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
          body { font-family: 'Tajawal', sans-serif; padding: 20px; color: #1e293b; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
          .biz-info h1 { margin: 0; font-size: 22px; font-weight: 900; color: #1e3a8a; }
          .biz-info p { margin: 2px 0; font-size: 11px; color: #64748b; }
          .doc-type { text-align: left; }
          .doc-type h2 { margin: 0; font-size: 24px; font-weight: 900; color: #3b82f6; opacity: 0.2; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-section { background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; }
          .info-section h3 { font-size: 12px; font-weight: 800; color: #3b82f6; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .info-section p { margin: 4px 0; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f1f5f9; padding: 10px; text-align: right; font-size: 12px; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
          td { padding: 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
          .financials { display: flex; justify-content: space-between; gap: 40px; }
          .bank-info { flex: 1; background: #f0fdf4; padding: 15px; border-radius: 12px; border: 1px solid #bbf7d0; }
          .bank-info h3 { font-size: 12px; color: #166534; margin: 0 0 8px 0; }
          .bank-info p { margin: 3px 0; font-size: 11px; color: #166534; }
          .totals-box { width: 220px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
          .total-row.grand { border-top: 2px solid #3b82f6; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: 900; color: #1e3a8a; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="biz-info">
            <h1>${settings.business_name_ar || 'اسم المنشأة'}</h1>
            <p>الرقم الضريبي: ${settings.vat_number || '—'}</p>
            <p>العنوان الوطني: ${settings.national_address_building || ''} ${settings.national_address_street || ''}, ${settings.national_address_district || ''}, ${settings.national_address_city || ''} ${settings.national_address_postal || ''}</p>
            <p>هاتف: ${settings.phone || ''} | ${settings.email || ''}</p>
          </div>
          <div class="doc-type">
            <h2>QUOTATION</h2>
            <p style="font-weight:700;">عرض سعر #QT-${Math.floor(Date.now()/100000)}</p>
            <p>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-section">
            <h3>العميل (Customer)</h3>
            <p><strong>الاسم:</strong> ${c.name || h.label}</p>
            ${c.phone ? `<p><strong>الجوال:</strong> ${c.phone}</p>` : ''}
            ${c.tax_id ? `<p><strong>الرقم الضريبي:</strong> ${c.tax_id}</p>` : ''}
            ${c.address || c.na_street ? `<p><strong>العنوان:</strong> ${c.na_building || ''} ${c.na_street || c.address || ''}, ${c.na_district || ''}, ${c.na_city || ''}</p>` : ''}
          </div>
          <div class="info-section">
            <h3>شروط العرض (Terms)</h3>
            <p>• هذا العرض صالح لمدة 7 أيام عمل.</p>
            <p>• الأسعار تشمل ضريبة القيمة المضافة 15%.</p>
            <p>• التوصيل: ${settings.address ? 'من مقر المنشأة' : 'حسب الاتفاق'}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th style="text-align:center;">الكمية</th>
              <th style="text-align:left;">السعر</th>
              <th style="text-align:left;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${(h.items || []).map(i => `
              <tr>
                <td style="font-weight:700;">${i.Name}</td>
                <td style="text-align:center;">${i.Qty}</td>
                <td style="text-align:left;">${i.Price.toFixed(2)}</td>
                <td style="text-align:left; font-weight:700;">${(i.Price * i.Qty).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="financials">
          <div class="bank-info">
            <h3>معلومات التحويل البنكي:</h3>
            <p><strong>البنك:</strong> ${settings.bank_name || '—'}</p>
            <p><strong>المستفيد:</strong> ${settings.bank_beneficiary || '—'}</p>
            <p><strong>الآيبان:</strong> <span style="font-family:monospace;">${settings.bank_iban || '—'}</span></p>
          </div>
          <div class="totals-box">
            <div class="total-row"><span>المجموع الفرعي</span><span>SAR ${subtotal.toFixed(2)}</span></div>
            <div class="total-row"><span>الضريبة (15%)</span><span>SAR ${vatAmt.toFixed(2)}</span></div>
            <div class="total-row grand"><span>الإجمالي</span><span>SAR ${total.toFixed(2)}</span></div>
          </div>
        </div>
        <div class="footer">
          <p>تم إنشاء هذا العرض آلياً. جميع الحقوق محفوظة لـ ${settings.business_name_ar || 'المنشأة'}.</p>
        </div>
      </body>
      </html>
    `;
    if (window.api?.printHTML) window.api.printHTML(quoteHtml);
    else toast('طابعة غير متصلة', 'warn');
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const confirmed = window.confirm('حذف هذا الطلب المعلق نهائياً؟');
    if (!confirmed) return;
    try {
      if (window.api?.deleteHeldOrder) await window.api.deleteHeldOrder(id);
      setHeldOrders(prev => prev.filter(h => h.id !== id));
      toast('تم حذف الطلب المعلق', 'success');
    } catch (e) {
      toast('خطأ في حذف الطلب: ' + e.message, 'error');
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ background: 'white', width: '100%', maxWidth: '520px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: '#eef2ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#6366f1" />
            </div>
            <div>
              <h3 style={{ fontWeight: '900', fontSize: '17px', color: '#0f172a' }}>الطلبات المعلقة</h3>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{heldOrders.length} طلب محفوظ</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {heldOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.5 }}>
              <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={28} color="#94a3b8" strokeWidth={1.5} />
              </div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>لا يوجد طلبات معلقة</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>سيتم حفظ الطلبات المعلقة هنا</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {heldOrders.map(h => {
                const itemCount = (h.items || []).length;
                const totalAmt = (h.items || []).reduce((s, i) => s + (i.Price * i.Qty), 0);
                const timeStr = h.created_at
                  ? new Date(h.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                  : '--:--';

                return (
                  <div
                    key={h.id}
                    style={{ padding: '16px', border: '1.5px solid #f1f5f9', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', gap: '12px', transition: 'all 0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.background = '#fafbff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.background = 'white'; }}
                    onClick={() => handleRestore(h)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '900', fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>{h.label || `طلب #${h.id}`}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>🕐 {timeStr}</span>
                        <span>📦 {itemCount} صنف</span>
                        {totalAmt > 0 && <span>💰 SAR {totalAmt.toFixed(2)}</span>}
                        {h.order_type && h.order_type !== 'counter' && <span>🏷️ {h.order_type}</span>}
                      </div>
                      {/* Item preview */}
                      {itemCount > 0 && (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(h.items || []).slice(0, 4).map((item, i) => (
                            <span key={i} style={{ background: '#f1f5f9', color: '#475569', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px' }}>
                              {item.Name} × {item.Qty}
                            </span>
                          ))}
                          {itemCount > 4 && <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>+{itemCount - 4} أخرى</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handlePrintQuote(h); }}
                        title="طباعة عرض سعر"
                        style={{ width: '34px', height: '34px', background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <FileDown size={14} />
                      </button>
                      <button
                        onClick={e => handleDelete(h.id, e)}
                        title="حذف الطلب"
                        style={{ width: '34px', height: '34px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleRestore(h); }}
                        style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                      >
                        <RotateCcw size={14} /> استرجاع
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#fafbff', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '14px', color: '#475569' }}
          >
            إغلاق (Esc)
          </button>
        </div>
      </div>
    </div>
  );
});

export default HeldOrdersModal;
