import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Download, RefreshCw, Search, RotateCcw, ChevronDown, ChevronUp, FileText, ShoppingBag, Printer } from 'lucide-react';
import QRCode from '../utils/qr-gen';
import ExportButton from '../components/ExportButton';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const statusLabel = (s) => {
  if (s === 'void')   return { label:'ملغى',    bg:'#fef2f2', col:'#ef4444' };
  if (s === 'credit') return { label:'آجل',     bg:'#fef3c7', col:'#d97706' };
  return                     { label:'مكتمل',  bg:'#ecfdf5', col:'#10b981' };
};

export default function SalesHistory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales');
  const [quotes, setQuotes] = useState([]);
  
  const [range, setRange]     = useState({ startDate: monthStart(), endDate: today() });
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sales, setSales]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [voidModal, setVoidModal] = useState(null); // {invoice}
  const [voidReason, setVoidReason] = useState('');
  const [returnModal, setReturnModal] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});
  const [returnReason, setReturnReason] = useState('ارجاع للعميل');
  const [debitModal, setDebitModal] = useState(null);
  const [debitAmount, setDebitAmount] = useState('');
  const [debitReason, setDebitReason] = useState('');
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
        status: statusFilter !== 'all' ? statusFilter : undefined,
        ...overrides
      };
      const [data, qData] = await Promise.all([
        window.api.getSalesHistory(filters),
        window.api.getHeldOrders ? window.api.getHeldOrders() : Promise.resolve([])
      ]);
      setSales(Array.isArray(data) ? data : []);
      setQuotes((Array.isArray(qData) ? qData : []).filter(o => o.order_type === 'quote'));
    } catch (e) { setSales([]); setQuotes([]); }
    setLoading(false);
  };

  const totalRevenue = sales.filter(s => s.status !== 'void').reduce((sum, s) => sum + parseFloat(s.total||0), 0);
  const vatRate = parseFloat(settings.vat_rate || '0.15');
  const totalVAT = totalRevenue * vatRate / (1 + vatRate);
  const voidCount = sales.filter(s => s.status === 'void').length;

  const handleVoid = async () => {
    if (!voidModal) return;
    try {
      await window.api.voidSale({ invoiceId: voidModal, reason: voidReason || 'طلب المدير' });
      setVoidModal(null);
      setVoidReason('');
      fetchSales();
    } catch (e) { alert('خطأ: ' + e.message); }
  };

  const openReturn = (sale) => {
    try {
      const items = JSON.parse(sale.items_json || '[]');
      setReturnModal({ ...sale, items });
      const initQtys = {};
      items.forEach((it, i) => initQtys[i] = 0);
      setReturnQtys(initQtys);
      setReturnReason('ارجاع للعميل');
    } catch { alert('لا يمكن قراءة أصناف الفاتورة'); }
  };

  const handleReturn = async () => {
    if (!returnModal) return;
    try {
      let returnTotal = 0;
      const returnItems = [];
      returnModal.items.forEach((it, i) => {
        const qty = parseFloat(returnQtys[i] || 0);
        if (qty > 0) {
          returnTotal += (qty * parseFloat(it.Price));
          returnItems.push({ ...it, Qty: -qty }); // negative for credit note
        }
      });
      if (returnItems.length === 0) return alert('يجب تحديد صنف واحد على الأقل للاسترجاع');

      const vatAmt = returnTotal * vatRate / (1 + vatRate);
      const cnNumber = `CN-${returnModal.invoice}-${Date.now().toString().slice(-4)}`;
      const payload = {
        invoice: cnNumber,
        items: returnItems,
        subtotal: -(returnTotal - vatAmt),
        tax: -vatAmt,
        total: -returnTotal,
        payment: returnModal.payment,
        customer_id: returnModal.customer_id,
        note: `إشعار دائن (استرجاع) للفاتورة الأصلية #${returnModal.invoice} - ${returnReason}`,
        status: 'credit' // Flag as credit note
      };

      await window.api.saveSale(payload);
      setReturnModal(null);
      fetchSales();
    } catch (e) { alert('خطأ في إرجاع الفاتورة: ' + e.message); }
  };

  const handleDebitNote = async () => {
    if (!debitModal) return;
    const amount = parseFloat(debitAmount);
    if (!amount || amount <= 0) return alert('يرجى إدخال مبلغ صحيح');
    try {
      await window.api.invoke('db:createDebitNote', { invoiceId: debitModal.invoice, amount, reason: debitReason });
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

  const printReceipt = async (sale, forceWidth) => {
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

    const qrData = await window.api?.getZatcaTLV?.({
      invoice: sale.invoice,
      seller: bizAr,
      vatNo: vatNum,
      timestamp: new Date(sale.sale_date).toISOString(),
      total: gr.toFixed(2),
      vatAmt: vatAmt.toFixed(2)
    });
    
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
                              تاريخ الإصدار (Issue Date): <span dir="ltr">${new Date(sale.sale_date).toLocaleString('ar-SA')}</span>
                          </div>
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
                      <div class="totals-row">
                          <span>طريقة الدفع (Payment Method)</span>
                          <strong>${sale.payment || '—'}</strong>
                      </div>
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
          </div>

          <div style="text-align:center; font-weight:800; font-size: 14px; border-top:2px dashed #000; border-bottom:2px dashed #000; padding:6px 0; margin-bottom:10px; color: #000;">
              ${(sale.customer_tax_id || sale.customerTaxId) ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}
          </div>

          <div class="info-line"><span>رقم الفاتورة:</span><span>${sale.invoice}</span></div>
          <div class="info-line"><span>التاريخ:</span><span dir="ltr">${new Date(sale.sale_date).toLocaleString('ar-SA')}</span></div>
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
              <div class="info-line"><span>المدفوع:</span><span>${parseFloat(sale.paid || sale.total).toFixed(2)} SAR</span></div>
              ${parseFloat(sale.change||0) > 0 ? `<div class="info-line"><span>الباقي:</span><span>${parseFloat(sale.change).toFixed(2)} SAR</span></div>` : ''}
          </div>

          <div class="qr-box">
              <img src="${qrUrl}" style="width:100%; height:100%;">
          </div>

          <div class="footer">
              <p style="margin:0; font-weight: 700;">${footer}</p>
              <div style="margin-top:15px; font-size:10px; color:#000; border-top:1px dashed #000; padding-top:8px;">
                  Developed by البصمة الذكية<br>
                  ea.gaber10@gmail.com
              </div>
          </div>
          
          <div style="height: 35px;"></div>
          </div>
      </body></html>`;
    }

    const win = window.open('', '_blank', `width=${width === 'A4' ? 900 : 450},height=${width === 'A4' ? 1100 : 650}`);
    if (win) { 
      win.document.write(html); 
      win.document.close(); 
      win.onload = () => { 
        setTimeout(() => { win.print(); win.close(); }, 500); 
      }; 
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

    const win = window.open('', '_blank', `width=${width === 'A4' ? 900 : 450},height=${width === 'A4' ? 1100 : 650}`);
    if (win) { win.document.write(html); win.document.close(); win.onload = () => { setTimeout(() => { win.print(); win.close(); }, 500); }; }
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
    const win = window.open('', '_blank', 'width=1100,height=1300');
    if(win){ win.document.write(html); win.document.close(); setTimeout(()=>win.print(),800); }
  };




  return (
    <AppLayout title="سجل المبيعات والفواتير">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'12px', borderBottom:'2px solid #e2e8f0', paddingBottom:'2px' }}>
          <button onClick={() => setActiveTab('sales')}
            style={{ padding:'12px 24px', background:'none', border:'none', borderBottom: activeTab === 'sales' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'sales' ? '#3b82f6' : '#64748b', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'8px' }}>
            <FileText size={18}/> المبيعات
          </button>
          <button onClick={() => setActiveTab('quotes')}
            style={{ padding:'12px 24px', background:'none', border:'none', borderBottom: activeTab === 'quotes' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'quotes' ? '#3b82f6' : '#64748b', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'8px' }}>
            <ShoppingBag size={18}/> عروض الأسعار
            {quotes.length > 0 && <span style={{ background:'#3b82f6', color:'white', borderRadius:'99px', padding:'2px 8px', fontSize:'11px' }}>{quotes.length}</span>}
          </button>
        </div>

        {activeTab === 'sales' && (
          <>
            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'16px' }}>
          {[
            { label:'إجمالي المبيعات',    val:`SAR ${totalRevenue.toFixed(2)}`, icon:'💰', col:'#3b82f6' },
            { label:'ضريبة القيمة المضافة', val:`SAR ${totalVAT.toFixed(2)}`,     icon:'🧾', col:'#8b5cf6' },
            { label:'عدد الفواتير',       val: sales.filter(s=>s.status!=='void').length, icon:'📋', col:'#10b981' },
            { label:'فواتير ملغاة',       val: voidCount,                         icon:'❌', col:'#ef4444' },
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
            <label style={lbl}>من</label>
            <input type="date" value={range.startDate} onChange={e => setRange(r => ({ ...r, startDate: e.target.value }))} style={dateInp} />
          </div>
          <div>
            <label style={lbl}>إلى</label>
            <input type="date" value={range.endDate} onChange={e => setRange(r => ({ ...r, endDate: e.target.value }))} style={dateInp} />
          </div>
          <div style={{ position:'relative' }}>
            <Search size={15} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="رقم الفاتورة..."
              style={{ ...dateInp, paddingRight:'34px' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={dateInp}>
            <option value="all">كل الحالات</option>
            <option value="paid">مكتمل</option>
            <option value="credit">آجل</option>
            <option value="void">ملغى</option>
          </select>
          <button onClick={() => fetchSales()} className="btn btn-primary" style={{ padding:'11px 20px' }}>
            <RefreshCw size={15}/> تطبيق
          </button>
          <button onClick={exportCSV} style={{ padding:'11px 16px', background:'#f0fdf4', border:'1px solid #a7f3d0', borderRadius:'12px', color:'#059669', cursor:'pointer', fontWeight:'700', fontFamily:'inherit', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}>
            <Download size={14}/> تصدير CSV
          </button>
          <ExportButton
            format="pdf"
            label="تصدير PDF"
            title={`تقرير المبيعات — ${range.startDate} إلى ${range.endDate}`}
            subtitle={`${range.startDate} — ${range.endDate}`}
            headers={['رقم الفاتورة','التاريخ','العميل','طريقة الدفع','الإجمالي (ريال)','الضريبة (ريال)','الحالة']}
            rows={sales.map(s => [
              s.invoice,
              (s.sale_date||'').split('T')[0],
              s.customer_name||'عميل عام',
              s.payment||'—',
              parseFloat(s.total||0).toFixed(2),
              parseFloat(s.tax||(s.total*vatRate/(1+vatRate))||0).toFixed(2),
              s.status==='void'?'ملغية':s.status==='credit'?'مرتجع':'مدفوعة'
            ])}
            summaryRows={[
              {label:'عدد الفواتير', value: sales.filter(s=>s.status!=='void').length},
              {label:'إجمالي المبيعات (ريال)', value: totalRevenue.toFixed(2)},
              {label:'إجمالي الضريبة (ريال)', value: totalVAT.toFixed(2)},
            ]}
            filename={`مبيعات-${range.startDate}-${range.endDate}.pdf`}
          />
          <ExportButton
            format="excel"
            label="تصدير Excel"
            title={`تقرير المبيعات`}
            headers={['رقم الفاتورة','التاريخ','العميل','طريقة الدفع','الإجمالي','الضريبة','الحالة']}
            rows={sales.map(s => [
              s.invoice,
              (s.sale_date||'').split('T')[0],
              s.customer_name||'عميل عام',
              s.payment||'—',
              parseFloat(s.total||0).toFixed(2),
              parseFloat(s.tax||(s.total*vatRate/(1+vatRate))||0).toFixed(2),
              s.status==='void'?'ملغية':s.status==='credit'?'مرتجع':'مدفوعة'
            ])}
            filename={`مبيعات-${range.startDate}-${range.endDate}.xlsx`}
          />
        </div>

        {/* Table */}
        <div style={{ background:'white', borderRadius:'20px', border:'1px solid #f1f5f9', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
            <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
              <tr>
                {['','رقم الفاتورة','التاريخ','العميل','نوع الدفع','الإجمالي','الضريبة','الحالة','إجراءات'].map(h => (
                  <th key={h} style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>
                  <RefreshCw size={20} style={{ animation:'spin 1s linear infinite' }}/> جاري التحميل...
                </td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.3 }}>📋</div>
                  لا توجد فواتير في هذه الفترة
                </td></tr>
              ) : sales.map((s, i) => {
                const st = statusLabel(s.status);
                const vatAmt = parseFloat(s.tax || s.total * vatRate / (1 + vatRate));
                const items = (() => { try { return JSON.parse(s.items_json || '[]'); } catch { return []; } })();
                return [
                  <tr key={s.invoice} style={{ borderBottom:'1px solid #f8fafc', background: s.status==='void' ? '#fefefe' : 'transparent', opacity: s.status==='void' ? .6 : 1 }}>
                    <td style={{ padding:'12px 14px' }}>
                      <button onClick={() => setExpanded(expanded===i ? null : i)}
                        style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', display:'flex' }}>
                        {expanded===i ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    </td>
                    <td style={{ padding:'12px 14px', fontFamily:'monospace', fontSize:'13px', color:'#3b82f6', fontWeight:'700' }}>
                      #{s.invoice}
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:'12px', color:'#64748b' }}>
                      {s.sale_date ? new Date(s.sale_date).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                    <td style={{ padding:'12px 14px', fontSize:'13px' }}>{s.customer_name || 'عميل عام'}</td>
                    <td style={{ padding:'12px 14px', fontSize:'12px', color:'#64748b' }}>{s.payment || '—'}</td>
                    <td style={{ padding:'12px 14px', fontWeight:'700', fontSize:'14px' }}>SAR {parseFloat(s.total||0).toFixed(2)}</td>
                    <td style={{ padding:'12px 14px', fontSize:'12px', color:'#8b5cf6' }}>SAR {vatAmt.toFixed(2)}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <span style={{ background:st.bg, color:st.col, padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:'700' }}>{st.label}</span>
                    </td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => downloadXML(s)} title="تحميل XML للـ ZATCA"
                          style={{ padding:'6px 10px', background:'#eff6ff', border:'none', color:'#3b82f6', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                          <FileText size={13}/> XML
                        </button>
                        {s.status !== 'void' && s.status !== 'credit' && (
                          <>
                            <button onClick={() => printReceipt(s, 'A4')} title="طباعة A4"
                              style={{ padding:'6px 10px', background:'#0f172a', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Printer size={13}/> A4
                            </button>
                            <button onClick={() => printReceipt(s, '80')} title="طباعة حراري 80مم"
                              style={{ padding:'6px 10px', background:'#2563eb', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Printer size={13}/> حراري
                            </button>
                          </>
                        )}
                        {s.status === 'credit' && (
                          <>
                            <button onClick={() => printCreditNote(s, 'A4')} title="طباعة الإشعار الدائن A4"
                              style={{ padding:'6px 10px', background:'#92400e', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Printer size={13}/> A4 إشعار
                            </button>
                            <button onClick={() => printCreditNote(s, '80')} title="طباعة الإشعار الدائن حراري"
                              style={{ padding:'6px 10px', background:'#d97706', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'11px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Printer size={13}/> حراري إشعار
                            </button>
                          </>
                        )}
                        {s.status !== 'void' && s.status !== 'credit' && parseFloat(s.total) > 0 && (
                          <button onClick={() => openReturn(s)} title="إرجاع (إشعار دائن)"
                            style={{ padding:'6px 8px', background:'#fef3c7', border:'none', color:'#d97706', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit', fontSize:'12px', fontWeight:'700' }}>
                            إرجاع
                          </button>
                        )}
                        {s.customer_tax_id && s.status !== 'void' && (
                          <button onClick={() => setDebitModal({ invoice: s.invoice, customer_tax_id: s.customer_tax_id })}
                            style={{ padding:'6px 12px', background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                            📄 إشعار مدين
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
                            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'8px' }}>الأصناف</div>
                            {items.map((it, j) => (
                              <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px dashed #f1f5f9', fontSize:'13px' }}>
                                <span>{it.Name} × {it.Qty}</span>
                                <span style={{ fontWeight:'700' }}>SAR {(it.Price * it.Qty).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ minWidth:'180px' }}>
                            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'8px' }}>ملخص</div>
                            <div style={{ fontSize:'12px', display:'flex', flexDirection:'column', gap:'4px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', gap:'20px' }}><span style={{ color:'#94a3b8' }}>الصافي:</span><span>SAR {(parseFloat(s.total)-vatAmt).toFixed(2)}</span></div>
                              <div style={{ display:'flex', justifyContent:'space-between', gap:'20px' }}><span style={{ color:'#94a3b8' }}>الضريبة:</span><span>SAR {vatAmt.toFixed(2)}</span></div>
                              {parseFloat(s.discount||0)>0 && <div style={{ display:'flex', justifyContent:'space-between', gap:'20px' }}><span style={{ color:'#94a3b8' }}>الخصم:</span><span style={{ color:'#10b981' }}>- SAR {parseFloat(s.discount).toFixed(2)}</span></div>}
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
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>العنوان</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>التاريخ</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>ملاحظات</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>الإجمالي التقديري</th>
                  <th style={{ padding:'13px 14px', fontSize:'11px', color:'#94a3b8', fontWeight:'700' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>جاري التحميل...</td></tr>
                ) : quotes.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>لا توجد عروض أسعار محفوظة</td></tr>
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
                            تحويل إلى فاتورة مبيعات
                          </button>
                          <button onClick={() => printQuote(q)}
                            style={{ padding:'6px 12px', background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit' }}>
                            🖨️ طباعة العرض
                          </button>
                          <button onClick={async () => {
                            if(confirm('هل أنت متأكد من حذف عرض السعر؟')) {
                              await window.api.deleteHeldOrder(q.id);
                              fetchSales();
                            }
                          }}
                            style={{ padding:'6px 12px', background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit' }}>
                            حذف
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

      {/* Void confirmation modal */}
      {voidModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.target===e.currentTarget && setVoidModal(null)}>
          <div style={{ background:'white', borderRadius:'22px', padding:'32px', maxWidth:'420px', width:'95%', textAlign:'center' }} dir="rtl">
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚠️</div>
            <h3 style={{ fontWeight:'800', marginBottom:'8px' }}>إلغاء الفاتورة #{voidModal}</h3>
            <p style={{ color:'#ef4444', fontSize:'13px', marginBottom:'20px', fontWeight:'700' }}>
              ملاحظة: الإلغاء يعكس القيود بالكامل. للإرجاع النظامي بهيئة الزكاة والدخل، الرجاء استخدام خيار (إشعار دائن/إرجاع).
            </p>
            <input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="سبب الإلغاء الشامل..."
              style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', marginBottom:'16px', textAlign:'right', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button onClick={() => setVoidModal(null)} style={{ padding:'12px 24px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>رجوع</button>
              <button onClick={handleVoid} style={{ padding:'12px 24px', background:'#ef4444', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>إلغاء الفاتورة</button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note (Return) Modal */}
      {returnModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.target===e.currentTarget && setReturnModal(null)}>
          <div style={{ background:'white', borderRadius:'22px', padding:'32px', maxWidth:'500px', width:'95%', maxHeight:'85vh', overflowY:'auto' }} dir="rtl">
            <h3 style={{ fontWeight:'800', marginBottom:'6px', fontSize:'18px' }}>إشعار دائن (إرجاع)</h3>
            <p style={{ color:'#64748b', fontSize:'12px', marginBottom:'24px' }}>فاتورة أصلية: #{returnModal.invoice}</p>
            
            <div style={{ marginBottom:'20px', display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', paddingBottom:'4px', borderBottom:'1px solid #f1f5f9', display:'flex' }}>
                <span style={{ flex:2 }}>المنتج</span>
                <span style={{ flex:1, textAlign:'center' }}>الكمية المشتراة</span>
                <span style={{ flex:1, textAlign:'center' }}>كمية الإرجاع</span>
              </div>
              {returnModal.items.map((it, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', fontSize:'13px' }}>
                  <span style={{ flex:2, fontWeight:'600' }}>{it.Name}</span>
                  <span style={{ flex:1, textAlign:'center', color:'#64748b' }}>{it.Qty}</span>
                  <div style={{ flex:1, textAlign:'center' }}>
                    <input type="number" min="0" max={it.Qty} step="any" value={returnQtys[i]||''} 
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        if(val > it.Qty) return;
                        setReturnQtys({...returnQtys, [i]: val});
                      }}
                      style={{ width:'60px', padding:'6px', textAlign:'center', borderRadius:'8px', border:'1px solid #e2e8f0' }} />
                  </div>
                </div>
              ))}
            </div>

            <input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="سبب الإرجاع..."
              style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', marginBottom:'24px', textAlign:'right', boxSizing:'border-box' }} />
            
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button onClick={() => setReturnModal(null)} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>إلغاء</button>
              <button onClick={handleReturn} style={{ flex:2, padding:'12px', background:'#d97706', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>إصدار الإشعار الدائن</button>
            </div>
          </div>
        </div>
      )}

      {/* Debit Note Modal */}
      {debitModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} dir="rtl">
          <div style={{ background:'white', borderRadius:'20px', padding:'32px', width:'420px', maxWidth:'90vw' }}>
            <h3 style={{ fontWeight:'900', fontSize:'18px', marginBottom:'20px' }}>📄 إشعار مدين — {debitModal.invoice}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:'700', color:'#475569', display:'block', marginBottom:'6px' }}>المبلغ (SAR شامل الضريبة)</label>
                <input type="number" value={debitAmount} onChange={e => setDebitAmount(e.target.value)} placeholder="0.00" style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'15px', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:'700', color:'#475569', display:'block', marginBottom:'6px' }}>السبب</label>
                <input value={debitReason} onChange={e => setDebitReason(e.target.value)} placeholder="مثال: رسوم إضافية..." style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'13px', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', marginTop:'24px' }}>
              <button onClick={handleDebitNote} style={{ flex:2, padding:'12px', background:'#f59e0b', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'800', fontSize:'13px' }}>إصدار الإشعار</button>
              <button onClick={() => { setDebitModal(null); setDebitAmount(''); setDebitReason(''); }} style={{ flex:1, padding:'12px', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'5px' };
const dateInp = { padding:'10px 12px', borderRadius:'11px', border:'1px solid #e2e8f0', fontSize:'13px', outline:'none', fontFamily:'inherit', background:'white', cursor:'pointer' };
