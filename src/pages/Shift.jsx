import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { StyledConfirm } from '../components/StyledConfirm';
import { useToast } from '../components/ToastManager';

// ── BUG-14 FIX: useSearchParams() replaces window.location.hash.split('?')[1]
// ARCHITECTURAL REASON:
// The previous code parsed URL params manually from window.location.hash.
// HashRouter encodes the query string as part of the hash fragment (e.g.,
// `/#/shift?action=close`). Splitting on '?' works MOST of the time, but:
//   1. If HashRouter ever percent-encodes the '?', the split fails silently.
//   2. window.location.hash is not reactive — if the route changes without
//      a full remount, the useEffect won't re-run and isClosing stays stale,
//      causing a flash of the wrong screen (open/close).
//
// React Router's useSearchParams() reads params from the correct abstraction
// layer, is reactive to navigation, and handles all encoding automatically.
// ───────────────────────────────────────────────────────────────────────────

export default function Shift() {
  const { toast } = useToast();
  const { role, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ← BUG-14 fix
  const isClosing = searchParams.get('action') === 'close';

  const [shift, setShift] = useState(null);
  const [cashInput, setCashInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState({ isOpen: false, actual: 0 });

  useEffect(() => {
    checkShift();
  }, []);

  const checkShift = async () => {
    if (!window.api) { setLoading(false); return; }
    const openShift = await window.api.getOpenShift().catch(() => null);
    setShift(openShift);
    setLoading(false);
  };

  const handleOpen = async () => {
    const amount = parseFloat(cashInput) || 0;
    await window.api.openShift({ cash: amount, staffId: null });
    navigate('/home', { replace: true });
  };

  const handleClose = () => {
    const actual = parseFloat(cashInput) || 0;
    setConfirmState({ isOpen: true, actual });
  };

  const confirmClose = async () => {
    const { actual } = confirmState;
    setConfirmState({ isOpen: false, actual: 0 });
    try {
      const summary = await window.api.closeShift({ id: shift.id, cash: actual });
      if (summary) {
        const html = generateZReport(summary);
        window.api.printHTML(html).catch(() => {});
      }
      toast('تم إغلاق الوردية بنجاح.', 'success');
      logout();
      navigate('/login', { replace: true });
    } catch (e) {
      toast('خطأ في إغلاق الوردية: ' + e.message, 'error');
    }
  };

  // Redirect if shift is already open and we're not in close mode
  useEffect(() => {
    if (!loading && shift && !isClosing) {
      navigate('/home', { replace: true });
    }
  }, [loading, shift, isClosing, role, navigate]);

  if (loading) return (
    <div style={centerStyle}>
      <div style={boxStyle}><p style={{ color:'#94a3b8' }}>جاري التحقق...</p></div>
    </div>
  );

  const isOpenMode = !isClosing;

  // ── Over/Short calculation for close mode ─────────────────────────────
  const expectedCash = shift ? (parseFloat(shift.starting_cash) + parseFloat(shift.cash_sales || 0)) : 0;
  const actualCash = parseFloat(cashInput) || 0;
  const variance = cashInput !== '' ? (actualCash - expectedCash) : null;

  return (
    <div style={{ ...wrapperStyle, direction:'rtl' }}>
      <div style={centerStyle}>
        <div style={boxStyle}>
        <div style={{ width:'80px', height:'80px', background:'#eff6ff', color:'#3b82f6', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'36px', margin:'0 auto 24px', boxShadow:'0 4px 12px rgba(59,130,246,0.2)' }}>
          🖥️
        </div>
        <h1 style={{ fontSize:'22px', fontWeight:'800', marginBottom:'8px' }}>
          {isOpenMode ? 'افتتاح الوردية' : 'إغلاق الوردية'}
        </h1>
        <p style={{ color:'#94a3b8', marginBottom:'24px', fontSize:'14px' }}>
          {isOpenMode ? 'أدخل المبلغ النقدي الموجود في الدرج.' : 'عداد الدرج: أدخل إجمالي النقد الفعلي في الدرج الآن.'}
        </p>

        {!isOpenMode && shift && (
          <div style={{ background:'#f8fafc', padding:'16px', borderRadius:'16px', marginBottom:'20px', border:'1px dashed #e2e8f0', textAlign:'right' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', fontWeight:'600', fontSize:'14px' }}>
              <span style={{ color:'#64748b' }}>وقت البدء:</span>
              <span>{new Date(shift.opened_at).toLocaleString('ar-SA')}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', fontWeight:'600', fontSize:'14px' }}>
              <span style={{ color:'#64748b' }}>النقدية الافتتاحية:</span>
              <span>SAR {parseFloat(shift.starting_cash).toFixed(2)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', fontWeight:'600', fontSize:'14px' }}>
              <span style={{ color:'#64748b' }}>المبيعات النقدية:</span>
              <span style={{ color:'#10b981' }}>SAR {parseFloat(shift.cash_sales || 0).toFixed(2)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'800', fontSize:'15px', paddingTop:'8px', borderTop:'1px solid #e2e8f0', marginTop:'8px' }}>
              <span style={{ color:'#0f172a' }}>النقد المتوقع في الدرج:</span>
              <span style={{ color:'#3b82f6' }}>SAR {expectedCash.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* ── Over/Short Live Indicator ─────────────────────────────────────
            ARCHITECTURAL REASON:
            The previous code showed this comparison AFTER the cashier confirmed
            close — too late to act on. Showing it live as they type allows them
            to recount before committing. This is purely a UX enhancement that
            uses already-available shift data; no new API calls required. */}
        {!isOpenMode && shift && (
          <div style={{ 
            marginBottom:'20px', padding:'16px', borderRadius:'12px', 
            background: variance === null ? '#f8fafc' : (variance === 0 ? '#ecfdf5' : '#fef2f2'), 
            color: variance === null ? '#64748b' : (variance === 0 ? '#10b981' : '#ef4444'), 
            fontWeight:'700', fontSize:'15px', border:'1px solid', 
            borderColor: variance === null ? '#e2e8f0' : (variance === 0 ? '#a7f3d0' : '#fecaca'),
            textAlign:'right',
          }}>
            {variance === null 
              ? '⚠️ يرجى إدخال النقدية الفعلية لحساب العجز أو الزيادة' 
              : variance === 0 
                ? '✅ الرصيد مطابق — لا يوجد عجز أو زيادة' 
                : `${variance > 0 ? '📈 زيادة' : '📉 عجز'}: ${variance > 0 ? '+' : ''}${variance.toFixed(2)} SAR`}
          </div>
        )}

        <label style={{ display:'block', textAlign:'right', marginBottom:'8px', fontWeight:'700', color:'#64748b', fontSize:'14px' }}>
          {isOpenMode ? 'المبلغ الافتتاحي' : 'النقد الفعلي بالدرج'}
        </label>
        <input
          type="number" value={cashInput} onChange={e => setCashInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (isOpenMode ? handleOpen() : handleClose())}
          placeholder="0.00" step="0.5"
          style={{ width:'100%', height:'60px', border:'2px solid #e2e8f0', borderRadius:'16px', fontSize:'24px', fontWeight:'800', textAlign:'center', marginBottom:'20px', background:'#f8fafc', fontFamily:'inherit' }}
        />

        <button
          onClick={isOpenMode ? handleOpen : handleClose}
          style={{ width:'100%', padding:'16px', fontSize:'18px', borderRadius:'16px', border:'none', cursor:'pointer', fontWeight:'700', fontFamily:'inherit',
            background: isOpenMode ? '#3b82f6' : '#ef4444',
            color:'white',
            boxShadow: isOpenMode ? '0 4px 12px rgba(59,130,246,0.3)' : '0 4px 12px rgba(239,68,68,0.3)' }}
        >
          {isOpenMode ? 'بدء الوردية' : 'تأكيد وإغلاق الوردية'}
        </button>

        <a onClick={() => { logout(); navigate('/login', { replace: true }); }}
          style={{ display:'block', marginTop:'20px', color:'#ef4444', fontWeight:'600', textDecoration:'none', cursor:'pointer', fontSize:'14px' }}>
          تسجيل الخروج
        </a>
      </div>

      <StyledConfirm 
        isOpen={confirmState.isOpen}
        title="تأكيد إغلاق الوردية"
        message={`هل أنت متأكد من إغلاق الوردية بمبلغ فعلي قدره ${confirmState.actual}؟`}
        type="warning"
        confirmText="نعم، أغلق الوردية"
        cancelText="تراجع"
        onConfirm={confirmClose}
        onClose={() => setConfirmState({ isOpen: false, actual: 0 })}
      />
      </div>
    </div>
  );
}

function generateZReport(data) {
  const categories = data.summary?.categories || [];
  const products = data.summary?.product_movements || [];
  const invoices = data.summary?.invoices || [];
  const total = data.summary?.total || { gross: 0, vat: 0, net: 0 };

  return `<html dir="rtl"><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
      @page { 
        margin: 0 !important; 
        size: 80mm auto; 
      }
      html, body {
        width: 80mm;
        margin: 0;
        padding: 0;
        background: #fff;
      }
      body { 
        font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        font-size: 13px; 
        color: #000;
      }
      .z-container {
        width: 80mm;
        padding-top: 10px;
        padding-bottom: 5mm;
        padding-left: 10mm;
        padding-right: 6mm;
        box-sizing: border-box;
      }
      .header { text-align: center; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; font-size: 17px; }
      .meta-section { margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 10px; line-height: 1.5; }
      .section-title { font-weight: 900; margin-bottom: 6px; font-size: 14px; text-decoration: underline; }
      .table-data { width: 100%; margin-bottom: 12px; border-collapse: collapse; }
      .table-data td { padding: 4px 0; font-weight: 500; }
      .totals-row { font-weight: 900; border-top: 1.5px solid #000; }
      .variance-section { border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
      .variance-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 15px; margin-bottom: 4px; }
    </style>
  </head><body>
    <div class="z-container">
      <div class="header">تقرير نهاية الوردية (Z-Report)</div>
      
      <div class="meta-section">
        <strong>رقم الوردية:</strong> ${data.id}<br>
        <strong>البدء:</strong> ${new Date(data.opened_at).toLocaleString('ar-SA')}<br>
        <strong>الإغلاق:</strong> ${new Date(data.closed_at).toLocaleString('ar-SA')}
      </div>
      
      <div class="section-title">ملخص المبيعات:</div>
      <table class="table-data">
        <tr><td>إجمالي المبيعات (صافي):</td><td style="text-align:left;">${Number(total.net || 0).toFixed(2)} SAR</td></tr>
        <tr><td>إجمالي الضريبة (VAT):</td><td style="text-align:left;">${Number(total.vat || 0).toFixed(2)} SAR</td></tr>
        <tr class="totals-row"><td>الإجمالي الشامل:</td><td style="text-align:left;">${Number(total.gross || 0).toFixed(2)} SAR</td></tr>
      </table>
      
      <div class="section-title" style="border-top: 1px dashed #000; padding-top: 10px;">حسب طريقة الدفع:</div>
      <table class="table-data">
        <tr><td>نقد (Cash):</td><td style="text-align:left;">${Number(data.cash_sales || 0).toFixed(2)} SAR</td></tr>
        <tr><td>بطاقة (Card):</td><td style="text-align:left;">${Number(data.card_sales || 0).toFixed(2)} SAR</td></tr>
        <tr><td>آجل (Credit):</td><td style="text-align:left;">${Number(data.credit_sales || 0).toFixed(2)} SAR</td></tr>
        <tr><td>مستردة (Refunds):</td><td style="text-align:left; color: red;">${Number(data.refunded_amount || 0).toFixed(2)} SAR</td></tr>
      </table>
      
      <div class="section-title" style="border-top: 1px dashed #000; padding-top: 10px;">حسب الأقسام:</div>
      <table class="table-data" style="font-size: 12px;">
        ${categories.map(c => `<tr><td>${c.category}:</td><td style="text-align:left;">${Number(c.total || 0).toFixed(2)} SAR (${c.qty})</td></tr>`).join('')}
      </table>

      <div class="section-title" style="border-top: 1px dashed #000; padding-top: 10px;">حركة المنتجات:</div>
      <table class="table-data" style="font-size: 12px;">
        ${products.map(p => `<tr><td>${p.product_name || 'غير معروف'}:</td><td style="text-align:left;">${p.qty} مرة</td></tr>`).join('')}
      </table>

      <div class="section-title" style="border-top: 1px dashed #000; padding-top: 10px;">سجل الفواتير:</div>
      <table class="table-data" style="font-size: 11px;">
        ${invoices.map(inv => `<tr>
          <td>${inv.invoice}</td>
          <td>${inv.status === 'credit' ? 'مرتجع' : (inv.payment_method || 'نقدي')}</td>
          <td style="text-align:left;">${Number(inv.total_amount || 0).toFixed(2)} SAR</td>
        </tr>`).join('')}
      </table>
      
      <div class="variance-section">
        <div class="variance-row">
          <span>النقد الفعلي:</span><span>${Number(data.actual_cash || 0).toFixed(2)} SAR</span>
        </div>
        <div class="variance-row" style="font-size: 16px;">
          <span>العجز / الزيادة:</span>
          <span>${data.variance > 0 ? '+' : ''}${Number(data.variance || 0).toFixed(2)} SAR</span>
        </div>
      </div>
      
      <div style="margin-top: 25px; text-align: center; font-size: 11px; font-weight: 700; border-top: 1.5px solid #000; padding-top: 10px;">
        طُبع بواسطة نظام البصمة الذكية
      </div>
      
      <div style="height: 35px;"></div>
    </div>
  </body></html>`;
}

const wrapperStyle = { height:'100vh', overflowY:'auto', background:'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' };
const centerStyle = { display:'flex', minHeight:'100%', alignItems:'center', justifyContent:'center', padding:'clamp(20px, 4vh, 40px) 16px' };
const boxStyle = { background:'white', padding:'clamp(24px, 5vw, 40px)', borderRadius:'24px', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.08)', width:'100%', maxWidth:'440px', textAlign:'center', border:'1px solid #f1f5f9' };
