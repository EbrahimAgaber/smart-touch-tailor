import { generateBarcodeSVG } from './barcodeSvg';

/**
 * tailorPrintAndShare.js
 * Comprehensive Printing & WhatsApp Sharing Utility for Master Tailors (Mulams).
 * Provides reliable A4/Thermal printing and formatted WhatsApp sharing for work orders and measurements.
 */

// Format phone number to international WhatsApp format (e.g., 05xxxxxxxx -> 9665xxxxxxxx)
export function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('05')) return '966' + digits.slice(1);
  if (digits.startsWith('5') && digits.length === 9) return '966' + digits;
  return digits;
}

/**
 * Generate formatted WhatsApp message text for a Tailor Work Order
 */
export function generateTailorWhatsAppText(orderDetails, fabrics = [], settings = {}) {
  if (!orderDetails) return '';
  const { customer, items = [], invoiceNumber, date, deliveryDate, notes, subtotal, paid, balance } = orderDetails;
  const shopName = settings.business_name_ar || 'محل الخياطة';
  const shopPhone = settings.phone || settings.whatsapp || '';

  const orderDateStr = date ? new Date(date).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA');
  
  let msg = `*أمر تشغيل خياطة وتفصيل* ✂️\n`;
  msg += `*${shopName}*\n`;
  msg += `رقم الطلب: *#INV-${invoiceNumber || '—'}*\n`;
  msg += `─────────────────\n`;
  msg += `👤 *العميل:* ${customer?.name || 'عميل نقدي'}\n`;
  if (customer?.phone) msg += `📞 *جوال العميل:* ${customer.phone}\n`;
  msg += `📅 *تاريخ الطلب:* ${orderDateStr}\n`;
  if (deliveryDate) msg += `🚚 *موعد التسليم المتفق:* ${deliveryDate}\n`;
  msg += `─────────────────\n`;

  items.forEach((item, idx) => {
    const garmentTitle = item.title || item.garment_name || (item.garment_type === 'thobe' ? 'ثوب سعودي' : item.garment_type || 'قطعة تفصيل');
    let fabricName = 'من العميل / غير محدد';
    if (item.fabric_code) {
      if (item.fabric_code === 'BYOF') fabricName = 'قماش من العميل';
      else {
        const fab = fabrics.find(f => f.ID == item.fabric_code || f.id == item.fabric_code);
        fabricName = fab ? fab.Name : item.fabric_code;
      }
    }

    msg += `\n*القطعة (${idx + 1}):* ${garmentTitle} (الكمية: ${item.quantity || 1})\n`;
    msg += `🧵 *القماش:* ${fabricName}\n`;

    // Measurements
    const m = item.measurements || {};
    const hasMeasurements = Object.values(m).some(v => v !== undefined && v !== null && v !== '');
    if (hasMeasurements) {
      msg += `\n📏 *جدول المقاسات:*\n`;
      const labels = {
        length: 'الطول',
        shoulder: 'الكتف',
        chest: 'الصدر',
        waist: 'الخصر',
        sleeve: 'طول اليد',
        sleeve_width: 'وسع اليد',
        neck: 'الرقبة',
        cuff: 'الكبك / المعصم',
        pocket: 'الجيب',
        bottom: 'الوسع السفلي',
        inseam: 'الخط الداخلي',
        outseam: 'طول السروال',
        thigh: 'وسع الفخذ',
        opening: 'الفتحة السفلية'
      };

      for (const [key, label] of Object.entries(labels)) {
        if (m[key]) {
          msg += `• ${label}: ${m[key]}\n`;
        }
      }
    }

    // Styles & Details
    const s = item.styles || {};
    const styleParts = [];
    if (s.collar) styleParts.push(`الياقة: ${s.collar}`);
    if (s.sleeve) styleParts.push(`الأكمام: ${s.sleeve}`);
    if (s.cuff) styleParts.push(`الكبك: ${s.cuff}`);
    if (s.pocket) styleParts.push(`الجيب: ${s.pocket}`);
    if (s.placket) styleParts.push(`الفتحة: ${s.placket}`);
    if (s.stitching) styleParts.push(`الخياطة: ${s.stitching}`);

    if (styleParts.length > 0) {
      msg += `\n🪡 *المواصفات والموديل:*\n${styleParts.map(sp => `• ${sp}`).join('\n')}\n`;
    }

    if (item.notes) {
      msg += `\n📝 *ملاحظات القطعة:* ${item.notes}\n`;
    }
  });

  if (notes) {
    msg += `\n📌 *ملاحظات عامة للمعلم:* ${notes}\n`;
  }

  // Financial summary
  const tot = parseFloat(subtotal || orderDetails.total || 0);
  const pd = parseFloat(paid || 0);
  const bal = parseFloat(balance !== undefined ? balance : (tot - pd));

  msg += `\n─────────────────\n`;
  msg += `💰 *الملخص المالي:*\n`;
  msg += `• الإجمالي: ${tot.toFixed(2)} ر.س\n`;
  msg += `• المدفوع / العربون: ${pd.toFixed(2)} ر.س\n`;
  msg += `• المتبقي عند الاستلام: ${bal.toFixed(2)} ر.س\n`;
  if (shopPhone) msg += `\nللتواصل والاستفسار: ${shopPhone}\n`;

  return msg;
}

