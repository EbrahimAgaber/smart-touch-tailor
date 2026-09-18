import { useState, useEffect, useMemo, memo } from 'react';
import { renderToString } from 'react-dom/server';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { Download, RefreshCw, Search, RotateCcw, ChevronDown, ChevronUp, FileText, ShoppingBag, Printer, Minus, Plus, PackageCheck } from 'lucide-react';
import QRCode from '../utils/qr-gen';
import ExportButton from '../components/ExportButton';
import TailorWorkOrder from '../components/TailorWorkOrder';
const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const statusLabel = (s, t) => {
  if (s === 'void')   return { label:t('history.status.void'),    bg:'#fee2e2', col:'#991b1b' };
  if (s === 'credit') return { label:t('history.status.credit'),     bg:'#fef3c7', col:'#92400e' };
  if (s === 'partial') return { label:'مدفوع جزئياً',  bg:'#fef3c7', col:'#92400e' };
  return                     { label:t('history.status.paid'),  bg:'#dcfce7', col:'#15803d' };
};

// [W-5] Map ZATCA clearance_status to badge props
const zatcaClearanceBadge = (s, isB2B, t) => {
  if (s === 'cleared')  return { label:t('history.status.cleared'),   bg:'#dcfce7', col:'#15803d' };
  if (s === 'reported') return { label:t('history.status.reported'), bg:'#dbeafe', col:'#1d4ed8' };
  if (s === 'rejected') return { label:t('history.status.rejected'),     bg:'#fee2e2', col:'#b91c1c' };
  // Pending: only show badge if B2B (B2C pending is less critical)
  if (isB2B)            return { label:t('history.status.pending'),    bg:'#fef9c3', col:'#854d0e' };
  return null;
};

// Human-readable Arabic labels for payment method codes, used when printing
// a receipt (both the single-method line and the split-payment breakdown).
const PAY_LABEL_AR = { Cash:'نقدي', Card:'بطاقة', Credit:'آجل', Bank:'تحويل بنكي', STC:'STC Pay' };
const payLabel = (type) => PAY_LABEL_AR[type] || type || '—';

// Builds a compact "find us on" line for the bottom of a printed receipt
// from whichever social/contact fields the business owner actually filled
// in Settings → هوية المنشأة → التواصل. Any field left blank is skipped
// entirely — nothing renders unless the owner set it. Sits ABOVE the
// "Developed by البصمة الذكية" credit line, which is always kept as-is.
const buildSocialFooterHTML = (settings) => {
  const parts = [];
  if (settings?.instagram) parts.push(`📷 ${settings.instagram}`);
  if (settings?.whatsapp)  parts.push(`💬 ${settings.whatsapp}`);
  if (settings?.website)   parts.push(`🌐 ${settings.website}`);
  if (!parts.length) return '';
  return `<p style="margin:6px 0; font-size:10.5px; color:#64748b; direction:ltr; text-align:center;">${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</p>`;
};

