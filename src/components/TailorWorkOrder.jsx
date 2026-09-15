import React from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   INLINE PRINT STYLES
   Injected once via a <style> tag inside the component.
   These are used when window.print() is called.
───────────────────────────────────────────────────────────────────────────── */
const PRINT_STYLES = `
@media print {
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }
  body * {
    visibility: hidden;
  }
  .tailor-work-order, .tailor-work-order * {
    visibility: visible;
  }
  .tailor-work-order {
    position: fixed;
    inset: 0;
    width: 210mm;
    margin: 0 auto;
    padding: 0;
    font-size: 11px;
    background: white !important;
    color: black !important;
  }
  .no-print {
    display: none !important;
  }
  .page-section {
    break-inside: avoid;
  }
}
`;

import { ThobeSilhouette, SirwalSilhouette, BishtSilhouette, ShirtSilhouette } from './GarmentIcons';

/* ─────────────────────────────────────────────────────────────────────────────
   CHECKBOX CELL — shows a checked or unchecked box for style selections
───────────────────────────────────────────────────────────────────────────── */
const CheckCell = ({ label, checked }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '10px', fontSize: '11px' }}>
    <span style={{
      display: 'inline-block',
      width: '13px', height: '13px',
      border: '1.5px solid #334155',
      borderRadius: '2px',
      backgroundColor: checked ? '#1e3a5f' : 'white',
      position: 'relative',
      flexShrink: 0,
    }}>
      {checked && (
        <svg viewBox="0 0 10 10" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
    <span>{label}</span>
  </span>
);

/* ─────────────────────────────────────────────────────────────────────────────
   MEASUREMENT CELL — compact value cell, shows dash if empty
───────────────────────────────────────────────────────────────────────────── */
const MCell = ({ value }) => (
  <td style={tdStyle}>
    <span style={{ fontWeight: '700', fontSize: '12px', color: value ? '#0f172a' : '#94a3b8' }}>
      {value ? `${value}` : '—'}
    </span>
    {value && <span style={{ fontSize: '9px', color: '#64748b', marginRight: '1px' }}>سم</span>}
  </td>
);

const MLabel = ({ children }) => (
  <td style={{ ...thStyle, background: '#e2e8f0' }}>{children}</td>
);

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED TABLE STYLES
───────────────────────────────────────────────────────────────────────────── */
const thStyle = {
  border: '1px solid #334155',
  padding: '6px 8px',
  textAlign: 'center',
  fontSize: '12px',
  fontWeight: '700',
  background: '#e2e8f0',
  color: '#0f172a',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  border: '1px solid #334155',
  padding: '6px 8px',
  textAlign: 'center',
  fontSize: '13px',
  minWidth: '45px',
  background: 'white',
  fontWeight: '500',
};

const sectionHeaderStyle = {
  background: '#1e3a5f',
  color: 'white',
  fontSize: '12px',
  fontWeight: '700',
  padding: '5px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: '3px 3px 0 0',
};

/* ─────────────────────────────────────────────────────────────────────────────
   THOBE / QAMEES SECTION
───────────────────────────────────────────────────────────────────────────── */
const ThobeSection = ({ item, index }) => {
  const m = item?.measurements || {};
  const cfg = item?.config || {};

  const collarOptions = [
    { value: 'classic', label: 'كلاسيك' },
    { value: 'mandarin', label: 'ماندرين' },
    { value: 'chanel', label: 'شانيل' },
    { value: 'band', label: 'بالطوق' },
    { value: 'double', label: 'مزدوج' },
  ];
  const cuffOptions = [
    { value: 'single', label: 'مفرد' },
    { value: 'double', label: 'مزدوج' },
    { value: 'french', label: 'فرنسي' },
    { value: 'plain', label: 'بدون كبك' },
  ];
  const pocketOptions = [
    { value: 'chest', label: 'جيب صدر' },
    { value: 'side', label: 'جانبية' },
    { value: 'both', label: 'صدر وجانب' },
    { value: 'none', label: 'بدون' },
  ];
  const buttonOptions = [
    { value: 'visible', label: 'ظاهرة' },
    { value: 'hidden', label: 'مخفية' },
  ];

  return (
    <div className="page-section" style={{ marginBottom: '14px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={sectionHeaderStyle}>
        <span style={{ fontSize: '14px' }}>①</span>
        <span>القميص / الثوب</span>
        {index > 0 && <span style={{ fontSize: '10px', opacity: 0.8 }}>— القطعة رقم {index + 1}</span>}
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#f8fafc', alignItems: 'flex-start' }}>
        {/* Silhouette */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px' }}>
          <ThobeSilhouette />
        </div>

        {/* Measurements */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Row 1 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
            <tbody>
              <tr>
                <MLabel>الطول</MLabel>
                <MCell value={m.length} />
                <MLabel>الكتف</MLabel>
                <MCell value={m.shoulder} />
                <MLabel>الرقبة</MLabel>
                <MCell value={m.neck} />
                <MLabel>وسع الصدر</MLabel>
                <MCell value={m.chest} />
                <MLabel>الوسط</MLabel>
                <MCell value={m.waist} />
              </tr>
              <tr>
                <MLabel>طول الكم</MLabel>
                <MCell value={m.sleeve} />
                <MLabel>وسع الكم</MLabel>
                <MCell value={m.hand_opening} />
                <MLabel>وسع الزند</MLabel>
                <MCell value={m.wrist} />
                <MLabel>طول الخلف</MLabel>
                <MCell value={m.hem} />
                <td style={{ ...tdStyle, background: '#f8fafc' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Style Selections */}
          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', marginLeft: '4px', minWidth: '60px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 2, display: 'inline-block'}}><path d="M4 6h16M4 12h16"/></svg> شكل الياقة:
              </span>
              {collarOptions.map(o => <CheckCell key={o.value} label={o.label} checked={cfg.collar === o.value} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', marginLeft: '4px', minWidth: '60px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 2, display: 'inline-block'}}><rect x="4" y="4" width="16" height="16" rx="2"/></svg> شكل الكبك:
              </span>
              {cuffOptions.map(o => <CheckCell key={o.value} label={o.label} checked={cfg.cuff === o.value} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', marginLeft: '4px', minWidth: '60px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 2, display: 'inline-block'}}><path d="M4 4h16v8a8 8 0 0 1-16 0z"/></svg> الجيوب:
              </span>
              {pocketOptions.map(o => <CheckCell key={o.value} label={o.label} checked={cfg.pocket === o.value} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', marginLeft: '4px', minWidth: '60px' }}>الأزرار:</span>
              {buttonOptions.map(o => <CheckCell key={o.value} label={o.label} checked={cfg.buttons === o.value} />)}
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '28px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>ملاحظات:</span>
            <span style={{ fontSize: '11px', color: '#0f172a', flex: 1, borderBottom: '1px dotted #94a3b8', minHeight: '16px', paddingBottom: '2px' }}>
              {item?.notes || ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   SIRWAL / BANTALON SECTION
───────────────────────────────────────────────────────────────────────────── */
const SirwalSection = ({ item, index }) => {
  const m = item?.measurements || {};

  return (
    <div className="page-section" style={{ marginBottom: '14px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ ...sectionHeaderStyle, background: '#1e3a5f' }}>
        <span style={{ fontSize: '14px' }}>②</span>
        <span>السروال / البنطلون</span>
        {index > 0 && <span style={{ fontSize: '10px', opacity: 0.8 }}>— القطعة رقم {index + 1}</span>}
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#f8fafc', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px' }}>
          <SirwalSilhouette />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <MLabel>الطول</MLabel>
                <MCell value={m.length} />
                <MLabel>الوسط</MLabel>
                <MCell value={m.waist || m.chest} />
                <MLabel>الورك</MLabel>
                <MCell value={m.shoulder} />
                <MLabel>الفخذ</MLabel>
                <MCell value={m.waist} />
                <MLabel>فتحة الرجل</MLabel>
                <MCell value={m.hem || m.wrist} />
              </tr>
              <tr>
                <MLabel>الركبة</MLabel>
                <MCell value={m.neck} />
                <MLabel>الحزام</MLabel>
                <MCell value={m.hand_opening} />
                <td style={{ ...tdStyle, background: '#f8fafc' }} colSpan={6}></td>
              </tr>
            </tbody>
          </table>

          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '28px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>ملاحظات:</span>
            <span style={{ fontSize: '11px', color: '#0f172a', flex: 1, borderBottom: '1px dotted #94a3b8', minHeight: '16px', paddingBottom: '2px' }}>
              {item?.notes || ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   BISHT / VEST SECTION
───────────────────────────────────────────────────────────────────────────── */
const BishtSection = ({ item, index }) => {
  const m = item?.measurements || {};

  return (
    <div className="page-section" style={{ marginBottom: '14px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ ...sectionHeaderStyle, background: '#1e3a5f' }}>
        <span style={{ fontSize: '14px' }}>③</span>
        <span>البشت / السديري</span>
        {index > 0 && <span style={{ fontSize: '10px', opacity: 0.8 }}>— القطعة رقم {index + 1}</span>}
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#f8fafc', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px' }}>
          <BishtSilhouette />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <MLabel>الطول</MLabel>
                <MCell value={m.length} />
                <MLabel>الكتف</MLabel>
                <MCell value={m.shoulder} />
                <MLabel>الرقبة</MLabel>
                <MCell value={m.neck} />
                <MLabel>الوسع</MLabel>
                <MCell value={m.chest} />
                <MLabel>الوسط</MLabel>
                <MCell value={m.waist} />
              </tr>
            </tbody>
          </table>

          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '28px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>ملاحظات:</span>
            <span style={{ fontSize: '11px', color: '#0f172a', flex: 1, borderBottom: '1px dotted #94a3b8', minHeight: '16px', paddingBottom: '2px' }}>
              {item?.notes || ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   SHIRT SECTION  (western shirt)
───────────────────────────────────────────────────────────────────────────── */
const ShirtSection = ({ item, index }) => {
  const m = item?.measurements || {};
  const cfg = item?.config || {};

  const collarOptions = [
    { value: 'classic', label: 'كلاسيك' },
    { value: 'mandarin', label: 'ماندرين' },
    { value: 'band', label: 'بالطوق' },
  ];
  const cuffOptions = [
    { value: 'single', label: 'مفرد' },
    { value: 'double', label: 'مزدوج' },
    { value: 'french', label: 'فرنسي' },
  ];

  return (
    <div className="page-section" style={{ marginBottom: '14px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ ...sectionHeaderStyle }}>
        <span style={{ fontSize: '14px' }}>①</span>
        <span>القميص</span>
        {index > 0 && <span style={{ fontSize: '10px', opacity: 0.8 }}>— القطعة رقم {index + 1}</span>}
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#f8fafc', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px' }}>
          <ShirtSilhouette />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <MLabel>الطول</MLabel>
                <MCell value={m.length} />
                <MLabel>الكتف</MLabel>
                <MCell value={m.shoulder} />
                <MLabel>الرقبة</MLabel>
                <MCell value={m.neck} />
                <MLabel>الصدر</MLabel>
                <MCell value={m.chest} />
                <MLabel>الوسط</MLabel>
                <MCell value={m.waist} />
              </tr>
              <tr>
                <MLabel>طول الكم</MLabel>
                <MCell value={m.sleeve} />
                <MLabel>وسع الزند</MLabel>
                <MCell value={m.wrist} />
                <MLabel>وسع الكم</MLabel>
                <MCell value={m.hand_opening} />
                <td style={{ ...tdStyle, background: '#f8fafc' }} colSpan={4}></td>
              </tr>
            </tbody>
          </table>

          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', marginLeft: '4px', minWidth: '60px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 2, display: 'inline-block'}}><path d="M4 6h16M4 12h16"/></svg> شكل الياقة:
              </span>
              {collarOptions.map(o => <CheckCell key={o.value} label={o.label} checked={cfg.collar === o.value} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', marginLeft: '4px', minWidth: '60px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 2, display: 'inline-block'}}><rect x="4" y="4" width="16" height="16" rx="2"/></svg> شكل الكبك:
              </span>
              {cuffOptions.map(o => <CheckCell key={o.value} label={o.label} checked={cfg.cuff === o.value} />)}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderTop: 'none', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '28px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>ملاحظات:</span>
            <span style={{ fontSize: '11px', color: '#0f172a', flex: 1, borderBottom: '1px dotted #94a3b8', minHeight: '16px', paddingBottom: '2px' }}>
              {item?.notes || ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const TailorWorkOrder = React.forwardRef(({ orderDetails, fabrics = [] }, ref) => {
  if (!orderDetails) return null;
  const { customer, items = [], invoiceNumber, date, deliveryDate, notes, subtotal, paid, balance } = orderDetails;

  return (
    <div ref={ref}>
      {/* Inject print styles once */}
      <style>{PRINT_STYLES}</style>

      {items.map((item, itemIndex) => {
        const type = item.garment_type || 'thobe';
        const isLastItem = itemIndex === items.length - 1;
        
        let fabricName = '';
        if (item.fabric_code) {
          if (item.fabric_code === 'BYOF') fabricName = 'خارجي (من العميل)';
          else {
            const fab = fabrics.find(f => f.ID == item.fabric_code);
            fabricName = fab ? fab.Name : item.fabric_code;
          }
        }
        const itemFabricCodes = fabricName ? [fabricName] : [];

        return (
          <div
            key={item.id || itemIndex}
            dir="rtl"
            className="tailor-work-order"
            style={{
              width: '100%',
              maxWidth: '210mm',
              margin: '0 auto',
              background: 'white',
              fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
              fontSize: '11px',
              color: '#0f172a',
              padding: '10px 12px',
              boxSizing: 'border-box',
              pageBreakAfter: isLastItem ? 'auto' : 'always',
              position: 'relative'
            }}
          >
            {/* ── HEADER ── */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2.5px solid #1e3a5f',
              paddingBottom: '8px',
              marginBottom: '10px',
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#1e3a5f', lineHeight: 1.2 }}>
                  ورقة عمل الخياط {items.length > 1 ? `(قطعة ${itemIndex + 1} من ${items.length})` : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Tailor Work Order — يُسلَّم للمعلم مع القماش
                </div>
              </div>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '15px', fontWeight: '900', fontFamily: 'monospace', color: '#1e3a5f', background: '#e0f2fe', border: '1.5px solid #0ea5e9', borderRadius: '4px', padding: '2px 8px' }}>
                  # {invoiceNumber}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>تاريخ الطلب: {date ? new Date(date).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA')}</div>
                {deliveryDate && (
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#b45309', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '3px', padding: '2px 6px' }}>
                    التسليم: {deliveryDate}
                  </div>
                )}
              </div>
            </div>

            {/* ── CUSTOMER + FABRIC INFO ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
              <tbody>
                <tr>
                  <td style={{ ...thStyle, background: '#1e3a5f', color: 'white', width: '80px' }}>اسم العميل</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{customer?.name || '—'}</td>
                  <td style={{ ...thStyle, background: '#1e3a5f', color: 'white', width: '70px' }}>الهاتف</td>
                  <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'monospace', fontSize: '12px' }} dir="ltr">{customer?.phone || '—'}</td>
                  <td style={{ ...thStyle, background: '#1e3a5f', color: 'white', width: '60px' }}>القماش</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: '11px' }}>
                    {itemFabricCodes.length > 0 ? itemFabricCodes.join('، ') : 'من العميل / غير محدد'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── GARMENT SECTION ── */}
            {type === 'thobe' || type === 'custom' ? <ThobeSection item={item} index={itemIndex} /> :
             type === 'sirwal' ? <SirwalSection item={item} index={itemIndex} /> :
             type === 'bisht' ? <BishtSection item={item} index={itemIndex} /> :
             type === 'shirt' ? <ShirtSection item={item} index={itemIndex} /> :
             (
               <div className="page-section" style={{ marginBottom: '14px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
                 <div style={sectionHeaderStyle}>
                   <span>طلب تعديل / إصلاح</span>
                 </div>
                 <div style={{ padding: '8px 10px', background: '#f8fafc' }}>
                   <div style={{ fontSize: '11px', color: '#0f172a', lineHeight: '1.6' }}>
                     {item.notes || 'يرجى مراجعة ملاحظات المعلم'}
                   </div>
                 </div>
               </div>
             )}

            {/* ── GENERAL NOTES + FABRIC NAMES ── */}
            <div className="page-section" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1, border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ ...sectionHeaderStyle, background: '#475569', borderRadius: '3px 3px 0 0', fontSize: '11px', padding: '4px 8px' }}>اسم القماش</div>
                <div style={{ padding: '6px 8px', background: 'white', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569' }}>{n}—</span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #94a3b8', minHeight: '16px', fontSize: '11px', color: '#0f172a', paddingBottom: '2px' }}>
                        {n === 1 && itemFabricCodes.length > 0 ? itemFabricCodes[0] : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 2, border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ ...sectionHeaderStyle, background: '#475569', borderRadius: '3px 3px 0 0', fontSize: '11px', padding: '4px 8px' }}>ملاحظات عامة</div>
                <div style={{ padding: '6px 8px', background: 'white', minHeight: '60px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569' }}>{n}—</span>
                      <span style={{ flex: 1, borderBottom: '1px dotted #94a3b8', minHeight: '16px', fontSize: '11px', color: '#0f172a', paddingBottom: '2px' }}>
                        {n === 1 && notes ? notes : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SIGNATURES ── */}
            <div className="page-section" style={{ display: 'flex', gap: '0', marginBottom: '12px', border: '1.5px solid #334155', borderRadius: '4px', overflow: 'hidden' }}>
              {['المفصل', 'الخياط', 'المدقق'].map((title, i) => (
                <div key={i} style={{ flex: 1, padding: '6px 8px', background: i % 2 === 0 ? '#f8fafc' : 'white', borderRight: i < 2 ? '1px solid #334155' : 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569' }}>{title}</span>
                  <div style={{ borderBottom: '1px dotted #64748b', minHeight: '20px' }} />
                </div>
              ))}
            </div>

            {isLastItem && (
              <div className="no-print" style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                اضغط "طباعة" لطباعة أوراق العمل وتسليمها للخياط مع القماش
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default TailorWorkOrder;