/**
 * Generate formatted WhatsApp message for Measurement Profile Sharing
 */
export function generateMeasurementWhatsAppText(customer, profile, unit = 'in', settings = {}) {
  const shopName = settings.business_name_ar || 'محل الخياطة';
  let msg = `*بطاقة مقاسات تفصيل* 📐\n`;
  msg += `*${shopName}*\n`;
  msg += `👤 *العميل:* ${customer?.name || 'عميل'}\n`;
  if (customer?.phone) msg += `📞 *الجوال:* ${customer.phone}\n`;
  if (profile?.profile_name) msg += `🔖 *اسم المقاس:* ${profile.profile_name}\n`;
  msg += `📅 *تاريخ التسجيل:* ${new Date().toLocaleDateString('ar-SA')}\n`;
  msg += `الوحدة: ${unit === 'cm' ? 'سنتيمتر (سم)' : 'إنش (بوصة)'}\n`;
  msg += `─────────────────\n`;

  const m = profile?.measurements || {};
  const labels = {
    length: 'الطول',
    shoulder: 'الكتف',
    chest: 'الصدر',
    waist: 'الخصر',
    sleeve: 'طول اليد',
    sleeve_width: 'وسع اليد',
    neck: 'الرقبة',
    cuff: 'الكبك / المعصم',
    pocket: 'الجيب',
    bottom: 'الوسع السفلي',
    inseam: 'الخط الداخلي',
    outseam: 'طول السروال',
    thigh: 'وسع الفخذ',
    opening: 'الفتحة السفلية'
  };

  let count = 0;
  for (const [key, label] of Object.entries(labels)) {
    if (m[key]) {
      msg += `• ${label}: *${m[key]}* ${unit}\n`;
      count++;
    }
  }

  if (count === 0) {
    msg += `(لا توجد قياسات مسجلة بعد)\n`;
  }

  if (profile?.notes) {
    msg += `\n📝 *ملاحظات خاصة:* ${profile.notes}\n`;
  }

  return msg;
}

/**
 * Share WhatsApp message directly via web/app link and copy to clipboard
 */
