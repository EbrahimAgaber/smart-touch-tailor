export function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  // 1. إزالة أي مسافات، أقواس، أو إشارات
  let cleaned = phone.replace(/[^\d+]/g, '');

  // 2. إزالة علامة + إن وجدت لأن wa.me لا يقبلها في المسار
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('05')) {
    // رقم محلي سعودي: تحويل 05xxxxxxx إلى 9665xxxxxxx
    cleaned = '966' + cleaned.substring(1);
  } else if (cleaned.startsWith('01')) {
    // رقم محلي مصري: تحويل 01xxxxxxx إلى 201xxxxxxx
    cleaned = '20' + cleaned.substring(1);
  }

  // Fallback for Saudi short form if 9 digits
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    cleaned = '966' + cleaned;
  }

  // Remove any remaining non-digits just in case
  return cleaned.replace(/\D/g, '');
}

export function createWhatsAppUrl(phoneNumber, textMessage) {
  const cleanPhone = sanitizePhoneNumber(phoneNumber);
  const encodedText = encodeURIComponent(textMessage || '');

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  } else {
    return `https://wa.me/?text=${encodedText}`;
  }
}

export async function openWhatsApp(phone, message, html = null) {
  const url = createWhatsAppUrl(phone, message);
  
  // Try background WhatsApp automation first
  if (window.api && window.api.whatsapp) {
      try {
          const status = await window.api.whatsapp.getStatus();
          if (status.connected) {
              const res = html 
                  ? await window.api.whatsapp.sendHTML({ phone, text: message, html })
                  : await window.api.whatsapp.send({ phone, text: message });
              if (res.success) {
                  return { success: true, method: 'background' };
              }
          }
      } catch (err) {
          console.error('[WhatsApp Background Send Failed]', err);
      }
  }

  // Try Electron API openExternal
  if (window.api && window.api.openExternal) {
    window.api.openExternal(url);
    return { success: true, method: 'external' };
  }
  
  // Fallback to web window.open
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
  return { success: true, method: 'web' };
}