export default function SalesHistory() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('sales');
  const [quotes, setQuotes] = useState([]);
  
  const [range, setRange]     = useState({ startDate: monthStart(), endDate: today() });
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sales, setSales]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const handlePayRemaining = (s) => {
    const outstanding = parseFloat(s.total || 0) - parseFloat(s.paid || 0);
    if (outstanding <= 0) return;
    const handoffData = {
        ticketId: s.id,
        customer: { id: s.customer_id, name: s.customer_name, phone: s.customer_phone },
        cartItems: [{
            id: `balance_${s.invoice}_${Math.random()}`,
            Name: `سداد متبقي فاتورة #${s.invoice}`,
            Price: outstanding,
            Qty: 1,
            Category: 'أخرى'
        }],
        total: outstanding,
        depositPaid: parseFloat(s.paid || 0),
        orderNote: `فاتورة #${s.invoice}`
    };
    navigate('/pos', { state: { alterationHandoff: handoffData } });
  };

  const [voidModal, setVoidModal] = useState(null); // {invoice}
  const [voidReason, setVoidReason] = useState('');
  const [returnModal, setReturnModal] = useState(null);
  const [debitModal, setDebitModal] = useState(null);
  const [debitAmount, setDebitAmount] = useState('');
  const [debitReason, setDebitReason] = useState('');
  const [paymentModal, setPaymentModal] = useState(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [settings, setSettings] = useState({});

  useEffect(() => {
    window.api.getSettings().then(s => setSettings(s || {})).catch(() => {});
    fetchSales();
  }, []);

  const fetchSales = async (overrides = {}) => {
    setLoading(true);
    try {
      const filters = {
        startDate: range.startDate,
        endDate: range.endDate,
        search: search || undefined,
        status: statusFilter !== 'all' && statusFilter !== 'partial' ? statusFilter : undefined,
        ...overrides
      };
      const [data, qData] = await Promise.all([
        window.api.getSalesHistory(filters),
        window.api.getHeldOrders ? window.api.getHeldOrders() : Promise.resolve([])
      ]);
      let fetchedSales = Array.isArray(data) ? data : [];
      if (statusFilter === 'partial') {
        fetchedSales = fetchedSales.filter(s => parseFloat(s.paid || 0) + 0.01 < parseFloat(s.total || 0) && s.status !== 'void' && s.status !== 'credit');
      }
      setSales(fetchedSales);
      setQuotes((Array.isArray(qData) ? qData : []).filter(o => o.order_type === 'quote'));
    } catch (e) { setSales([]); setQuotes([]); }
    setLoading(false);
  };

  const totalRevenue = sales.filter(s => s.status !== 'void').reduce((sum, s) => sum + parseFloat(s.total||0), 0);
  const vatRate = parseFloat(settings.vat_rate || '0.15');
  const totalVAT = totalRevenue * vatRate / (1 + vatRate);
  const voidCount = sales.filter(s => s.status === 'void').length;

  // [PERF-FIX] Parse each sale's items_json exactly once per fetch instead of
  // on every single render (previously this ran for every row on every
  // keystroke anywhere on the page, e.g. while typing a return quantity in
  // the modal below — with a large sales history this is what made the UI
  // feel like it had frozen).
  const parsedItemsBySaleId = useMemo(() => {
    const map = new Map();
    for (const s of sales) {
      try { map.set(s.id, JSON.parse(s.items_json || '[]')); }
      catch { map.set(s.id, []); }
    }
    return map;
  }, [sales]);

  const handleVoid = async () => {
    if (!voidModal) return;
    try {
      await window.api.voidSale({ invoiceId: voidModal, reason: voidReason || t('history.modals.void_reason_default') });
      setVoidModal(null);
      setVoidReason('');
      fetchSales();
    } catch (e) { alert(t('history.alerts.void_error') + e.message); }
  };

  const handleCorrectPayment = async () => {
    if (!paymentModal || !newPaymentMethod) return;
    try {
      const res = await window.api.correctPaymentMethod({
        invoiceId: paymentModal.invoice,
        newMethod: newPaymentMethod,
        staffId: 1
      });
      if (res.success) {
        setPaymentModal(null);
        setNewPaymentMethod('');
        fetchSales();
      } else {
        alert('خطأ: ' + res.error);
      }
    } catch (e) { alert('خطأ: ' + e.message); }
  };

  const openReturn = (sale) => {
    try {
      const items = JSON.parse(sale.items_json || '[]');
      if (!items.length) { alert(t('history.alerts.read_error')); return; }
      setReturnModal({ ...sale, items });
    } catch { alert(t('history.alerts.read_error')); }
  };

  // [FIX-RETURN-1] handleReturn now receives the already-validated return
  // lines + reason directly from the isolated <ReturnModal> component below
  // (qty typing no longer touches SalesHistory's own state, which used to
  // force this whole page — including every parsed items_json row — to
  // re-render on every keystroke and made the UI feel frozen).
  //
  // [FIX-RETURN-2] The original invoice UUID is only populated for invoices
  // issued while ZATCA Phase 2 was active. Any older/legacy invoice has a
  // NULL uuid, which used to hard-block every single return with a
  // "the original invoice does not exist" alert. The invoice NUMBER always
  // exists and is what ZATCA's BillingReference/InvoiceDocumentReference/ID
  // is meant to carry (the UUID field is a separate, optional element) —
  // so we use the invoice number as billingRef instead. This does not touch
  // the ZATCA signing/XML pipeline itself, only which value the frontend
  // supplies as the billing reference.
  const handleReturn = async (sale, returnItems, reason) => {
    const billingRef = sale.invoice;

    let returnTotal = 0;
    const creditItems = returnItems.map(it => {
      returnTotal += (it.qty * parseFloat(it.Price));
      return { ...it, Qty: -it.qty };
    });

    const returnVat = returnItems.reduce((sum, item) => {
      const lineTotal = (item.Price || 0) * (item.qty || item.returnQty || 0);
      return sum + (lineTotal * vatRate / (1 + vatRate));
    }, 0);
    const vatAmt = Math.round(returnVat * 100) / 100;
    const cnNumber = `CN-${sale.invoice}-${Date.now().toString().slice(-4)}`;
    const payload = {
      invoice: cnNumber,
      items: creditItems,
      subtotal: -(returnTotal - vatAmt),
      tax: -vatAmt,
      total: -returnTotal,
      payment: sale.payment,
      customer_id: sale.customer_id,
      billingRef,
      originalInvoice: sale.invoice,
      note: `\u0625\u0634\u0639\u0627\u0631 \u062f\u0627\u0626\u0646 (\u0627\u0633\u062a\u0631\u062c\u0627\u0639) \u0644\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064a\u0629 #${sale.invoice} - ${reason}`,
      status: 'credit' // Flag as credit note
    };

    try {
      const res = await window.api.saveSale(payload);
      // [FIX-RETURN-3] saveSale's IPC handler never throws on failure — it
      // resolves with { success:false, error }. The old code never checked
      // this, so a failed return silently closed the dialog as if it worked.
      if (res && res.success === false) {
        alert('\u062e\u0637\u0623 \u0641\u064a \u0625\u0631\u062c\u0627\u0639 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629: ' + (res.error || res.message || ''));
        return false;
      }
      setReturnModal(null);
      fetchSales();
      return true;
    } catch (e) {
      alert('\u062e\u0637\u0623 \u0641\u064a \u0625\u0631\u062c\u0627\u0639 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629: ' + e.message);
      return false;
    }
  };

  const handleDebitNote = async () => {
    if (!debitModal) return;
    const amount = parseFloat(debitAmount);
    if (!amount || amount <= 0) return alert('يرجى إدخال مبلغ صحيح');
    try {
      await window.api.createDebitNote({ invoiceId: debitModal.invoice, amount, reason: debitReason });
      setDebitModal(null); setDebitAmount(''); setDebitReason('');
      fetchSales();
    } catch (e) { alert('خطأ: ' + e.message); }
  };

  // ── XML download via backend generator (ZATCA-compliant) ──────────────────
  // The previous frontend generateXML helper was removed: it hardcoded
  // typeCode 388 / subtype 0200000, omitted IssueTime, and skipped
  // UBLExtensions — causing schema validation failures on every download.
  // The backend IPC path (zatca:generateXML) uses zatca_utils.cjs which is
  // already phase-2 compliant, signed, and matches the queued invoice exactly.
  const downloadXML = async (sale) => {
    const filename = `ZATCA_${sale.invoice}.xml`;
    try {
      // Fetch the already-signed XML from the zatca_queue for this sale
      const xml = await window.api.getSignedXML({ saleId: sale.id, invoice: sale.invoice });
      if (!xml) throw new Error('لم يتم العثور على XML للفاتورة في قائمة الانتظار');
      await window.api.saveFile({ filename, content: xml, mime: 'text/xml' });
    } catch (e) {
      alert('خطأ في تحميل XML: ' + e.message);
    }
  };


  const exportCSV = async () => {
    try {
      const csv = await window.api.exportSalesCSV({ startDate: range.startDate, endDate: range.endDate });
      await window.api.saveFile({ filename:`sales_${range.startDate}_${range.endDate}.csv`, content: csv });
    } catch (e) { alert('خطأ في التصدير: ' + e.message); }
  };

  const printTailorTicket = async (sale) => {
    try {
      const tailorOrder = await window.api?.tailor?.getOrderBySale?.(sale.invoice);
      if (!tailorOrder) {
        alert('لم يتم العثور على ورقة عمل الخياط لهذا الطلب.');
        return;
      }
      const orderPayload = {
        invoiceNumber: sale.invoice,
        customer: tailorOrder.customer || { name: 'غير معروف', phone: '' },
        date: tailorOrder.created_at || sale.timestamp,
        deliveryDate: tailorOrder.target_delivery_date,
        notes: tailorOrder.note,
        subtotal: sale.subtotal,
        paid: sale.paid,
        balance: sale.total_amount - sale.paid,
        items: tailorOrder.garments || []
      };
      
      const htmlContent = renderToString(<TailorWorkOrder orderDetails={orderPayload} fabrics={[]} />);
      const fullHtml = `
        <html dir="rtl">
        <head>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { background: white; margin: 0; }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `;
      if (window.api?.printHTMLSilent) {
        window.api.printHTMLSilent({ html: fullHtml });
      } else if (window.api?.printHTML) {
        window.api.printHTML(fullHtml);
      }
    } catch (e) {
      alert('خطأ في طباعة ورقة الخياط: ' + e.message);
    }
  };

  const printReceipt = async (sale, forceWidth) => {
    try {
      if (!sale) return;
      const bizAr  = settings.business_name_ar || 'نظام البصمة الذكية';
    const bizEn  = settings.business_name_en || '';
    const logo   = settings.business_logo || '';
    const footer = settings.receipt_footer || 'شكراً لزيارتكم';
    const vatNum = settings.vat_number || '---';
    const addr   = settings.address || '';
    const width  = forceWidth || settings.receipt_width || '80';
    
    let items = [];
    try {
      items = JSON.parse(sale.items_json || '[]');
    } catch (e) {
      items = [];
    }

    const gr     = parseFloat(sale.total);
    const vatAmt = parseFloat(sale.tax || gr * vatRate / (1 + vatRate));
    const net    = gr - vatAmt;

    // Split-payment breakdown — e.g. SAR 20 paid as SAR 5 cash + SAR 15 card.
    // payment_details_json is the array of {type, amount} rows POS saved at
    // checkout; if there's more than one non-zero row this was a split sale
    // and the receipt should itemize each method instead of showing a single
    // "Payment Method" line.
    let paymentBreakdown = [];
    try {
      const pd = JSON.parse(sale.payment_details_json || '[]');
      if (Array.isArray(pd)) paymentBreakdown = pd.filter(p => p && parseFloat(p.amount) > 0);
    } catch (_) {}
    const isSplitPayment = paymentBreakdown.length > 1;

    // FIX 2: Use Phase 2 9-tag TLV for printed receipts
    // Try to get crypto fields from zatca_queue for this invoice
    let qrData = null;
    try {
      // First attempt: getZatcaTLV9 with crypto fields from the signed queue row
      qrData = await window.api?.getZatcaTLV9?.({
        invoice: sale.invoice,
        seller: bizAr,
        vatNo: vatNum,
        timestamp: new Date(sale.sale_date).toISOString(),
        total: gr.toFixed(2),
        vatAmt: vatAmt.toFixed(2),
      });
    } catch (_) {}

    if (!qrData) {
      // Graceful fallback to Phase 1 5-tag TLV if invoice not yet in signed queue
      console.warn(`[printReceipt] No Phase 2 TLV for ${sale.invoice} — falling back to Phase 1 5-tag TLV`);
      try {
        qrData = await window.api?.getZatcaTLV?.({
          invoice: sale.invoice,
          seller: bizAr,
          vatNo: vatNum,
          timestamp: new Date(sale.sale_date).toISOString(),
          total: gr.toFixed(2),
          vatAmt: vatAmt.toFixed(2),
        });
      } catch (_) {}
    }
    
    const svg = QRCode.generateSVG(qrData || '', 3);
    const qrUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

    const pageSize = width === 'A4' ? '210mm' : `${width}mm`;

    let html = '';

    if (width === 'A4') {
      // Premium A4 ZATCA Tax Invoice Layout
      const isB2B = !!(sale.customer_tax_id || sale.customerTaxId);
      const invoiceTitle = isB2B ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة";
      const invoiceTitleEn = isB2B ? "Tax Invoice" : "Simplified Tax Invoice";

      // Seller National Address Info
      const s_naShort = settings.national_address_short || '—';
      const s_naBuilding = settings.national_address_building || '';
      const s_naStreet = settings.national_address_street || '';
      const s_naSecondary = settings.national_address_secondary || '';
      const s_naDistrict = settings.national_address_district || '';
      const s_naPostal = settings.national_address_postal || '';
      const s_naCity = settings.national_address_city || '';
      const s_naCountry = settings.national_address_country || 'المملكة العربية السعودية';

      // Buyer Info
      const b_name = sale.customer_name || sale.customerName || 'عميل نقدي';
      const b_phone = sale.customer_phone || sale.customerPhone || '—';
      const b_taxId = sale.customer_tax_id || sale.customerTaxId || '—';
      const b_address = sale.customer_address || sale.customerAddress || '—';
      const b_naBuilding = sale.customer_na_building || '';
      const b_naStreet = sale.customer_na_street || '';
      const b_naDistrict = sale.customer_na_district || '';
      const b_naPostal = sale.customer_na_postal || '';
      const b_naCity = sale.customer_na_city || '';

      const bankName = settings.bank_name || '';
      const bankBen = settings.bank_beneficiary || '';
      const bankIban = settings.bank_iban || '';

      html = `<html dir="rtl"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          @page { size: A4; margin: 15mm; }
          body {
              font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #1e293b;
              font-size: 13.5px;
              line-height: 1.5;
          }
          .invoice-box {
              max-width: 100%;
              margin: 0 auto;
          }
          .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
          }
          .header-title-box {
              text-align: right;
              vertical-align: top;
          }
          .header-logo-box {
              text-align: left;
              vertical-align: top;
          }
          .invoice-title {
              font-size: 26px;
              font-weight: 900;
              color: #1e3a8a;
              margin: 0 0 5px 0;
          }
          .invoice-subtitle {
              font-size: 14px;
              color: #64748b;
              font-weight: 700;
              margin: 0;
          }
          .meta-line {
              margin-top: 12px;
              font-size: 13px;
              color: #334155;
          }
          .meta-line span {
              font-weight: bold;
              color: #0f172a;
          }
          .logo-img {
              max-height: 80px;
              max-width: 200px;
              object-fit: contain;
          }
          .divider {
              height: 3px;
              background: linear-gradient(to left, #1e3a8a, #3b82f6);
              margin: 15px 0 25px 0;
              border-radius: 2px;
          }
          .cards-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 25px;
          }
          .info-card {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              overflow: hidden;
              background: #f8fafc;
              box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .info-card-header {
              background: #eff6ff;
              color: #1e40af;
              font-weight: 800;
              font-size: 14.5px;
              padding: 10px 15px;
              border-bottom: 1px solid #bfdbfe;
          }
          .info-card-body {
              padding: 15px;
              font-size: 12.5px;
              color: #334155;
          }
          .info-row {
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
          }
          .info-row:last-child {
              margin-bottom: 0;
          }
          .info-label {
              font-weight: 700;
              color: #64748b;
          }
          .info-val {
              font-weight: bold;
              color: #0f172a;
              text-align: left;
          }
          .na-box {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              padding: 10px;
              margin-top: 10px;
              font-size: 11px;
              color: #1e40af;
          }
          .na-box-title {
              font-weight: bold;
              margin-bottom: 6px;
              border-bottom: 1px dashed #bfdbfe;
              padding-bottom: 4px;
          }
          .na-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 5px;
              text-align: center;
          }
          .na-cell {
              background: #fff;
              padding: 4px;
              border-radius: 4px;
              border: 1px solid #dbeafe;
          }
          .na-cell-lbl {
              font-size: 9px;
              color: #64748b;
          }
          .na-cell-val {
              font-weight: bold;
              color: #1e40af;
          }
          .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
          }
          .items-table th {
              background: #1e3a8a;
              color: #fff;
              font-weight: bold;
              font-size: 12.5px;
              padding: 10px 8px;
              border: 1px solid #1e3a8a;
              text-align: center;
          }
          .items-table td {
              padding: 10px 8px;
              border: 1px solid #e2e8f0;
              font-size: 12.5px;
              text-align: center;
          }
          .items-table tr:nth-child(even) {
              background: #f8fafc;
          }
          .col-align-right {
              text-align: right !important;
          }
          .bottom-grid {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 30px;
              margin-top: 15px;
              align-items: start;
          }
          .bank-card {
              border: 2px solid #10b981;
              border-radius: 12px;
              padding: 15px;
              background: #f0fdf4;
          }
          .bank-title {
              color: #047857;
              font-weight: 800;
              font-size: 14.5px;
              margin-bottom: 12px;
              border-bottom: 1px solid #a7f3d0;
              padding-bottom: 6px;
          }
          .bank-detail-row {
              margin-bottom: 6px;
              font-size: 12.5px;
          }
          .bank-detail-row span {
              font-weight: bold;
              color: #047857;
          }
          .totals-card {
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              overflow: hidden;
              background: #fff;
          }
          .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 15px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 13px;
          }
          .totals-row:last-child {
              border-bottom: none;
          }
          .totals-bold {
              font-weight: 900;
              font-size: 16px;
              background: #eff6ff;
              color: #1e3a8a;
              border-top: 2px solid #3b82f6;
          }
          .qr-section {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-top: 15px;
              padding: 10px;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              background: #fafafa;
          }
          .qr-img {
              width: 90px;
              height: 90px;
          }
          .qr-text {
              font-size: 11px;
              color: #64748b;
              line-height: 1.4;
          }
          .footer {
              text-align: center;
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              font-size: 12px;
              color: #64748b;
          }
      </style></head>
      <body>
          <div class="invoice-box">
              <table class="header-table">
                  <tr>
                      <td class="header-title-box">
                          <h1 class="invoice-title">${invoiceTitle}</h1>
                          <p class="invoice-subtitle">${invoiceTitleEn}</p>
                          <div class="meta-line">
                              رقم الفاتورة (Invoice No): <span>${sale.invoice}</span><br>
                              تاريخ الإصدار (Issue Date): <span dir="ltr">${new Date(sale.sale_date).toLocaleString('ar-SA')}</span><br>
                              نوع الطلب (Order Type): <span style="font-weight:900; color:#ef4444;">${
                                (() => {
                                    const oType = sale.order_type || 'counter';
                                    if (oType === 'tailor') return (parseFloat(sale.paid || 0) + 0.01 < parseFloat(sale.total || 0)) ? 'تفصيل' : 'استلام';
                                    if (oType === 'alteration') return 'تعديل';
                                    if (oType === 'delivery') return 'توصيل';
                                    if (oType === 'takeaway') return 'سفري';
                                    return 'محلي';
                                })()
                              }</span>
                          </div>
                          ${settings.receipt_header ? `<div style="margin-top:8px; font-size:12px; color:#475569; white-space:pre-wrap; max-width:320px;">${settings.receipt_header}</div>` : ''}
                      </td>
                      <td class="header-logo-box">
                          ${logo ? `<img src="${logo}" class="logo-img">` : ''}
                      </td>
                  </tr>
              </table>

              <div class="divider"></div>

              <div class="cards-grid">
                  <!-- Seller Card -->
                  <div class="info-card">
                      <div class="info-card-header">بيانات المورد (Seller Details)</div>
                      <div class="info-card-body">
                          <div class="info-row"><span class="info-label">اسم المنشأة:</span><span class="info-val">${bizAr}</span></div>
                          ${bizEn ? `<div class="info-row"><span class="info-label">Name:</span><span class="info-val">${bizEn}</span></div>` : ''}
                          <div class="info-row"><span class="info-label">الرقم الضريبي:</span><span class="info-val">${vatNum}</span></div>
                          <div class="info-row"><span class="info-label">العنوان:</span><span class="info-val">${addr || '—'}</span></div>
                          
                          <!-- National Address Box -->
                          <div class="na-box">
                              <div class="na-box-title">العنوان الوطني المختصر: ${s_naShort}</div>
                              <div class="na-grid">
                                  <div class="na-cell"><div class="na-cell-lbl">المبنى</div><div class="na-cell-val">${s_naBuilding || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الشارع</div><div class="na-cell-val" style="font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s_naStreet}">${s_naStreet || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الحي</div><div class="na-cell-val">${s_naDistrict || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">المدينة</div><div class="na-cell-val">${s_naCity || '—'}</div></div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <!-- Buyer Card -->
                  <div class="info-card">
                      <div class="info-card-header">بيانات العميل (Buyer Details)</div>
                      <div class="info-card-body">
                          <div class="info-row"><span class="info-label">اسم العميل:</span><span class="info-val">${b_name}</span></div>
                          <div class="info-row"><span class="info-label">رقم الهاتف:</span><span class="info-val">${b_phone}</span></div>
                          <div class="info-row"><span class="info-label">الرقم الضريبي للعميل:</span><span class="info-val">${b_taxId}</span></div>
                          <div class="info-row"><span class="info-label">العنوان الكامل:</span><span class="info-val">${b_address}</span></div>

                          <!-- National Address Box -->
                          <div class="na-box">
                              <div class="na-box-title">العنوان الوطني للعميل</div>
                              <div class="na-grid">
                                  <div class="na-cell"><div class="na-cell-lbl">المبنى</div><div class="na-cell-val">${b_naBuilding || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الشارع</div><div class="na-cell-val" style="font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b_naStreet}">${b_naStreet || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الحي</div><div class="na-cell-val">${b_naDistrict || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">المدينة</div><div class="na-cell-val">${b_naCity || '—'}</div></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <!-- Items Table -->
              <table class="items-table">
                  <thead>
                      <tr>
                          <th style="width: 5%;">#</th>
                          <th class="col-align-right" style="width: 35%;">الصنف (Item Description)</th>
                          <th style="width: 10%;">سعر الوحدة<br><small>(Unit Ex VAT)</small></th>
                          <th style="width: 8%;">الضريبة للوحدة<br><small>(Unit Tax)</small></th>
                          <th style="width: 8%;">الكمية<br><small>(Qty)</small></th>
                          <th style="width: 10%;">المجموع<br><small>(Subtotal Ex VAT)</small></th>
                          <th style="width: 8%;">النسبة<br><small>(VAT Rate)</small></th>
                          <th style="width: 8%;">الضريبة<br><small>(VAT Amount)</small></th>
                          <th style="width: 10%;">الإجمالي شامل الضريبة<br><small>(Total Inc VAT)</small></th>
                      </tr>
                  </thead>
                  <tbody>
                      ${items.map((i, index) => {
                          const itemTotal = i.Price * i.Qty;
                          const itemTax = itemTotal * vatRate / (1 + vatRate);
                          const itemSub = itemTotal - itemTax;
                          const unitCost = i.Price / (1 + vatRate);
                          const unitTax = i.Price - unitCost;
                          return `
                              <tr>
                                  <td>${index + 1}</td>
                                  <td class="col-align-right" style="font-weight: 500;">${i.Name}</td>
                                  <td>${unitCost.toFixed(2)}</td>
                                  <td>${unitTax.toFixed(2)}</td>
                                  <td style="font-weight: bold;">${i.Qty}</td>
                                  <td>${itemSub.toFixed(2)}</td>
                                  <td>${(vatRate * 100).toFixed(0)}%</td>
                                  <td>${itemTax.toFixed(2)}</td>
                                  <td style="font-weight: bold; color: #1e3a8a;">${itemTotal.toFixed(2)}</td>
                              </tr>
                          `;
                      }).join('')}
                  </tbody>
              </table>

              <!-- Bottom Layout -->
              <div class="bottom-grid">
                  <!-- Bank Details -->
                  <div>
                      ${(bankName || bankIban) ? `
                      <div class="bank-card">
                          <div class="bank-title">معلومات التحويل البنكي (Bank Details)</div>
                          <div class="bank-detail-row"><span>البنك (Bank):</span> ${bankName}</div>
                          <div class="bank-detail-row"><span>المستفيد (Beneficiary):</span> ${bankBen}</div>
                          <div class="bank-detail-row"><span>الآيبان (IBAN):</span> <span style="font-family: monospace; letter-spacing: 0.5px; font-weight: bold;">${bankIban}</span></div>
                      </div>
                      ` : ''}
                      
                      <div class="qr-section">
                          <img src="${qrUrl}" class="qr-img">
                          <div class="qr-text">
                              <strong>فاتورة ضريبية معتمدة للزكاة والدخل</strong><br>
                              تخضع لنظام الفوترة الإلكترونية بالمملكة العربية السعودية.<br>
                              المورد: ${bizAr}<br>
                              الرقم الضريبي: ${vatNum}
                          </div>
                      </div>
                  </div>

                  <!-- Totals -->
                  <div class="totals-card">
                      <div class="totals-row">
                          <span>المجموع الفرعي (غير شامل الضريبة)</span>
                          <strong>SAR ${net.toFixed(2)}</strong>
                      </div>
                      ${parseFloat(sale.discount||0) > 0 ? `
                      <div class="totals-row" style="color: #ef4444;">
                          <span>إجمالي الخصم (Total Discount)</span>
                          <strong>- SAR ${parseFloat(sale.discount).toFixed(2)}</strong>
                      </div>
                      ` : ''}
                      <div class="totals-row">
                          <span>ضريبة القيمة المضافة (${(vatRate * 100).toFixed(0)}%)</span>
                          <strong>SAR ${vatAmt.toFixed(2)}</strong>
                      </div>
                      <div class="totals-row totals-bold">
                          <span>الإجمالي شامل الضريبة (Total)</span>
                          <span>SAR ${gr.toFixed(2)}</span>
                      </div>
                      ${isSplitPayment ? `
                      <div class="totals-row" style="flex-direction:column; align-items:stretch; gap:6px;">
                          <span style="font-weight:700; color:#64748b;">طريقة الدفع (دفع مقسّم / Split Payment)</span>
                          ${paymentBreakdown.map(p => `
                          <div style="display:flex; justify-content:space-between; padding-right:10px; font-size:12.5px;">
                              <span>• ${payLabel(p.type)}</span>
                              <strong>SAR ${parseFloat(p.amount).toFixed(2)}</strong>
                          </div>`).join('')}
                      </div>
                      ` : `
                      <div class="totals-row">
                          <span>طريقة الدفع (Payment Method)</span>
                          <strong>${payLabel(sale.payment)}</strong>
                      </div>
                      `}
                      <div class="totals-row">
                          <span>المبلغ المدفوع (Paid)</span>
                          <strong>SAR ${parseFloat(sale.paid || sale.total).toFixed(2)}</strong>
                      </div>
                      ${parseFloat(sale.change||0) > 0 ? `
                      <div class="totals-row">
                          <span>الباقي (Change)</span>
                          <strong>SAR ${parseFloat(sale.change).toFixed(2)}</strong>
                      </div>
                      ` : ''}
                  </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                  <p style="margin: 0; font-weight: bold;">${footer}</p>
                  ${buildSocialFooterHTML(settings)}
                  <p style="margin: 5px 0 0 0; font-size: 10px;">نظام البصمة الذكية الفني للفوترة الإلكترونية • Developed by البصمة الذكية</p>
              </div>
          </div>
      </body></html>`;
    } else {
      // Original Thermal Layout (Exactly as is)
      html = `<html dir="rtl"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          @page { 
              margin: 0 !important; 
              size: ${width === 'A4' ? 'A4' : '80mm auto'}; 
          }
          html, body {
              width: ${pageSize};
              margin: 0;
              padding: 0;
              background: #fff;
          }
          body { 
              font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              font-size: ${width === "80" ? "13px" : "11px"}; 
              color: #000;
          }
          .receipt-container {
              width: ${width === 'A4' ? '100%' : '80mm'};
              margin: 0 auto;
              padding-top: 0;
              padding-bottom: 5mm;
              padding-left: ${width === 'A4' ? '10mm' : '10mm'};
              padding-right: ${width === 'A4' ? '10mm' : '6mm'};
              box-sizing: border-box;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .info-line { display: flex; justify-content: space-between; margin: 3px 0; gap: 5px; color: #000; font-weight: 500; }
          .flex-table { width: 100%; margin-top: 10px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 0; }
          .flex-th { display: flex; border-bottom: 1px solid #000; padding-bottom: 6px; font-weight: bold; font-size: 12px; width: 100%; color: #000; }
          .flex-tr { display: flex; border-bottom: 1px dashed #000; padding: 6px 0; font-size: 11px; align-items: center; width: 100%; color: #000; }
          .flex-tr:last-child { border-bottom: none; }
          .col-name { flex: 2; text-align: right; padding-left: 4px; }
          .col-qty { flex: 0.8; text-align: center; }
          .col-price { flex: 1.2; text-align: center; }
          .col-total { flex: 1.2; text-align: left; padding-left: 2px; }
          .totals { margin-top: 10px; border-top: 1.5px solid #000; padding-top: 6px; width: 100%; }
          .total-bold { font-weight: bold; font-size: 14px; border-top: 1.5px solid #000; margin-top: 6px; padding-top: 6px; color: #000; }
          .qr-box { margin: 15px auto; text-align: center; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; }
          .footer { text-align: center; margin-top: 15px; font-size: 11.5px; line-height: 1.4; color: #000; }
      </style></head><body>
          <div class="receipt-container">
              <div class="header">
              ${logo ? `<img src="${logo}" style="max-height:60px; max-width:150px; margin-bottom:5px;">` : ''}
              <h2 style="margin:0; font-size:18px; font-weight: 800;">${bizAr}</h2>
              ${addr ? `<p style="margin:4px 0; font-weight: 500;">${addr}</p>` : ''}
              <p style="margin:2px 0; font-weight: 500;">الرقم الضريبي: <strong>${vatNum}</strong></p>
              ${settings.receipt_header ? `<p style="margin:4px 0; font-size:11px; color:#333; white-space:pre-wrap;">${settings.receipt_header}</p>` : ''}
          </div>

          <div style="text-align:center; font-weight:800; font-size: 14px; border-top:2px dashed #000; border-bottom:2px dashed #000; padding:6px 0; margin-bottom:10px; color: #000;">
              ${(sale.customer_tax_id || sale.customerTaxId) ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}
          </div>

          <div class="info-line"><span>رقم الفاتورة:</span><span>${sale.invoice}</span></div>
          <div class="info-line"><span>التاريخ:</span><span dir="ltr">${new Date(sale.sale_date).toLocaleString('ar-SA')}</span></div>
          <div class="info-line"><span>نوع الطلب:</span><span style="font-weight:900;">${
            (() => {
                const oType = sale.order_type || 'counter';
                if (oType === 'tailor') return (parseFloat(sale.paid || 0) + 0.01 < parseFloat(sale.total || 0)) ? 'تفصيل' : 'استلام';
                if (oType === 'alteration') return 'تعديل';
                if (oType === 'delivery') return 'توصيل';
                if (oType === 'takeaway') return 'سفري';
                return 'محلي';
            })()
          }</span></div>
          ${sale.customer_name ? `<div class="info-line"><span>العميل:</span><span>${sale.customer_name}</span></div>` : ''}
          ${sale.customer_tax_id ? `<div class="info-line"><span>رقم الضريبة للعميل:</span><span>${sale.customer_tax_id}</span></div>` : ''}

          <div class="flex-table">
              <div class="flex-th">
                  <div class="col-name">الصنف</div>
                  <div class="col-qty">العدد</div>
                  <div class="col-price">السعر</div>
                  <div class="col-total">الإجمالي</div>
              </div>
              ${items.map(i => `
                  <div class="flex-tr">
                      <div class="col-name" style="font-weight: 500;">${i.Name}</div>
                      <div class="col-qty" style="font-weight: bold;">${i.Qty}</div>
                      <div class="col-price">${i.Price.toFixed(2)}</div>
                      <div class="col-total" style="font-weight: bold;">${(i.Price * i.Qty).toFixed(2)}</div>
                  </div>
              `).join('')}
          </div>

          <div class="totals">
              <div class="info-line"><span>المجموع الفرعي:</span><span>${net.toFixed(2)} SAR</span></div>
              ${parseFloat(sale.discount||0) > 0 ? `<div class="info-line"><span>الخصم:</span><span>${parseFloat(sale.discount).toFixed(2)} SAR</span></div>` : ''}
              <div class="info-line"><span>الضريبة (${(vatRate * 100).toFixed(0)}%):</span><span>${vatAmt.toFixed(2)} SAR</span></div>
              <div class="info-line total-bold">
                  <span>الإجمالي:</span>
                  <span>${gr.toFixed(2)} SAR</span>
              </div>
              ${isSplitPayment ? `
              <div class="info-line" style="font-weight:700; margin-top:4px;"><span>طريقة الدفع (مقسّمة):</span><span></span></div>
              ${paymentBreakdown.map(p => `<div class="info-line" style="padding-right:8px;"><span>• ${payLabel(p.type)}</span><span>${parseFloat(p.amount).toFixed(2)} SAR</span></div>`).join('')}
              ` : `
              <div class="info-line"><span>طريقة الدفع:</span><span>${payLabel(sale.payment)}</span></div>
              `}
              <div class="info-line"><span>المدفوع:</span><span>${parseFloat(sale.paid || sale.total).toFixed(2)} SAR</span></div>
              ${parseFloat(sale.change||0) > 0 ? `<div class="info-line"><span>الباقي:</span><span>${parseFloat(sale.change).toFixed(2)} SAR</span></div>` : ''}
          </div>

          <div class="qr-box">
              <img src="${qrUrl}" style="width:100%; height:100%;">
          </div>

          <div class="footer">
              <p style="margin:0; font-weight: 700;">${footer}</p>
              ${buildSocialFooterHTML(settings)}
              <div style="margin-top:15px; font-size:10px; color:#000; border-top:1px dashed #000; padding-top:8px;">
                  Developed by البصمة الذكية<br>
                  ea.gaber10@gmail.com
              </div>
          </div>
          
          <div style="height: 35px;"></div>
          </div>
      </body></html>`;
    }

    if (window.api) {
      if (width !== 'A4' && settings.printer_name && window.api.printHTMLSilent) {
        window.api.printHTMLSilent({ html, printerName: settings.printer_name });
      } else if (window.api.printHTML) {
        window.api.printHTML(html);
      }
    } else {
      const win = window.open('', '_blank', `width=${width === 'A4' ? 900 : 450},height=${width === 'A4' ? 1100 : 650}`);
      if (win) { 
        win.document.write(html); 
        win.document.close(); 
        win.onload = () => { 
          setTimeout(() => { win.print(); win.close(); }, 500); 
        }; 
      }
    }
    } catch (err) {
      alert('خطأ في الطباعة: ' + err.message);
      console.error(err);
    }
  };

  const printCreditNote = async (sale, forceWidth) => {
    if (!sale) return;
    const bizAr  = settings.business_name_ar || 'نظام البصمة الذكية';
    const bizEn  = settings.business_name_en || '';
    const logo   = settings.business_logo || '';
    const footer = settings.receipt_footer || 'شكراً لزيارتكم';
    const vatNum = settings.vat_number || '---';
    const addr   = settings.address || '';
    const width  = forceWidth || settings.receipt_width || '80';

    let items = [];
    try { items = JSON.parse(sale.items_json || '[]'); } catch { items = []; }

    // Credit note totals are stored as negatives — display as positives
    const grRaw   = parseFloat(sale.total || 0);
    const gr      = Math.abs(grRaw);
    const vatAmt  = Math.abs(parseFloat(sale.tax || grRaw * vatRate / (1 + vatRate)));
    const net     = gr - vatAmt;

    // Extract original invoice number from the note field or invoice number (CN-ORIG-XXXX)
    const origInvoiceMatch = (sale.note || '').match(/الفاتورة الأصلية #([^\s-]+)/);
    const origInvoice = origInvoiceMatch ? origInvoiceMatch[1] : (sale.invoice.replace(/^CN-/, '').split('-').slice(0, -1).join('-') || '—');

    const qrData = await window.api?.getZatcaTLV?.({
      invoice: sale.invoice,
      seller: bizAr,
      vatNo: vatNum,
      timestamp: new Date(sale.sale_date).toISOString(),
      total: gr.toFixed(2),
      vatAmt: vatAmt.toFixed(2)
    });
    const svg   = QRCode.generateSVG(qrData || '', 3);
    const qrUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

    const pageSize = width === 'A4' ? '210mm' : `${width}mm`;
    let html = '';

    if (width === 'A4') {
      html = `<html dir="rtl"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #fff; color: #1e293b; font-size: 13.5px; line-height: 1.5; }
          .cn-banner { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 14px; padding: 14px 22px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
          .cn-banner-title { font-size: 26px; font-weight: 900; color: #92400e; margin: 0; }
          .cn-banner-sub { font-size: 13px; color: #b45309; font-weight: 700; }
          .cn-ref { font-size: 13px; color: #78350f; font-weight: 800; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .divider { height: 3px; background: linear-gradient(to left, #f59e0b, #fbbf24); margin: 15px 0 20px 0; border-radius: 2px; }
          .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
          .info-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc; }
          .info-card-header { background: #fffbeb; color: #92400e; font-weight: 800; font-size: 14px; padding: 10px 15px; border-bottom: 1px solid #fde68a; }
          .info-card-body { padding: 15px; font-size: 12.5px; color: #334155; }
          .info-row { margin-bottom: 8px; display: flex; justify-content: space-between; }
          .info-label { font-weight: 700; color: #64748b; }
          .info-val { font-weight: bold; color: #0f172a; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .items-table th { background: #92400e; color: #fff; font-weight: bold; font-size: 12.5px; padding: 10px 8px; border: 1px solid #92400e; text-align: center; }
          .items-table td { padding: 10px 8px; border: 1px solid #e2e8f0; font-size: 12.5px; text-align: center; }
          .items-table tr:nth-child(even) { background: #fffbeb; }
          .col-right { text-align: right !important; }
          .totals-card { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #fff; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .totals-bold { font-weight: 900; font-size: 16px; background: #fffbeb; color: #92400e; border-top: 2px solid #f59e0b; }
          .qr-section { display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 15px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fafafa; }
          .footer { text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #64748b; }
          .neg { color: #ef4444; }
      </style></head><body>
      <div>
          <!-- Credit Note Banner -->
          <div class="cn-banner">
              <div>
                  <h1 class="cn-banner-title">إشعار دائن — Credit Note</h1>
                  <p class="cn-banner-sub">مرتجع / استرجاع — وثيقة إلغاء جزئي أو كلي</p>
              </div>
              <div style="text-align:left">
                  <div class="cn-ref">رقم الإشعار: <strong>${sale.invoice}</strong></div>
                  <div class="cn-ref">يشير إلى الفاتورة: <strong>#${origInvoice}</strong></div>
                  <div style="font-size:12px; color:#b45309; margin-top:4px;">${new Date(sale.sale_date).toLocaleString('ar-SA')}</div>
              </div>
          </div>

          <!-- Seller / Buyer info -->
          <div class="cards-grid">
              <div class="info-card">
                  <div class="info-card-header">بيانات المورد (Supplier)</div>
                  <div class="info-card-body">
                      <div class="info-row"><span class="info-label">اسم المنشأة:</span><span class="info-val">${bizAr}</span></div>
                      ${bizEn ? `<div class="info-row"><span class="info-label">Name:</span><span class="info-val">${bizEn}</span></div>` : ''}
                      <div class="info-row"><span class="info-label">الرقم الضريبي:</span><span class="info-val">${vatNum}</span></div>
                      <div class="info-row"><span class="info-label">العنوان:</span><span class="info-val">${addr || '—'}</span></div>
                  </div>
              </div>
              <div class="info-card">
                  <div class="info-card-header">بيانات العميل (Customer)</div>
                  <div class="info-card-body">
                      <div class="info-row"><span class="info-label">الاسم:</span><span class="info-val">${sale.customer_name || 'عميل نقدي'}</span></div>
                      <div class="info-row"><span class="info-label">طريقة الإرجاع:</span><span class="info-val">${sale.payment || '—'}</span></div>
                      ${sale.note ? `<div class="info-row"><span class="info-label">الملاحظة:</span><span class="info-val" style="font-size:11px">${sale.note}</span></div>` : ''}
                  </div>
              </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
              <thead>
                  <tr>
                      <th style="width:5%">#</th>
                      <th class="col-right" style="width:38%">الصنف</th>
                      <th style="width:12%">سعر الوحدة (شامل ض.ق.م)</th>
                      <th style="width:10%">الكمية المُرجعة</th>
                      <th style="width:12%">المجموع</th>
                      <th style="width:8%">نسبة الضريبة</th>
                      <th style="width:8%">الضريبة</th>
                      <th style="width:10%">الإجمالي شامل الضريبة</th>
                  </tr>
              </thead>
              <tbody>
                  ${items.map((it, idx) => {
                      const qty     = Math.abs(parseFloat(it.Qty));
                      const price   = Math.abs(parseFloat(it.Price));
                      const lineGr  = qty * price;
                      const lineTax = lineGr * vatRate / (1 + vatRate);
                      const lineSub = lineGr - lineTax;
                      return `<tr>
                          <td>${idx + 1}</td>
                          <td class="col-right">${it.Name}</td>
                          <td>${price.toFixed(2)}</td>
                          <td class="neg">−${qty}</td>
                          <td>${lineSub.toFixed(2)}</td>
                          <td>${(vatRate * 100).toFixed(0)}%</td>
                          <td>${lineTax.toFixed(2)}</td>
                          <td class="neg" style="font-weight:bold">−${lineGr.toFixed(2)}</td>
                      </tr>`;
                  }).join('')}
              </tbody>
          </table>

          <!-- Totals + QR -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; align-items:start">
              <div class="qr-section" style="flex-direction:column; padding:20px">
                  <img src="${qrUrl}" style="width:110px; height:110px;">
                  <div style="font-size:11px; color:#64748b; text-align:center; margin-top:8px;">
                      إشعار دائن معتمد ZATCA<br>${bizAr} — ${vatNum}
                  </div>
              </div>
              <div class="totals-card">
                  <div class="totals-row"><span>المجموع الفرعي (قبل الضريبة)</span><span class="neg">−${net.toFixed(2)} SAR</span></div>
                  <div class="totals-row"><span>ضريبة القيمة المضافة (${(vatRate*100).toFixed(0)}%)</span><span class="neg">−${vatAmt.toFixed(2)} SAR</span></div>
                  <div class="totals-row totals-bold"><span>إجمالي الإشعار الدائن</span><span class="neg">−${gr.toFixed(2)} SAR</span></div>
              </div>
          </div>

          <div class="footer">
              <p style="margin:0; font-weight:bold">${footer}</p>
              <p style="margin:5px 0 0; font-size:10px">هذا الإشعار الدائن يُلغي كلياً أو جزئياً الفاتورة الأصلية رقم #${origInvoice}</p>
          </div>
      </div>
      </body></html>`;
    } else {
      // Thermal 80mm layout
      html = `<html dir="rtl"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          @page { margin: 0; size: 80mm auto; }
          html, body { width: 80mm; margin: 0; padding: 0; background: #fff; }
          body { font-family: 'Tajawal', sans-serif; font-size: 13px; color: #000; }
          .w { width: 72mm; margin: 0 auto; padding-bottom: 5mm; }
          .c { text-align: center; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; font-weight: 500; }
          .sep { border-top: 1.5px dashed #000; margin: 8px 0; }
          .sep-solid { border-top: 1.5px solid #000; margin: 8px 0; }
          .cn-label { text-align: center; font-weight: 900; font-size: 15px; border: 2px solid #000; padding: 5px; margin: 8px 0; }
          .items-hdr { display: flex; border-bottom: 1px solid #000; padding-bottom: 4px; font-weight: bold; font-size: 11px; }
          .item-row { display: flex; border-bottom: 1px dashed #000; padding: 5px 0; font-size: 11px; }
          .c1 { flex: 2; text-align: right; }
          .c2 { flex: 0.7; text-align: center; }
          .c3 { flex: 1; text-align: center; }
          .c4 { flex: 1.1; text-align: left; }
          .total-bold { font-weight: bold; font-size: 14px; }
          .qr { margin: 12px auto; width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; }
          .neg { font-weight: bold; }
      </style></head><body>
      <div class="w">
          <div class="c" style="margin-bottom:6px">
              ${logo ? `<img src="${logo}" style="max-height:50px; max-width:130px; margin-bottom:4px;"><br>` : ''}
              <strong style="font-size:16px">${bizAr}</strong><br>
              <span style="font-size:11px">الرقم الضريبي: ${vatNum}</span>
          </div>
          <div class="sep-solid"></div>
          <div class="cn-label">إشعار دائن — Credit Note</div>
          <div class="row"><span>رقم الإشعار:</span><span>${sale.invoice}</span></div>
          <div class="row"><span>يشير إلى فاتورة:</span><span>#${origInvoice}</span></div>
          <div class="row"><span>التاريخ:</span><span dir="ltr">${new Date(sale.sale_date).toLocaleString('ar-SA')}</span></div>
          ${sale.customer_name ? `<div class="row"><span>العميل:</span><span>${sale.customer_name}</span></div>` : ''}
          <div class="sep"></div>

          <div class="items-hdr">
              <div class="c1">الصنف</div>
              <div class="c2">العدد</div>
              <div class="c3">السعر</div>
              <div class="c4">الإجمالي</div>
          </div>
          ${items.map(it => {
              const qty   = Math.abs(parseFloat(it.Qty));
              const price = Math.abs(parseFloat(it.Price));
              return `<div class="item-row">
                  <div class="c1">${it.Name}</div>
                  <div class="c2 neg">−${qty}</div>
                  <div class="c3">${price.toFixed(2)}</div>
                  <div class="c4 neg">−${(qty*price).toFixed(2)}</div>
              </div>`;
          }).join('')}

          <div class="sep-solid"></div>
          <div class="row"><span>المجموع الفرعي:</span><span>−${net.toFixed(2)} SAR</span></div>
          <div class="row"><span>الضريبة (${(vatRate*100).toFixed(0)}%):</span><span>−${vatAmt.toFixed(2)} SAR</span></div>
          <div class="row total-bold sep-solid" style="margin-top:6px; padding-top:6px; border-top:1.5px solid #000">
              <span>إجمالي الإشعار:</span><span>−${gr.toFixed(2)} SAR</span>
          </div>

          <div class="qr"><img src="${qrUrl}" style="width:100%;height:100%;"></div>

          <div class="c" style="font-size:10px; margin-top:8px; border-top:1px dashed #000; padding-top:6px">
              ${footer}<br>
              هذا الإشعار يُلغي جزءاً أو كلاً من فاتورة رقم #${origInvoice}
          </div>
          <div style="height:30px"></div>
      </div>
      </body></html>`;
    }

    if (window.api?.printHTML) {
      window.api.printHTML(html);
    } else {
      const win = window.open('', '_blank', `width=${width === 'A4' ? 900 : 450},height=${width === 'A4' ? 1100 : 650}`);
      if (win) { win.document.write(html); win.document.close(); win.onload = () => { setTimeout(() => { win.print(); win.close(); }, 500); }; }
    }
  };

  const printQuote = (q) => {
    const bizAr = settings.business_name_ar || 'البصمة الذكية';
    const logo  = settings.business_logo || '';
    const vatNo = settings.vat_number || '---';
    const phone = settings.phone || '';
    
    // National Address
    const naBuilding = settings.national_address_building || '';
    const naStreet   = settings.national_address_street || '';
    const naDistrict = settings.national_address_district || '';
    const naPostal   = settings.national_address_postal || '';
    const naCity     = settings.national_address_city || '';
    const fullNatAddr = `${naBuilding} ${naStreet}, ${naDistrict}, ${naCity} ${naPostal}`;

    // Bank
    const bankIban = settings.bank_iban || '';
    const bankName = settings.bank_name || '';
    const bankBen  = settings.bank_beneficiary || '';

    const items = q.items || [];
    const gr    = items.reduce((sum, item) => sum + (parseFloat(item.Price) * parseFloat(item.Qty)), 0);
    const vatRateVal = parseFloat(settings.vat_rate || '0.15');
    const vatAmt = gr * vatRateVal / (1 + vatRateVal);
    const net    = gr - vatAmt;
    
    const html = `<html dir="rtl"><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 0; }
      body { 
        font-family: 'Tajawal', sans-serif; 
        color: #1e293b; 
        margin: 0; 
        padding: 40px; 
        line-height: 1.5; 
        background: #fff;
        -webkit-print-color-adjust: exact;
      }
      
      /* Header Section */
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
      .watermark { font-size: 42px; font-weight: 900; color: #cbd5e1; letter-spacing: 1px; margin: 0; text-transform: uppercase; opacity: 0.6; }
      .biz-details { text-align: left; font-size: 13px; color: #334155; line-height: 1.8; }
      .logo-img { max-height: 60px; margin-bottom: 8px; }
      
      .quote-meta { margin-top: -10px; }
      .quote-id { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px; }
      .quote-date { font-size: 19px; font-weight: 700; color: #334155; margin-top: 10px; }
      
      .blue-divider { height: 4px; background: #2563eb; width: 100%; margin: 25px 0 35px 0; border-radius: 2px; }
      
      /* Information Boxes */
      .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 45px; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0; overflow: hidden; background: #fff; min-height: 160px; }
      .card-header { font-size: 16px; font-weight: 800; color: #1e40af; padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #eff6ff; }
      .card-body { padding: 15px 20px; font-size: 14px; font-weight: 700; color: #334155; }
      .card-body div { margin-bottom: 10px; display: flex; align-items: flex-start; gap: 6px; }
      .card-body .bullet { color: #1e40af; font-size: 18px; line-height: 14px; }

      /* Items Table */
      table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
      th { padding: 14px 10px; text-align: right; font-size: 15px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; }
      td { padding: 16px 10px; border-bottom: 1px solid #f1f5f9; font-size: 15px; font-weight: 700; color: #1e293b; }
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      
      /* Totals & Bank Section */
      .bottom-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; align-items: start; }
      
      .bank-card { border: 2px solid #10b981; border-radius: 16px; padding: 25px; background: #fff; position: relative; }
      .bank-label { color: #059669; font-weight: 900; font-size: 17px; margin-bottom: 15px; display: block; }
      .bank-row { font-size: 15px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
      .bank-row span { color: #059669; }
      
      .totals-area { text-align: left; padding-left: 20px; }
      .sub-total-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 16px; font-weight: 800; color: #475569; }
      .grand-total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; border-top: 4px solid #2563eb; padding-top: 15px; color: #1e3a8a; }
      .grand-total-label { font-size: 24px; font-weight: 900; }
      .grand-total-value { font-size: 24px; font-weight: 900; }
      
      .copyright { text-align: center; font-size: 13px; color: #64748b; margin-top: 100px; padding-top: 25px; border-top: 1px solid #f1f5f9; font-weight: 700; }
    </style></head><body>
      
      <div class="header">
        <div>
          <h1 class="watermark">QUOTATION</h1>
        </div>
        <div class="biz-details">
          ${logo ? `<img src="${logo}" class="logo-img"/><br>` : ''}
          <b>الرقم الضريبي:</b> ${vatNo}<br>
          <b>العنوان الوطني:</b> ${fullNatAddr}<br>
          <b>هاتف:</b> ${phone}
        </div>
      </div>

      <div class="quote-meta">
        <h2 class="quote-id">عرض سعر #QT-${Date.now().toString().slice(-8)}</h2>
        <div class="quote-date">التاريخ: ${new Date(q.created_at).toLocaleDateString('ar-SA')} هـ</div>
      </div>

      <div class="blue-divider"></div>

      <div class="info-container">
        <div class="card">
          <div class="card-header">تفاصيل العرض (Terms)</div>
          <div class="card-body">
            <div><span class="bullet">•</span> هذا العرض صالح لمدة 7 أيام عمل.</div>
            <div><span class="bullet">•</span> الأسعار تشمل ضريبة القيمة المضافة ${Math.round(vatRateVal * 100)}%.</div>
            <div><span class="bullet">•</span> التوصيل: من مقر المنشأة.</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">العميل (Customer)</div>
          <div class="card-body">
            <div><b>الاسم:</b> ${q.customer_name || 'عميل نقدي'}</div>
            ${q.customer_phone ? `<div><b>الهاتف:</b> ${q.customer_phone}</div>` : ''}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 50%;">الصنف</th>
            <th class="text-center">الكمية</th>
            <th class="text-center">السعر</th>
            <th class="text-left">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${i.Name}</td>
              <td class="text-center">${i.Qty}</td>
              <td class="text-center">${parseFloat(i.Price).toFixed(2)}</td>
              <td class="text-left">${(parseFloat(i.Price) * parseFloat(i.Qty)).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="bottom-layout">
        <div class="totals-area">
          <div class="sub-total-row">
            <span>المجموع الفرعي</span>
            <span>SAR ${net.toFixed(2)}</span>
          </div>
          <div class="sub-total-row">
            <span>الضريبة (${Math.round(vatRateVal * 100)}%)</span>
            <span>SAR ${vatAmt.toFixed(2)}</span>
          </div>
          <div class="grand-total-row">
            <span class="grand-total-label">الإجمالي</span>
            <span class="grand-total-value">SAR ${gr.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="bank-card">
          <span class="bank-label">معلومات التحويل البنكي:</span>
          <div class="bank-row"><span>البنك:</span> ${bankName}</div>
          <div class="bank-row"><span>المستفيد:</span> ${bankBen}</div>
          <div class="bank-row"><span>الآيبان:</span> <span style="font-family: monospace; letter-spacing: 0.5px; color: #1e293b;">${bankIban}</span></div>
        </div>
      </div>

      <div class="copyright">
        تم إنشاء هذا العرض آلياً. جميع الحقوق محفوظة لـ ${bizAr}.
      </div>

    </body></html>`;
    if (window.api?.printHTML) {
      window.api.printHTML(html);
    } else {
      const win = window.open('', '_blank', 'width=1100,height=1300');
      if(win){ win.document.write(html); win.document.close(); setTimeout(()=>win.print(),800); }
    }
  };




  return (
    <AppLayout title={t('history.title')}>
      <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'12px', borderBottom:'2px solid #e2e8f0', paddingBottom:'2px' }}>
          <button onClick={() => setActiveTab('sales')}
            style={{ padding:'12px 24px', background:'none', border:'none', borderBottom: activeTab === 'sales' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'sales' ? '#3b82f6' : '#64748b', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'8px' }}>
            <FileText size={18}/> {t('history.tabs.sales')}
          </button>
          <button onClick={() => setActiveTab('quotes')}
            style={{ padding:'12px 24px', background:'none', border:'none', borderBottom: activeTab === 'quotes' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'quotes' ? '#3b82f6' : '#64748b', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'8px' }}>
            <ShoppingBag size={18}/> {t('history.tabs.quotes')}
            {quotes.length > 0 && <span style={{ background:'#3b82f6', color:'white', borderRadius:'99px', padding:'2px 8px', fontSize:'11px' }}>{quotes.length}</span>}
          </button>
        </div>

        {activeTab === 'sales' && (
          <>
            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'16px' }}>
          {[
            { label:t('history.summary.total_sales'),    val:`SAR ${totalRevenue.toFixed(2)}`, icon:'💰', col:'#3b82f6' },
            { label:t('history.summary.vat'), val:`SAR ${totalVAT.toFixed(2)}`,     icon:'🧾', col:'#8b5cf6' },
            { label:t('history.summary.invoice_count'),       val: sales.filter(s=>s.status!=='void').length, icon:'📋', col:'#10b981' },
            { label:t('history.summary.void_count'),       val: voidCount,                         icon:'❌', col:'#ef4444' },
          ].map(c => (
            <div key={c.label} style={{ background:'white', padding:'18px', borderRadius:'18px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:'24px', marginBottom:'8px' }}>{c.icon}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'700', marginBottom:'4px' }}>{c.label}</div>
              <div style={{ fontSize:'18px', fontWeight:'900', color: c.col }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end', background:'white', padding:'16px 20px', borderRadius:'18px', border:'1px solid #f1f5f9' }}>
          <div>
            <label style={lbl}>{t('history.filters.from')}</label>
            <input type="date" value={range.startDate} onChange={e => setRange(r => ({ ...r, startDate: e.target.value }))} style={dateInp} />
          </div>
          <div>
            <label style={lbl}>{t('history.filters.to')}</label>
            <input type="date" value={range.endDate} onChange={e => setRange(r => ({ ...r, endDate: e.target.value }))} style={dateInp} />
          </div>
          <div style={{ position:'relative' }}>
            <Search size={15} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('history.filters.search_placeholder')}
              style={{ ...dateInp, paddingRight:'34px' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={dateInp}>
            <option value="all">{t('history.status.all')}</option>
            <option value="paid">{t('history.status.paid')}</option>
            <option value="partial">مدفوع جزئياً</option>
            <option value="credit">{t('history.status.credit')}</option>
            <option value="void">{t('history.status.void')}</option>
          </select>
          <button onClick={() => fetchSales()} className="btn btn-primary" style={{ padding:'11px 20px' }}>
            <RefreshCw size={15}/> {t('history.filters.apply')}
          </button>
          <button onClick={exportCSV} style={{ padding:'11px 16px', background:'#f0fdf4', border:'1px solid #a7f3d0', borderRadius:'12px', color:'#059669', cursor:'pointer', fontWeight:'700', fontFamily:'inherit', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}>
            <Download size={14}/> {t('history.filters.export_csv')}
          </button>
          <ExportButton
            format="pdf"
            label={t('history.filters.export_pdf')}
            title={`${t('history.filters.pdf_title')} — ${range.startDate} ${t('history.filters.to')} ${range.endDate}`}
            subtitle={`${range.startDate} — ${range.endDate}`}
            headers={[t('history.filters.headers_invoice'), t('history.filters.headers_date'), t('history.filters.headers_customer'), t('history.filters.headers_payment'), t('history.filters.headers_total'), t('history.filters.headers_tax'), t('history.filters.headers_status')]}
            rows={sales.map(s => [
              s.invoice,
              (s.sale_date||'').split('T')[0],
              s.customer_name||t('history.table.general_customer'),
              s.payment||'—',
              parseFloat(s.total||0).toFixed(2),
              parseFloat(s.tax||(s.total*vatRate/(1+vatRate))||0).toFixed(2),
              s.status==='void'?t('history.status.void'):s.status==='credit'?t('history.status.credit'):t('history.status.paid')
            ])}
            summaryRows={[
              {label:t('history.summary.invoice_count'), value: sales.filter(s=>s.status!=='void').length},
              {label:t('history.summary.total_sales'), value: totalRevenue.toFixed(2)},
              {label:t('history.summary.vat'), value: totalVAT.toFixed(2)},
            ]}
            filename={`sales-${range.startDate}-${range.endDate}.pdf`}
          />
          <ExportButton
            format="excel"
            label={t('history.filters.export_excel')}
            title={t('history.filters.pdf_title')}
            headers={[t('history.filters.headers_invoice'), t('history.filters.headers_date'), t('history.filters.headers_customer'), t('history.filters.headers_payment'), t('history.filters.headers_total'), t('history.filters.headers_tax'), t('history.filters.headers_status')]}
            rows={sales.map(s => [
              s.invoice,
              (s.sale_date||'').split('T')[0],
              s.customer_name||t('history.table.general_customer'),
              s.payment||'—',
              parseFloat(s.total||0).toFixed(2),
              parseFloat(s.tax||(s.total*vatRate/(1+vatRate))||0).toFixed(2),
              s.status==='void'?t('history.status.void'):s.status==='credit'?t('history.status.credit'):t('history.status.paid')
            ])}
            filename={`sales-${range.startDate}-${range.endDate}.xlsx`}
          />
        </div>

        {/* Table */}
        <div style={{ background:'white', borderRadius:'20px', border:'1px solid #f1f5f9', overflowX:'auto', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
              <tr>
                {['', t('history.table.invoice_no'), t('history.table.date'), t('history.table.customer'), t('history.table.payment'), t('history.table.total'), t('history.table.tax'), t('history.table.status'), t('history.table.actions')].map(h => (
                  <th key={h} style={{ padding:'16px 20px', fontSize:'11px', color:'#94a3b8', fontWeight:'800', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>
                  <RefreshCw size={20} style={{ animation:'spin 1s linear infinite' }}/> {t('history.table.loading')}
                </td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.3 }}>📋</div>
                  {t('history.table.no_sales')}
                </td></tr>
              ) : sales.map((s, i) => {
                const derivedStatus = (parseFloat(s.paid || 0) + 0.01 < parseFloat(s.total || 0) && s.status !== 'void' && s.status !== 'credit') ? 'partial' : s.status;
                const st = statusLabel(derivedStatus, t);
                const vatAmt = parseFloat(s.tax || s.total * vatRate / (1 + vatRate));
                const items = parsedItemsBySaleId.get(s.id) || [];
                return [
                  <tr key={s.invoice} style={{ borderBottom:'1px solid #f8fafc', background: s.status==='void' ? '#fefefe' : 'transparent', opacity: s.status==='void' ? .6 : 1 }}>
                    <td style={{ padding:'16px 20px' }}>
                      <button onClick={() => setExpanded(expanded===i ? null : i)}
                        style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', display:'flex', transition:'transform 0.15s ease' }}>
                        {expanded===i ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    </td>
                    <td style={{ padding:'16px 20px', fontFamily:"'Inter', monospace", fontSize:'13px', color:'#3b82f6', fontWeight:'700' }}>
                      #{s.invoice}
                    </td>
                    <td style={{ padding:'16px 20px', fontSize:'12px', color:'#64748b' }}>
                      {s.sale_date ? new Date(s.sale_date).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                    <td style={{ padding:'16px 20px', fontSize:'13px', fontWeight:'600' }}>{s.customer_name || t('history.table.general_customer')}</td>
                    <td style={{ padding:'16px 20px', fontSize:'12px', color:'#64748b' }}>{s.payment || '—'}</td>
                    <td style={{ padding:'16px 20px', fontWeight:'800', fontSize:'14px', fontFamily:"'Inter', sans-serif" }}>SAR {parseFloat(s.total||0).toFixed(2)}</td>
                    <td style={{ padding:'16px 20px', fontSize:'12px', color:'#8b5cf6', fontWeight:'700', fontFamily:"'Inter', sans-serif" }}>SAR {vatAmt.toFixed(2)}</td>
                    <td style={{ padding:'16px 20px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-start' }}>
                        <span style={{ background:st.bg, color:st.col, padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:'800' }}>{st.label}</span>
                        {/* [W-5] ZATCA clearance badge */}
                        {(() => {
                          const isB2B = !!(s.customer_tax_id);
                          const cb = zatcaClearanceBadge(s.zatca_clearance_status, isB2B, t);
                          return cb ? <span style={{ background:cb.bg, color:cb.col, padding:'3px 8px', borderRadius:'99px', fontSize:'10px', fontWeight:'800' }}>{cb.label}</span> : null;
                        })()}
                      </div>
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', flexWrap:'nowrap', gap:'6px' }}>
                        <button onClick={() => downloadXML(s)} title="تحميل XML للـ ZATCA"
                          style={{ padding:'6px 10px', background:'#eff6ff', border:'none', color:'#3b82f6', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                          <FileText size={13}/> XML
                        </button>
                        {s.status !== 'void' && s.status !== 'credit' && (
                          <>
                            {/* [W-5] For B2B invoices pending clearance, disable print/share and show Arabic tooltip */}
                            {!!(s.customer_tax_id) && s.zatca_clearance_status !== 'cleared' ? (
                              <span
                                title={t('history.actions.pending_zatca_title')}
                                style={{ padding:'6px 10px', background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#94a3b8', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'not-allowed', userSelect:'none' }}
                              >
                                {t('history.actions.pending_zatca_badge')}
                              </span>
                            ) : (
                              <>
                                {s.order_type === 'tailor' ? (
                                  <button onClick={() => printTailorTicket(s)} title="Tailor Ticket"
                                    style={{ padding:'6px 10px', background:'#4338ca', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                                    <Printer size={13}/> ورقة عمل الخياط
                                  </button>
                                ) : (
                                  <button onClick={() => printReceipt(s, 'A4')} title="A4"
                                    style={{ padding:'6px 10px', background:'#0f172a', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                                    <Printer size={13}/> {t('history.actions.print_a4')}
                                  </button>
                                )}
                                <button onClick={() => printReceipt(s, '80')} title="80mm"
                                  style={{ padding:'6px 10px', background:'#2563eb', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                                  <Printer size={13}/> {t('history.actions.print_thermal')}
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {s.status === 'credit' && (
                          <>
                            <button onClick={() => printCreditNote(s, 'A4')} title="A4"
                              style={{ padding:'6px 10px', background:'#92400e', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Printer size={13}/> {t('history.actions.print_cn_a4')}
                            </button>
                            <button onClick={() => printCreditNote(s, '80')} title="80mm"
                              style={{ padding:'6px 10px', background:'#d97706', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Printer size={13}/> {t('history.actions.print_cn_thermal')}
                            </button>
                          </>
                        )}
                        {s.status !== 'void' && s.status !== 'credit' && parseFloat(s.paid || 0) + 0.01 < parseFloat(s.total || 0) && (
                          <button onClick={() => handlePayRemaining(s)} title="دفع المتبقي"
                            style={{ padding:'6px 8px', background:'#ecfdf5', border:'1px solid #a7f3d0', color:'#059669', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit', fontSize:'12px', fontWeight:'800' }}>
                            دفع المتبقي
                          </button>
                        )}
                        {s.status !== 'void' && s.status !== 'credit' && parseFloat(s.total) > 0 && (
                          <button onClick={() => openReturn(s)} title="Return"
                            style={{ padding:'6px 8px', background:'#fef3c7', border:'none', color:'#d97706', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit', fontSize:'12px', fontWeight:'700' }}>
                            {t('history.actions.return')}
                          </button>
                        )}
                        {s.status !== 'void' && s.status !== 'credit' && parseFloat(s.total) > 0 && !s.payment_method_corrected && (
                          <button onClick={() => setPaymentModal(s)} title="تصحيح الدفع"
                            style={{ padding:'6px 8px', background:'#e0e7ff', border:'none', color:'#4338ca', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit', fontSize:'12px', fontWeight:'700' }}>
                            تصحيح طريقة الدفع
                          </button>
                        )}
                        {s.customer_tax_id && s.status !== 'void' && (
                          <button onClick={() => setDebitModal({ invoice: s.invoice, customer_tax_id: s.customer_tax_id })}
                            style={{ padding:'6px 12px', background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                            {t('history.actions.debit_note')}
                          </button>
                        )}
                        {/* ZATCA COMPLIANCE: void button hidden — cancellation is only allowed via credit note (إرجاع) per ZATCA e-invoicing rules */}
                      </div>
                    </td>
                  </tr>,
                  // Expanded items row
                  expanded === i && (
                    <tr key={`${s.invoice}-det`} style={{ background:'#fafbfc', borderBottom:'1px solid #f1f5f9' }}>
                      <td colSpan={9} style={{ padding:'14px 32px' }}>
                        <div style={{ display:'flex', gap:'40px', flexWrap:'wrap' }}>
                          <div style={{ flex:2 }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'8px' }}>{t('history.table.items')}</div>
                            {items.map((it, j) => (
                              <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px dashed #f1f5f9', fontSize:'13px' }}>
                                <span>{it.Name} × {it.Qty}</span>
                                <span style={{ fontWeight:'700' }}>SAR {(it.Price * it.Qty).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ minWidth:'180px' }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'8px' }}>{t('history.table.summary')}</div>
                            <div style={{ fontSize:'12px', display:'flex', flexDirection:'column', gap:'4px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', gap:'20px' }}><span style={{ color:'#94a3b8' }}>{t('history.table.net')}</span><span>SAR {(parseFloat(s.total)-vatAmt).toFixed(2)}</span></div>
                              <div style={{ display:'flex', justifyContent:'space-between', gap:'20px' }}><span style={{ color:'#94a3b8' }}>{t('history.table.tax')}</span><span>SAR {vatAmt.toFixed(2)}</span></div>
                              {parseFloat(s.discount||0)>0 && <div style={{ display:'flex', justifyContent:'space-between', gap:'20px' }}><span style={{ color:'#94a3b8' }}>{t('history.table.discount')}</span><span style={{ color:'#10b981' }}>- SAR {parseFloat(s.discount).toFixed(2)}</span></div>}
                              {s.note && <div style={{ marginTop:'4px', color:'#64748b' }}>📝 {s.note}</div>}
                              {s.uuid && <div style={{ marginTop:'6px', fontFamily:'monospace', fontSize:'10px', color:'#cbd5e1', wordBreak:'break-all' }}>UUID: {s.uuid}</div>}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
          </>
        )}

        {/* Quotes Tab */}
        {activeTab === 'quotes' && (
          <div style={{ background:'white', borderRadius:'20px', border:'1px solid #f1f5f9', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
              <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                <tr>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>{t('history.table.title')}</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>{t('history.table.date')}</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>{t('history.table.notes')}</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>{t('history.table.est_total')}</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>{t('history.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>{t('history.table.loading')}</td></tr>
                ) : quotes.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>{t('history.table.no_quotes')}</td></tr>
                ) : quotes.map((q) => {
                  const estTotal = q.items.reduce((sum, item) => sum + (parseFloat(item.Price) * parseFloat(item.Qty)), 0);
                  return (
                    <tr key={q.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'12px 14px', fontWeight:'700', fontSize:'13px' }}>{q.label}</td>
                      <td style={{ padding:'12px 14px', fontSize:'12px', color:'#64748b' }}>{new Date(q.created_at).toLocaleString('ar-SA')}</td>
                      <td style={{ padding:'12px 14px', fontSize:'12px', color:'#64748b' }}>{q.note || '—'}</td>
                      <td style={{ padding:'12px 14px', fontWeight:'800', fontSize:'14px', color:'#3b82f6' }}>SAR {estTotal.toFixed(2)}</td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', gap:'8px' }}>
                          <button onClick={() => navigate('/pos', { state: { resumeHeld: q } })}
                            style={{ padding:'6px 12px', background:'#eff6ff', color:'#2563eb', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit' }}>
                            {t('history.actions.to_invoice')}
                          </button>
                          <button onClick={() => printQuote(q)}
                            style={{ padding:'6px 12px', background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit' }}>
                            🖨️ {t('history.actions.print_quote')}
                          </button>
                          <button onClick={async () => {
                            if(confirm(t('history.alerts.confirm_delete_quote'))) {
                              await window.api.deleteHeldOrder(q.id);
                              fetchSales();
                            }
                          }}
                            style={{ padding:'6px 12px', background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit' }}>
                            {t('history.actions.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Payment Correction modal */}
      {paymentModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.target===e.currentTarget && setPaymentModal(null)}>
          <div style={{ background:'white', borderRadius:'22px', padding:'32px', maxWidth:'420px', width:'95%', textAlign:'center' }} dir="rtl">
            <h3 style={{ fontWeight:'800', marginBottom:'8px' }}>تصحيح طريقة الدفع للفاتورة #{paymentModal.invoice}</h3>
            <p style={{ color:'#64748b', fontSize:'13px', marginBottom:'20px', fontWeight:'700' }}>
              الرجاء تحديد الطريقة الصحيحة (مسموح بالتعديل مرة واحدة فقط).
            </p>
            <select value={newPaymentMethod} onChange={e => setNewPaymentMethod(e.target.value)}
              style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', marginBottom:'16px', textAlign:'right', boxSizing:'border-box' }}>
              <option value="">اختر طريقة الدفع الصحيحة...</option>
              <option value="Cash">نقدي</option>
              <option value="Card">بطاقة (مدى/فيزا)</option>
              <option value="STC">STC Pay</option>
              <option value="Bank">تحويل بنكي</option>
            </select>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button onClick={() => setPaymentModal(null)} style={{ padding:'12px 24px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>{t('history.modals.cancel')}</button>
              <button onClick={handleCorrectPayment} disabled={!newPaymentMethod} style={{ padding:'12px 24px', background: newPaymentMethod ? '#4338ca' : '#94a3b8', color:'white', border:'none', borderRadius:'12px', cursor: newPaymentMethod ? 'pointer' : 'not-allowed', fontWeight:'700', fontFamily:'inherit' }}>تأكيد التصحيح</button>
            </div>
          </div>
        </div>
      )}

      {/* Void confirmation modal */}
      {voidModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.target===e.currentTarget && setVoidModal(null)}>
          <div style={{ background:'white', borderRadius:'22px', padding:'32px', maxWidth:'420px', width:'95%', textAlign:'center' }} dir="rtl">
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚠️</div>
            <h3 style={{ fontWeight:'800', marginBottom:'8px' }}>{t('history.modals.void_title')} #{voidModal}</h3>
            <p style={{ color:'#ef4444', fontSize:'13px', marginBottom:'20px', fontWeight:'700' }}>
              ملاحظة: الإلغاء يعكس القيود بالكامل. للإرجاع النظامي بهيئة الزكاة والدخل، الرجاء استخدام خيار (إشعار دائن/إرجاع).
            </p>
            <input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder={t('history.modals.void_reason_ph')}
              style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', marginBottom:'16px', textAlign:'right', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button onClick={() => setVoidModal(null)} style={{ padding:'12px 24px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>{t('history.modals.cancel')}</button>
              <button onClick={handleVoid} style={{ padding:'12px 24px', background:'#ef4444', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>{t('history.modals.void_confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note (Return) Modal — isolated component so typing a quantity
          only re-renders this small modal, not the whole sales table. */}
      {returnModal && (
        <ReturnModal
          sale={returnModal}
          vatRate={vatRate}
          t={t}
          onClose={() => setReturnModal(null)}
          onConfirm={handleReturn}
        />
      )}

      {/* Debit Note Modal */}
      {debitModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} dir="rtl">
          <div style={{ background:'white', borderRadius:'20px', padding:'32px', width:'420px', maxWidth:'90vw' }}>
            <h3 style={{ fontWeight:'900', fontSize:'18px', marginBottom:'20px' }}>{t('history.modals.debit_title')} — {debitModal.invoice}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:'700', color:'#475569', display:'block', marginBottom:'6px' }}>المبلغ (SAR شامل الضريبة)</label>
                <input type="number" value={debitAmount} onChange={e => setDebitAmount(e.target.value)} placeholder={t('history.modals.debit_amount_ph')} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'15px', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:'700', color:'#475569', display:'block', marginBottom:'6px' }}>{t('history.modals.debit_reason')}</label>
                <input value={debitReason} onChange={e => setDebitReason(e.target.value)} placeholder="مثال: رسوم إضافية..." style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'13px', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', marginTop:'24px' }}>
              <button onClick={handleDebitNote} style={{ flex:2, padding:'12px', background:'#f59e0b', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'800', fontSize:'13px' }}>{t('history.modals.debit_confirm')}</button>
              <button onClick={() => { setDebitModal(null); setDebitAmount(''); setDebitReason(''); }} style={{ flex:1, padding:'12px', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700' }}>{t('history.modals.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'5px' };
const dateInp = { padding:'10px 12px', borderRadius:'11px', border:'1px solid #e2e8f0', fontSize:'13px', outline:'none', fontFamily:'inherit', background:'white', cursor:'pointer' };

// ─────────────────────────────────────────────────────────────────────────
// ReturnModal — isolated so typing a return quantity never re-renders the
// (potentially huge) sales table in the parent. This is what fixes the
// "screen freezes when I click the amount box" bug: previously every
// keystroke updated state on SalesHistory itself, forcing React to
// reconcile the entire table (including re-parsing every row's items_json)
// on every character typed.
// ─────────────────────────────────────────────────────────────────────────
const ReturnModal = memo(function ReturnModal({ sale, vatRate, t, onClose, onConfirm }) {
  const [qtys, setQtys] = useState(() => Object.fromEntries(sale.items.map((_, i) => [i, 0])));
  const [reason, setReason] = useState(t('history.modals.return_reason_default'));
  const [submitting, setSubmitting] = useState(false);
  const [isTailorCut, setIsTailorCut] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState('');

  const setQty = (i, rawVal, maxQty) => {
    let v = parseFloat(rawVal);
    if (isNaN(v) || v < 0) v = 0;
    if (v > maxQty) v = maxQty;
    setQtys(prev => ({ ...prev, [i]: v }));
  };
  const step = (i, delta, maxQty) => {
    const current = parseFloat(qtys[i] || 0);
    setQty(i, current + delta, maxQty);
  };

  const returnAll = () => setQtys(Object.fromEntries(sale.items.map((it, i) => [i, parseFloat(it.Qty)])));
  const clearAll  = () => setQtys(Object.fromEntries(sale.items.map((_, i) => [i, 0])));

  const selectedLines = sale.items
    .map((it, i) => ({ ...it, qty: parseFloat(qtys[i] || 0) }))
    .filter(l => l.qty > 0);

  const rawGross = selectedLines.reduce((s, l) => s + l.qty * parseFloat(l.Price), 0);
  const penaltyVal = parseFloat(penaltyAmount) || 0;
  const returnGross = rawGross - penaltyVal;
  const returnVat   = returnGross * vatRate / (1 + vatRate);
  const returnNet   = returnGross - returnVat;
  const hasSelection = selectedLines.length > 0;

  const handleConfirm = async () => {
    if (!hasSelection || submitting) return;
    setSubmitting(true);
    await onConfirm(sale, selectedLines, reason);
    setSubmitting(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={e => e.target === e.currentTarget && !submitting && onClose()}>
      <div style={{ background:'white', borderRadius:'22px', padding:'28px', maxWidth:'560px', width:'95%', maxHeight:'88vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:'18px' }} dir="rtl">

        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <RotateCcw size={20} color="#d97706" />
            </div>
            <div>
              <h3 style={{ fontWeight:'800', fontSize:'18px', margin:0 }}>{t('history.modals.return_title')}</h3>
              <p style={{ color:'#64748b', fontSize:'12px', margin:0 }}>{t('history.modals.return_subtitle')} #{sale.invoice}</p>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button type="button" onClick={returnAll} disabled={submitting}
            style={{ flex:1, padding:'8px', borderRadius:'10px', border:'1px solid #fde68a', background:'#fffbeb', color:'#92400e', fontWeight:'700', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
            <PackageCheck size={14}/> إرجاع كل الأصناف
          </button>
          <button type="button" onClick={clearAll} disabled={submitting}
            style={{ flex:1, padding:'8px', borderRadius:'10px', border:'1px solid #e2e8f0', background:'#f8fafc', color:'#64748b', fontWeight:'700', fontSize:'12px', cursor:'pointer' }}>
            مسح الكميات
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px', border:'1px solid #f1f5f9', borderRadius:'14px', padding:'6px' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', padding:'6px 8px', borderBottom:'1px solid #f1f5f9', display:'flex' }}>
            <span style={{ flex:2 }}>{t('history.table.items')}</span>
            <span style={{ flex:1, textAlign:'center' }}>الكمية المشتراة</span>
            <span style={{ flex:'1.4', textAlign:'center' }}>كمية الإرجاع</span>
            <span style={{ flex:1, textAlign:'left' }}>المبلغ</span>
          </div>
          {sale.items.map((it, i) => {
            const qty = parseFloat(qtys[i] || 0);
            const lineTotal = qty * parseFloat(it.Price || 0);
            const maxQty = parseFloat(it.Qty || 0);
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', fontSize:'13px', padding:'6px 8px', borderRadius:'10px', background: qty > 0 ? '#fffbeb' : 'transparent' }}>
                <span style={{ flex:2, fontWeight:'600' }}>{it.Name}</span>
                <span style={{ flex:1, textAlign:'center', color:'#64748b' }}>{maxQty} × {parseFloat(it.Price).toFixed(2)}</span>
                <div style={{ flex:'1.4', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                  <button type="button" onClick={() => step(i, -1, maxQty)} disabled={submitting || qty <= 0}
                    style={{ width:'26px', height:'26px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: qty <= 0 ? .4 : 1 }}>
                    <Minus size={13}/>
                  </button>
                  <input type="number" min="0" max={maxQty} step="any" value={qtys[i] || ''}
                    onChange={e => setQty(i, e.target.value, maxQty)}
                    disabled={submitting}
                    style={{ width:'56px', padding:'6px', textAlign:'center', borderRadius:'8px', border:'1px solid #e2e8f0' }} />
                  <button type="button" onClick={() => step(i, 1, maxQty)} disabled={submitting || qty >= maxQty}
                    style={{ width:'26px', height:'26px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: qty >= maxQty ? .4 : 1 }}>
                    <Plus size={13}/>
                  </button>
                </div>
                <span style={{ flex:1, textAlign:'left', fontWeight:'700', color: qty > 0 ? '#d97706' : '#cbd5e1' }}>{lineTotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Tailor specific refund controls */}
        {sale.items.some(it => it.Category === 'Tailoring' || it.Category === 'خياطة' || sale.order_type === 'tailor') && (
            <div style={{ padding:'14px', background:'#f8fafc', borderRadius:'14px', border:'1px solid #e2e8f0', marginTop:'10px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:800, cursor:'pointer', marginBottom: isTailorCut ? '12px' : '0' }}>
                    <input type="checkbox" checked={isTailorCut} onChange={e => setIsTailorCut(e.target.checked)} style={{ width:'16px', height:'16px' }} />
                    تم قص القماش؟ (خصم تكلفة المواد)
                </label>
                {isTailorCut && (
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontSize:'12px', fontWeight:700, color:'#64748b' }}>مبلغ الخصم (ر.س):</span>
                        <input type="number" min="0" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} style={{ padding:'8px', borderRadius:'8px', border:'1px solid #cbd5e1', flex:1, fontSize:'14px' }} placeholder="مثال: 150" />
                    </div>
                )}
            </div>
        )}

        <div>
          <label style={{ ...lbl, marginBottom:'6px' }}>{t('history.modals.return_reason_ph')}</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('history.modals.return_reason_ph')}
            disabled={submitting}
            style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', textAlign:'right', boxSizing:'border-box' }} />
        </div>

        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'14px', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'4px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#92400e' }}>
            <span>المجموع الفرعي (غير شامل الضريبة)</span>
            <span>SAR {returnNet.toFixed(2)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#92400e' }}>
            <span>الضريبة ({(vatRate*100).toFixed(0)}%)</span>
            <span>SAR {returnVat.toFixed(2)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'900', fontSize:'16px', color:'#92400e', borderTop:'1px solid #fde68a', paddingTop:'6px', marginTop:'2px' }}>
            <span>إجمالي المرتجع</span>
            <span>SAR {returnGross.toFixed(2)}</span>
          </div>
          <p style={{ margin:'6px 0 0', fontSize:'10.5px', color:'#a16207' }}>
            سيتم إصدار إشعار دائن وإعادة الكميات المحددة أعلاه تلقائياً إلى المخزون.
          </p>
        </div>

        <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
          <button onClick={onClose} disabled={submitting}
            style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>
            {t('history.modals.cancel')}
          </button>
          <button onClick={handleConfirm} disabled={!hasSelection || submitting}
            style={{ flex:2, padding:'12px', background: (!hasSelection || submitting) ? '#fcd34d' : '#d97706', color:'white', border:'none', borderRadius:'12px', cursor: (!hasSelection || submitting) ? 'not-allowed' : 'pointer', fontWeight:'700', fontFamily:'inherit', opacity: (!hasSelection || submitting) ? .7 : 1 }}>
            {submitting ? 'جاري التنفيذ…' : t('history.modals.return_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
});