export async function shareViaWhatsAppDirect({ phone = '', message = '' }) {
  // Always copy to clipboard as seamless backup
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }

  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  // Open WhatsApp in new window/tab safely
  const win = window.open(url, '_blank');
  if (!win) {
    // If popup blocked, create anchor and click
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Generate full standalone HTML for A4 Tailor Work Order printing
 */
export function generateWorkOrderA4HTML(orderDetails, fabrics = [], settings = {}) {
  if (!orderDetails) return '';
  const { customer, items = [], invoiceNumber, date, deliveryDate, notes, subtotal, paid, balance } = orderDetails;
  const shopName = settings.business_name_ar || 'محل الخياطة';
  const shopPhone = settings.phone || settings.whatsapp || '';
  const orderDateStr = date ? new Date(date).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA');

  const tot = parseFloat(subtotal || orderDetails.total || 0).toFixed(2);
  const pd = parseFloat(paid || 0).toFixed(2);
  const bal = parseFloat(balance !== undefined ? balance : (tot - pd)).toFixed(2);

  const itemsHtml = items.map((item, idx) => {
    let fabricName = 'قماش من العميل';
    if (item.fabric_code && item.fabric_code !== 'BYOF') {
      const fab = fabrics.find(f => f.ID == item.fabric_code || f.id == item.fabric_code);
      fabricName = fab ? fab.Name : item.fabric_code;
    }
    const garmentTitle = item.title || item.garment_name || (item.garment_type === 'thobe' ? 'ثوب سعودي' : item.garment_type || 'قطعة تفصيل');
    const m = item.measurements || {};
    const s = item.styles || {};

    return `
      <div style="border: 2px solid #0f172a; border-radius: 8px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid;">
        <div style="background: #1e293b; color: white; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 15px;">القطعة (${idx + 1} من ${items.length}): ${garmentTitle}</strong>
          <span style="font-size: 13px; font-weight: 700;">الكمية: ${item.quantity || 1}</span>
        </div>

        <div style="padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; display: flex; gap: 20px; font-size: 13px;">
          <div><strong>القماش:</strong> ${fabricName}</div>
          ${item.notes ? `<div><strong>ملاحظة القطعة:</strong> ${item.notes}</div>` : ''}
        </div>

        <!-- Measurements Grid -->
        <div style="padding: 12px 14px;">
          <div style="font-weight: 800; color: #1e3a8a; font-size: 13px; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
            جدول المقاسات التفصيلي:
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #94a3b8;">
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الطول</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الكتف</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الصدر</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الخصر</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">طول اليد</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">وسع اليد</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الرقبة</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الوسع السفلي</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1;">الجيب</th>
              </tr>
            </thead>
            <tbody>
              <tr style="font-weight: 800; font-size: 14px; color: #0f172a;">
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.length || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.shoulder || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.chest || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.waist || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.sleeve || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.sleeve_width || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.neck || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.bottom || '—'}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; background: #fff;">${m.pocket || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Styles Details -->
        <div style="padding: 8px 14px 12px; background: #fdfdfd; border-top: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px;">
          <div><strong>الياقة:</strong> ${s.collar || 'سادة'}</div>
          <div><strong>الأكمام:</strong> ${s.sleeve || 'عادي'}</div>
          <div><strong>الكبك:</strong> ${s.cuff || 'بدون'}</div>
          <div><strong>الجيب:</strong> ${s.pocket || 'عادي'}</div>
          <div><strong>الخياطة:</strong> ${s.stitching || 'عادية'}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>أمر تشغيل تفصيل - #${invoiceNumber}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
          background: #ffffff;
          color: #0f172a;
          margin: 0;
          padding: 0;
          direction: rtl;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div style="max-width: 210mm; margin: 0 auto; padding: 10px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #1e3a8a;">${shopName}</h1>
            <div style="font-size: 14px; font-weight: 700; color: #475569; margin-top: 4px;">بطاقة أمر تشغيل ومقاسات الخياط (Work Order)</div>
          </div>
          <div style="text-align: left;" dir="ltr">
            <div style="font-size: 20px; font-weight: 900; color: #1e3a8a; background: #e0f2fe; padding: 4px 12px; border-radius: 6px; border: 2px solid #0284c7; display: inline-block;">
              #INV-${invoiceNumber}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">تاريخ: ${orderDateStr}</div>
          </div>
        </div>

        <!-- Customer & Order Meta Bar -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #cbd5e1; font-size: 13px;">
          <div><strong>العميل:</strong> <span style="font-size: 15px; font-weight: 800;">${customer?.name || 'عميل نقدي'}</span> (${customer?.phone || 'بدون هاتف'})</div>
          <div><strong>موعد التسليم:</strong> <span style="font-size: 14px; font-weight: 800; color: #b45309;">${deliveryDate || 'غير محدد'}</span></div>
          <div><strong>عدد القطع:</strong> <span style="font-size: 14px; font-weight: 800;">${items.length} قطعة</span></div>
        </div>

        <!-- Items & Garments -->
        ${itemsHtml}

        <!-- General Tailor Notes -->
        ${notes ? `
          <div style="margin-bottom: 16px; padding: 10px 14px; background: #fefce8; border: 1.5px solid #facc15; border-radius: 8px; font-size: 13px;">
            <strong style="color: #854d0e;">ملاحظات خاصة للمعلم:</strong> ${notes}
          </div>
        ` : ''}

        <!-- Footer / Financial & Signature -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #0f172a; padding-top: 14px; margin-top: 20px; font-size: 13px;">
          <div style="display: flex; gap: 24px;">
            <div>الإجمالي: <strong>${tot} ر.س</strong></div>
            <div>المدفوع (العربون): <strong style="color: #059669;">${pd} ر.س</strong></div>
            <div>المتبقي: <strong style="color: #dc2626;">${bal} ر.س</strong></div>
          </div>
          <div style="display: flex; gap: 40px; text-align: center;">
            <div>
              <div style="border-bottom: 1px dotted #94a3b8; width: 120px; margin-bottom: 4px; height: 24px;"></div>
              <span style="font-size: 11px; color: #64748b;">توقيع المعلم / القصاص</span>
            </div>
            <div>
              <div style="border-bottom: 1px dotted #94a3b8; width: 120px; margin-bottom: 4px; height: 24px;"></div>
              <span style="font-size: 11px; color: #64748b;">توقيع العميل عند الاستلام</span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Trigger reliable printing of the Tailor Work Order
 */
export async function printTailorWorkOrderDirect(orderDetails, fabrics = [], settings = {}) {
  const html = generateWorkOrderA4HTML(orderDetails, fabrics, settings);
  if (window.api?.printHTML) {
    return window.api.printHTML(html);
  }

  // Fallback iframe execution
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Direct iframe print error:', e);
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 2000);
    }, 400);
    return { success: true };
  } catch (e) {
    console.error('Print execution failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Generate clean HTML for printing a Measurement Profile (A4)
 */
export function generateMeasurementProfileHTML(customer, profile, unit = 'in', settings = {}) {
  const shopName = settings.business_name_ar || 'محل الخياطة والتفصيل';
  const shopPhone = settings.phone || settings.whatsapp || '';
  const garmentType = profile?.garment_type === 'thobe' ? 'ثوب رجالي' : profile?.garment_type === 'sirwal' ? 'سروال' : profile?.garment_type || 'تفصيل';
  const unitLabel = unit === 'cm' ? 'سنتيمتر (سم)' : 'إنش (بوصة)';

  const labels = {
    length: 'الطول (Length)',
    shoulder: 'الكتف (Shoulder)',
    chest: 'الصدر (Chest)',
    waist: 'الوسط (Waist)',
    sleeve: 'طول الكم (Sleeve)',
    neck: 'الرقبة (Neck)',
    wrist: 'المعصم / الزند (Wrist)',
    hand_opening: 'وسع الكم / الفتحة (Opening)',
    cuff: 'الكبك (Cuff)',
    collar: 'الياقة (Collar)',
    pocket: 'الجيب (Pocket)'
  };

  const m = profile?.measurements || profile || {};

  const rows = Object.entries(labels).map(([k, label]) => {
    const val = m[k];
    if (val === undefined || val === null || val === '') return '';
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 14px; font-weight: 700; color: #334155; background: #f8fafc; width: 45%;">${label}</td>
        <td style="padding: 10px 14px; font-weight: 900; font-size: 16px; color: #0f172a; font-family: 'IBM Plex Mono', monospace;">${val} ${unit}</td>
      </tr>
    `;
  }).filter(Boolean).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>بطاقة مقاسات - ${customer?.name || ''}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Kufi Arabic', sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .sheet {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #0f172a;
          border-radius: 12px;
          padding: 24px;
        }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900;">${shopName}</h1>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">بطاقة وسجل المقاسات المعتمدة (Measurement Card)</div>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 12px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 4px 10px; border-radius: 6px;">نوع الموديل: ${garmentType}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">الوحدة: ${unitLabel}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 16px; font-size: 13px;">
          <div>اسم العميل: <strong style="font-size: 15px;">${customer?.name || '—'}</strong></div>
          <div>رقم الجوال: <strong dir="ltr" style="font-family: monospace;">${customer?.phone || '—'}</strong></div>
          <div>تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-SA')}</strong></div>
          <div>هاتف المعمل: <strong>${shopPhone || '—'}</strong></div>
        </div>

        <table>
          <tbody>
            ${rows || '<tr><td style="padding: 20px; text-align: center;">لا توجد قياسات مسجلة</td></tr>'}
          </tbody>
        </table>

        ${profile?.notes ? `
          <div style="margin-top: 16px; padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 12px;">
            <strong>ملاحظات خاصة:</strong> ${profile.notes}
          </div>
        ` : ''}

        <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
          <div>توقيع المعلم: ___________________</div>
          <div>اعتماد العميل: ___________________</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Trigger reliable printing of Customer Measurement Profile
 */
export async function printMeasurementProfileDirect(customer, profile, unit = 'in', settings = {}) {
  const html = generateMeasurementProfileHTML(customer, profile, unit, settings);
  if (window.api?.printHTML) {
    return window.api.printHTML(html);
  }

  // Direct iframe fallback
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe measurement print error:', e);
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 2000);
    }, 400);
    return { success: true };
  } catch (e) {
    console.error('Print execution failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Generate Direct Self-Service Customer Tracking Link
 */
export function generateTrackingUrl(orderId) {
  if (!orderId) return '';
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '';
  return `${origin}${pathname}#/track/${encodeURIComponent(orderId)}`;
}

/**
 * Generate Friendly WhatsApp Message with Self-Service Tracking Link
 */
export function generateTrackingWhatsAppText(orderDetails, settings = {}) {
  if (!orderDetails) return '';
  const shopName = settings.business_name_ar || 'محل الخياطة والتفصيل';
  const shopPhone = settings.phone || settings.whatsapp || '';
  const orderId = orderDetails.orderId || orderDetails.id || orderDetails.invoiceNumber || '';
  const customerName = orderDetails.customer?.name || orderDetails.customer_name || 'العميل العزيز';
  const deliveryDate = orderDetails.deliveryDate || orderDetails.target_delivery_date || '';
  const balance = orderDetails.balance !== undefined ? orderDetails.balance : (orderDetails.balance_due || 0);
  const trackingUrl = generateTrackingUrl(orderId);

  let msg = `*مرحباً بك يا ${customerName} في ${shopName}* ✂️\n\n`;
  msg += `نشكرك على ثقتك واختيارك لنا لتفصيل ثوبك.\n`;
  msg += `تم تسجيل وتأكيد طلبك بنجاح في معملنا:\n`;
  msg += `📋 *رقم الطلب:* #ORD-${orderId}\n`;
  if (deliveryDate) {
    msg += `📅 *موعد التسليم المتوقع:* ${deliveryDate}\n`;
  }
  if (balance > 0) {
    msg += `💰 *المتبقي عند الاستلام:* ${parseFloat(balance).toFixed(2)} ر.س\n`;
  } else {
    msg += `✅ *حالة السداد:* مدفوع بالكامل\n`;
  }
  msg += `─────────────────\n`;
  msg += `🔗 *لمتابعة مراحل تفصيل ثوبك لحظة بلحظة (قص ➔ خياطة ➔ جاهزية) دون الحاجة للاتصال:*\n`;
  msg += `${trackingUrl}\n`;
  msg += `─────────────────\n`;
  if (shopPhone) {
    msg += `📞 للاستفسارات والدعم: ${shopPhone}\n`;
  }
  msg += `نسعد بخدمتك دائماً ونتمنى لك تجربة استثنائية! ✨`;

  return msg;
}

/**
 * Generate Thermal Label HTML for Garment Identification (50x30mm or 60x40mm)
 * Suitable for hanger tag, fabric identification, or inside pocket tag.
 */
export function generateGarmentThermalLabelHTML({
  order = {},
  garment = {},
  index = 1,
  total = 1,
  settings = {},
  size = '60x40'
}) {
  const shopName = settings.business_name_ar || 'خياطة وتفصيل';
  const orderId = order.orderId || order.id || garment.order_id || '—';
  const barcodeValue = `ORD-${orderId}-G${garment.id || index}`;
  const barcodeSvg = generateBarcodeSVG(barcodeValue, {
    width: size === '50x30' ? 1.4 : 1.8,
    height: size === '50x30' ? 24 : 32,
    displayValue: false
  });

  const customerName = order.customer?.name || order.customer_name || 'عميل نقدي';
  const customerPhone = order.customer?.phone || order.customer_phone || '';
  const deliveryDate = order.deliveryDate || order.target_delivery_date || '—';
  const garmentType = garment.garment_type === 'thobe' ? 'ثوب رجالي' : (garment.garment_type || 'تفصيل');
  const fabricName = garment.fabric_name || 'قماش محدد';
  const tailorName = garment.tailor_name || 'المعلم';
  const cutterName = garment.cutter_name || 'القصاص';
  const isUrgent = order.isUrgent || order.is_urgent || garment.is_urgent;

  const widthMm = size === '50x30' ? 50 : 60;
  const heightMm = size === '50x30' ? 30 : 40;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>ملصق ثوب #${orderId}</title>
      <style>
        @page {
          size: ${widthMm}mm ${heightMm}mm;
          margin: 1.5mm;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Kufi Arabic', sans-serif;
          font-size: ${size === '50x30' ? '9px' : '10px'};
          line-height: 1.2;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .tag-card {
          width: 100%;
          height: 100%;
          border: 1.5px solid #000;
          border-radius: 4px;
          padding: 3px 4px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
        }
        .shop-title {
          font-weight: 900;
          font-size: ${size === '50x30' ? '10px' : '11px'};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .seq {
          font-size: 9px;
          font-weight: 800;
          background: #000;
          color: #fff;
          padding: 1px 4px;
          border-radius: 3px;
        }
        .order-badge {
          font-size: ${size === '50x30' ? '11px' : '13px'};
          font-weight: 900;
          font-family: monospace;
        }
        .customer {
          font-weight: 900;
          font-size: ${size === '50x30' ? '10px' : '11px'};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .barcode-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 1px 0;
        }
        .barcode-text {
          font-size: 8px;
          font-family: monospace;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          border-top: 1px dashed #000;
          padding-top: 1px;
        }
      </style>
    </head>
    <body>
      <div class="tag-card">
        <div class="header">
          <span class="shop-title">${shopName}</span>
          <span class="seq">ثوب ${index} من ${total}</span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
          <span class="order-badge">#ORD-${orderId}</span>
          ${isUrgent ? '<span style="font-weight: 900; font-size: 9px; border: 1px solid #000; padding: 0 2px;">⚠️ مستعجل</span>' : ''}
          <span style="font-size: 8.5px; font-weight: 700;">تسليم: ${deliveryDate}</span>
        </div>

        <div class="customer">${customerName} ${customerPhone ? `<span dir="ltr" style="font-size: 8px; font-weight: normal;">(${customerPhone})</span>` : ''}</div>
        
        <div style="font-size: 8.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${garmentType} • ${fabricName}
        </div>

        <div class="barcode-box">
          ${barcodeSvg}
          <div class="barcode-text">${barcodeValue}</div>
        </div>

        <div class="footer">
          <span>القصاص: ${cutterName}</span>
          <span>المعلم: ${tailorName}</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Print a single garment thermal label
 */
export async function printGarmentThermalLabel({
  order,
  garment,
  index = 1,
  total = 1,
  settings = {},
  size = '60x40'
}) {
  const html = generateGarmentThermalLabelHTML({ order, garment, index, total, settings, size });
  if (window.api?.printHTML) {
    return window.api.printHTML(html);
  }

  // Direct iframe print fallback
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe thermal label print error:', e);
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 2000);
    }, 400);
    return { success: true };
  } catch (e) {
    console.error('Thermal label print failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Print all garment labels for an order in one batch
 */
export async function printAllGarmentLabelsBatch({
  order,
  garments = [],
  settings = {},
  size = '60x40'
}) {
  const items = garments.length > 0 ? garments : (order.items || [{}]);
  const total = items.length;
  const widthMm = size === '50x30' ? 50 : 60;
  const heightMm = size === '50x30' ? 30 : 40;

  // Build multi-page HTML
  const pagesHtml = items.map((garment, idx) => {
    const single = generateGarmentThermalLabelHTML({
      order,
      garment,
      index: idx + 1,
      total,
      settings,
      size
    });
    const match = single.match(/<body>([\s\S]*?)<\/body>/i);
    const bodyContent = match ? match[1] : '';
    return `<div class="label-page" style="page-break-after: always; width: ${widthMm}mm; height: ${heightMm}mm;">${bodyContent}</div>`;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>ملصقات طلب #${order.orderId || order.id}</title>
      <style>
        @page { size: ${widthMm}mm ${heightMm}mm; margin: 1mm; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .label-page { box-sizing: border-box; padding: 1mm; overflow: hidden; }
        .tag-card {
          width: 100%;
          height: 100%;
          border: 1.5px solid #000;
          border-radius: 4px;
          padding: 3px 4px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          font-size: ${size === '50x30' ? '9px' : '10px'};
          line-height: 1.2;
        }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 2px; }
        .shop-title { font-weight: 900; font-size: ${size === '50x30' ? '10px' : '11px'}; white-space: nowrap; }
        .seq { font-size: 9px; font-weight: 800; background: #000; color: #fff; padding: 1px 4px; border-radius: 3px; }
        .order-badge { font-size: ${size === '50x30' ? '11px' : '13px'}; font-weight: 900; font-family: monospace; }
        .customer { font-weight: 900; font-size: ${size === '50x30' ? '10px' : '11px'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .barcode-box { display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 1px 0; }
        .barcode-text { font-size: 8px; font-family: monospace; font-weight: 700; }
        .footer { display: flex; justify-content: space-between; font-size: 8px; border-top: 1px dashed #000; padding-top: 1px; }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;

  if (window.api?.printHTML) {
    return window.api.printHTML(fullHtml);
  }

  // Direct iframe print fallback
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe batch label print error:', e);
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 2500);
    }, 500);
    return { success: true };
  } catch (e) {
    console.error('Batch label print failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Generate 80mm Thermal Handover & Clearance Receipt HTML
 */
export function generateHandoverReceiptHTML({
  order,
  garments = [],
  paymentMethod = 'cash',
  balancePaid = 0,
  settings = {}
}) {
  const shopName = settings.business_name_ar || 'مشغل الخياطة الرجالية الراقية';
  const shopPhone = settings.phone || settings.whatsapp || '';
  const taxId = settings.tax_number || settings.vat_number || '';
  const address = settings.address || '';
  
  const orderId = order.id || order.orderId || '—';
  const custName = order.customer_name || order.customer?.name || 'عميل نقدي';
  const custPhone = order.customer_phone || order.customer?.phone || '';
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const depositPaid = Number(order.deposit_paid || order.paid_amount || (order.total_amount - (order.balance_due || 0)) || 0).toFixed(2);
  const paidNow = Number(balancePaid || order.balance_due || 0).toFixed(2);
  const nowStr = new Date().toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });

  const payMethodLabels = {
    cash: 'نقداً (كاش)',
    card: 'مدى / بطاقة مصرفية',
    bank: 'تحويل بنكي',
    transfer: 'تحويل بنكي'
  };
  const payLabel = payMethodLabels[paymentMethod] || 'نقداً';

  const barcodeSvg = generateBarcodeSVG(`ORD-${orderId}`, 180, 42);

  const garmentRows = (garments.length > 0 ? garments : (order.items || [{ garment_type: 'ثوب رجالي', fabric_name: 'قماش عميل' }])).map((g, idx) => `
    <tr>
      <td style="padding: 4px 0; border-bottom: 1px dotted #888; font-weight: 700;">${idx + 1}. ${g.garment_type || 'ثوب'}</td>
      <td style="padding: 4px 0; border-bottom: 1px dotted #888; font-size: 11px;">${g.fabric_name || 'قماش عميل'}</td>
      <td style="padding: 4px 0; border-bottom: 1px dotted #888; text-align: left; color: #000; font-weight: 800;">تم الاستلام ✓</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>سند تسليم ومخالصة #${orderId}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: 80mm auto; margin: 2mm 3mm; }
        body {
          font-family: 'Tajawal', 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          line-height: 1.35;
          color: #000;
          background: #fff;
          width: 76mm;
          margin: 0 auto;
          padding: 3mm 2mm;
          direction: rtl;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .font-bold { font-weight: 900; }
        .divider { border-bottom: 1.5px dashed #000; margin: 6px 0; }
        .double-divider { border-bottom: 2px solid #000; margin: 7px 0; }
        .flex { display: flex; justify-content: space-between; align-items: center; margin: 3px 0; font-size: 11.5px; }
        .badge {
          border: 1.5px solid #000;
          border-radius: 4px;
          padding: 4px;
          text-align: center;
          font-weight: 900;
          font-size: 12px;
          margin: 6px 0;
          background: #f4f4f4;
        }
        table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 11px; }
        th { text-align: right; border-bottom: 1.5px solid #000; padding: 3px 0; font-weight: 900; }
        @media print {
          body { width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="text-center font-bold" style="font-size: 16px; margin-bottom: 2px;">${shopName}</div>
      ${taxId ? `<div class="text-center" style="font-size: 10px;">الرقم الضريبي: ${taxId}</div>` : ''}
      ${shopPhone ? `<div class="text-center" style="font-size: 10px;">هاتف: ${shopPhone}</div>` : ''}
      ${address ? `<div class="text-center" style="font-size: 10px;">${address}</div>` : ''}

      <div class="badge">سند تسليم نهائي ومخالصة مالية</div>

      <div class="flex">
        <span>رقم الطلب:</span>
        <span class="font-bold" style="font-size: 13px;">#${orderId}</span>
      </div>
      <div class="flex">
        <span>العميل:</span>
        <span class="font-bold">${custName}</span>
      </div>
      ${custPhone ? `
        <div class="flex">
          <span>الجوال:</span>
          <span dir="ltr" style="font-family: monospace;">${custPhone}</span>
        </div>
      ` : ''}
      <div class="flex">
        <span>تاريخ التسليم:</span>
        <span dir="ltr">${nowStr}</span>
      </div>

      <div class="divider"></div>

      <div class="font-bold" style="margin-bottom: 4px; font-size: 11px;">تفاصيل الثياب والقطع المستلمة:</div>
      <table>
        <thead>
          <tr>
            <th>القطعة</th>
            <th>القماش</th>
            <th style="text-align: left;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${garmentRows}
        </tbody>
      </table>

      <div class="double-divider"></div>

      <div class="flex">
        <span>إجمالي قيمة الطلب:</span>
        <span dir="ltr" class="font-bold">${totalAmount} SAR</span>
      </div>
      <div class="flex">
        <span>العربون المسدد سابقاً:</span>
        <span dir="ltr">${depositPaid} SAR</span>
      </div>
      <div class="flex font-bold" style="font-size: 13px; margin: 5px 0;">
        <span>المسدد الآن عند الاستلام:</span>
        <span dir="ltr">${paidNow} SAR</span>
      </div>
      <div class="flex">
        <span>طريقة السداد:</span>
        <span class="font-bold">${payLabel}</span>
      </div>

      <div class="divider"></div>

      <div class="flex font-bold" style="font-size: 13px; color: #000; padding: 4px 0;">
        <span>المتبقي في الذمة:</span>
        <span>0.00 SAR (خالص تماماً)</span>
      </div>

      <div style="text-align: center; margin: 8px 0;">
        ${barcodeSvg}
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px;">
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px dotted #000; height: 20px; margin-bottom: 3px;"></div>
          <span>توقيع العميل / المستلم</span>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="border-bottom: 1px dotted #000; height: 20px; margin-bottom: 3px;"></div>
          <span>ختم / توقيع المشغل</span>
        </div>
      </div>

      <div class="text-center" style="font-size: 9.5px; margin-top: 12px; line-height: 1.4; color: #333;">
        نسعد بخدمتكم دائماً ونتمنى لكم إطلالة بهية.<br/>
        يُرجى مراجعتنا خلال 7 أيام لأي ضبط أو بروفة إضافية مجاناً.
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate WhatsApp message for Handover Clearance
 */
export function generateHandoverWhatsAppText({
  order,
  garments = [],
  paymentMethod = 'cash',
  balancePaid = 0,
  settings = {}
}) {
  const shopName = settings.business_name_ar || 'مشغل الخياطة الرجالية';
  const orderId = order.id || order.orderId || '—';
  const custName = order.customer_name || order.customer?.name || 'عميلنا العزيز';
  const totalAmount = Number(order.total_amount || 0).toFixed(2);
  const paidNow = Number(balancePaid || order.balance_due || 0).toFixed(2);
  const payMethodLabels = { cash: 'نقداً', card: 'مدى / بطاقة', bank: 'تحويل بنكي' };
  const payLabel = payMethodLabels[paymentMethod] || 'نقداً';

  const garmentCount = garments.length > 0 ? garments.length : 1;

  let msg = `*سند تسليم نهائي ومخالصة استلام ثياب* ✂️👔\n`;
  msg += `*${shopName}*\n`;
  msg += `─────────────────\n`;
  msg += `أهلاً بك أستاذ *${custName}*،\n`;
  msg += `نشكركم لاختياركم لنا. تم تسليم طلبكم رقم *#${orderId}* بنجاح.\n\n`;
  msg += `📦 *عدد القطع المستلمة:* ${garmentCount} قطعة\n`;
  msg += `💰 *إجمالي الطلب:* ${totalAmount} ر.س\n`;
  msg += `💳 *المبلغ المسدد عند الاستلام:* ${paidNow} ر.س (${payLabel})\n`;
  msg += `✅ *حالة الحساب:* خالص بالكامل (0.00 ر.س)\n`;
  msg += `─────────────────\n`;
  msg += `ملبوس العافية والسرور إن شاء الله 🌟\n`;
  msg += `لأي تعديل أو ضبط مقاس يسعدنا خدمتكم مجاناً خلال 7 أيام من تاريخ اليوم.\n`;
  return msg;
}

/**
 * Direct print trigger for Handover & Clearance Receipt
 */
export async function printHandoverReceiptDirect(params) {
  const html = generateHandoverReceiptHTML(params);
  
  // 1. Desktop native Electron API if present
  if (window.api?.printHTML) {
    try {
      const res = await window.api.printHTML(html);
      return { success: true, res };
    } catch (e) {
      console.warn('window.api.printHTML failed, proceeding to web print fallback:', e);
    }
  }

  // 2. Direct Web Print Portal (Bulletproof in all modern browsers and iframe environments)
  try {
    // Remove any previously existing print container
    const oldContainer = document.getElementById('mulam-handover-print-portal');
    if (oldContainer) oldContainer.remove();
    const oldStyle = document.getElementById('mulam-handover-print-style');
    if (oldStyle) oldStyle.remove();
    const oldIframe = document.getElementById('mulam-handover-print-iframe');
    if (oldIframe) oldIframe.remove();

    // Create print container in DOM with strict print stylesheet
    const printContainer = document.createElement('div');
    printContainer.id = 'mulam-handover-print-portal';
    printContainer.innerHTML = html;

    const styleEl = document.createElement('style');
    styleEl.id = 'mulam-handover-print-style';
    styleEl.innerHTML = `
      @media screen {
        #mulam-handover-print-portal {
          display: none !important;
        }
      }
      @media print {
        body > *:not(#mulam-handover-print-portal) {
          display: none !important;
        }
        #mulam-handover-print-portal {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 80mm !important;
          margin: 0 auto !important;
          padding: 2mm !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Courier New', Courier, monospace !important;
        }
      }
    `;

    document.head.appendChild(styleEl);
    document.body.appendChild(printContainer);

    // Create properly sized offscreen iframe (non-zero size so Chromium doesn't suppress it)
    const iframe = document.createElement('iframe');
    iframe.id = 'mulam-handover-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '300px';
    iframe.style.height = '400px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-999';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    let printed = false;
    try {
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            printed = true;
          } catch (err) {
            console.warn('Iframe print blocked, invoking window.print fallback:', err);
            window.print();
            printed = true;
          }
        }, 350);
      }
    } catch (err) {
      console.warn('Iframe document write failed, falling back to window.print:', err);
      window.print();
      printed = true;
    }

    setTimeout(() => {
      try {
        printContainer.remove();
        styleEl.remove();
        iframe.remove();
      } catch (_) {}
    }, 6000);

    return { success: true };
  } catch (err) {
    console.error('Direct print failed:', err);
    try {
      window.print();
      return { success: true };
    } catch (e2) {
      return { success: false, error: err.message };
    }
  }
}


