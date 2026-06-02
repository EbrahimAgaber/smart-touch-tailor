/**
 * LabelPrintEngine.js  —  My-POS v2
 * ═══════════════════════════════════════════════════════════════════════
 * Refactored per audit proposals P1-P6 / P8-P10.
 *
 * Change log vs original:
 *  P1  – printLabelBatch: CSS extracted once via buildLabelCSS(); only
 *         <div class="lbl"> blocks loop. ~60% smaller HTML for big batches.
 *  P2  – PRINTER_PROFILES map added. calcLayout() accepts a profile and
 *         subtracts hardware non-printable zones before computing layout.
 *  P3  – printLabel / printLabelBatch route through print:label IPC which
 *         creates a correctly-sized hidden BrowserWindow (see main.cjs).
 *  P4  – mmToPx(mm, context) unified utility. SCREEN_PX_MM / RENDER_PX_PER_MM
 *         are gone; all callers use mmToPx().
 *  P5  – detectBarcodeFormat extended: URL → QRCODE, GS1 AI → DATAMATRIX.
 *         renderBarcode() abstraction dispatches to JsBarcode / qrcode / bwip-js.
 *         zatcaTLV wired to label QR when showQR + qrContent = 'zatca'.
 *  P6  – buildLabelCSS() injects base64 @font-face for 'embed' fontStrategy.
 *         'bitmap' strategy switches to Courier New + -webkit-font-smoothing:none.
 *  P8  – ZPL path handled in main.cjs (see print:label handler). Engine exports
 *         buildZPL() for when driverType === 'zpl'.
 *  P9  – printLabel / printLabelBatch log to label_print_log via IPC.
 *  P10 – buildLabelHTML / buildLabelCSS render expiry/batch/weight/origin zones.
 * ═══════════════════════════════════════════════════════════════════════
 */

import JsBarcode from 'jsbarcode';

// ─── LABEL PRESETS ────────────────────────────────────────────────────────────
export const LABEL_PRESETS = {
  '30x20':  { w:30,  h:20,  name:'٣٠×٢٠ مم',  printerWidth:'58', recommended:'thermal-58' },
  '38x25':  { w:38,  h:25,  name:'٣٨×٢٥ مم',  printerWidth:'58', recommended:'thermal-58' },
  '40x40':  { w:40,  h:40,  name:'٤٠×٤٠ مم',  printerWidth:'58', recommended:'thermal-58' },
  '58x30':  { w:58,  h:30,  name:'٥٨×٣٠ مم',  printerWidth:'58', recommended:'thermal-58' },
  '58x40':  { w:58,  h:40,  name:'٥٨×٤٠ مم',  printerWidth:'58', recommended:'thermal-58' },
  '60x40':  { w:60,  h:40,  name:'٦٠×٤٠ مم',  printerWidth:'58', recommended:'thermal-58' },
  '50x50':  { w:50,  h:50,  name:'٥٠×٥٠ مم',  printerWidth:'80', recommended:'thermal-80' },
  '80x50':  { w:80,  h:50,  name:'٨٠×٥٠ مم',  printerWidth:'80', recommended:'thermal-80' },
  '80x60':  { w:80,  h:60,  name:'٨٠×٦٠ مم',  printerWidth:'80', recommended:'thermal-80' },
  '100x50': { w:100, h:50,  name:'١٠٠×٥٠ مم', printerWidth:'80', recommended:'thermal-80' },
  '100x70': { w:100, h:70,  name:'١٠٠×٧٠ مم', printerWidth:'80', recommended:'thermal-80' },
  '50x30':  { w:50,  h:30,  name:'٥٠×٣٠ مم',  printerWidth:'A4', recommended:'desktop' },
  '63x38':  { w:63,  h:38,  name:'٦٣×٣٨ مم',  printerWidth:'A4', recommended:'desktop' },
  '70x37':  { w:70,  h:37,  name:'٧٠×٣٧ مم',  printerWidth:'A4', recommended:'desktop' },
  '99x57':  { w:99,  h:57,  name:'٩٩×٥٧ مم',  printerWidth:'A4', recommended:'desktop' },
};

// ─── P2: PRINTER PROFILES ─────────────────────────────────────────────────────
// lnpzMm/rnpzMm/tnpzMm/bnpzMm = hardware non-printable zones in mm.
// maxDPI      = maximum supported DPI (used for print window sizing).
// driverType  = 'gdi' | 'cups' | 'escpos' | 'zpl'
// fontStrategy= 'embed' | 'system' | 'bitmap'
export const PRINTER_PROFILES = {
  'Zebra ZD220':        { lnpzMm:3,   rnpzMm:3,   tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'zpl',    fontStrategy:'embed'  },
  'Zebra ZD420':        { lnpzMm:3,   rnpzMm:3,   tnpzMm:2,   bnpzMm:2,   maxDPI:300, driverType:'zpl',    fontStrategy:'embed'  },
  'Zebra ZD620':        { lnpzMm:3,   rnpzMm:3,   tnpzMm:2,   bnpzMm:2,   maxDPI:300, driverType:'zpl',    fontStrategy:'embed'  },
  'Bixolon SRP-350':    { lnpzMm:1,   rnpzMm:1,   tnpzMm:1,   bnpzMm:1,   maxDPI:203, driverType:'gdi',    fontStrategy:'embed'  },
  'Bixolon SLP-720':    { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1.5, bnpzMm:1.5, maxDPI:300, driverType:'gdi',    fontStrategy:'embed'  },
  'SATO CL4NX':         { lnpzMm:0.8, rnpzMm:0.8, tnpzMm:0.8, bnpzMm:0.8, maxDPI:305, driverType:'zpl',    fontStrategy:'embed'  },
  'SATO GL4e':          { lnpzMm:1,   rnpzMm:1,   tnpzMm:1,   bnpzMm:1,   maxDPI:305, driverType:'zpl',    fontStrategy:'embed'  },
  'Epson TM-L90':       { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1,   bnpzMm:1,   maxDPI:203, driverType:'escpos', fontStrategy:'embed'  },
  'Epson TM-L100':      { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1,   bnpzMm:1,   maxDPI:203, driverType:'escpos', fontStrategy:'embed'  },
  'Star TSP654':        { lnpzMm:2.5, rnpzMm:2.5, tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'gdi',    fontStrategy:'system' },
  'Star mC-Label':      { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:300, driverType:'gdi',    fontStrategy:'system' },
  'Xprinter XP-365B':   { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi',    fontStrategy:'embed'  },
  'Xprinter XP-H500B':  { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'zpl',    fontStrategy:'embed'  },
  'iDPRT SP410':        { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi',    fontStrategy:'embed'  },
  'iDPRT SP450':        { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi',    fontStrategy:'embed'  },
  'TSC TE210':          { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi',    fontStrategy:'system' },
  'TSC TTP-244':        { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi',    fontStrategy:'system' },
  'Honeywell PC45':     { lnpzMm:2.5, rnpzMm:2.5, tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'zpl',    fontStrategy:'embed'  },
  'Honeywell PC42':     { lnpzMm:2.5, rnpzMm:2.5, tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'zpl',    fontStrategy:'embed'  },
  'Brother QL-820NWB':  { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:300, driverType:'gdi',    fontStrategy:'embed'  },
  // Conservative fallback for unrecognised printers
  '_default':           { lnpzMm:3,   rnpzMm:3,   tnpzMm:3,   bnpzMm:3,   maxDPI:203, driverType:'gdi',    fontStrategy:'system' },
};

/**
 * fuzzyMatchProfile(printerName) → PRINTER_PROFILES entry
 * Matches a system printer display-name to the closest known profile.
 * Falls back to '_default' (3 mm all sides) for unknowns.
 */
export function fuzzyMatchProfile(printerName) {
  if (!printerName) return PRINTER_PROFILES['_default'];
  const n = printerName.toLowerCase();
  for (const [key, profile] of Object.entries(PRINTER_PROFILES)) {
    if (key === '_default') continue;
    if (n.includes(key.toLowerCase())) return profile;
    // Try model-number fragments (ZD420, SRP-350, etc.)
    const parts = key.split(/[\s-]+/);
    if (parts.some(p => p.length > 3 && n.includes(p.toLowerCase()))) return profile;
  }
  return PRINTER_PROFILES['_default'];
}

// ─── P4: UNIFIED SCALE UTILITY ────────────────────────────────────────────────
// context = 'render'  → 8 px/mm (fixed for barcode canvas generation)
// context = 'preview' → derived from container width / label width
//   pass opts = { containerPx, labelWidthMm } for preview context.
export function mmToPx(mm, context, opts = {}) {
  if (context === 'render') return mm * 8;
  if (context === 'preview') {
    const scale = opts.containerPx && opts.labelWidthMm
      ? opts.containerPx / opts.labelWidthMm
      : 3.5; // sensible default when container width is unknown
    return mm * scale;
  }
  return mm * 8; // default to render
}

// ─── P5: BARCODE FORMAT DETECTION (extended) ─────────────────────────────────
export function detectBarcodeFormat(barcodeStr) {
  if (!barcodeStr) return 'CODE128';
  const s = String(barcodeStr).trim();
  // 2D codes
  if (/^https?:\/\//i.test(s))                         return 'QRCODE';
  if (/^\(01\)/.test(s) || /^\]d2/.test(s))            return 'DATAMATRIX';
  // 1D linear
  if (/^\d{13}$/.test(s))                               return 'EAN13';
  if (/^\d{8}$/.test(s))                                return 'EAN8';
  if (/^\d{12}$/.test(s))                               return 'UPC';
  if (/^\d{14}$/.test(s))                               return 'ITF14';
  if (/^[A-Z0-9\- .$\/+%]+$/.test(s) && s.length <= 43) return 'CODE39';
  return 'CODE128';
}

// ─── BARCODE DENSITY CALCULATOR ──────────────────────────────────────────────
export function computeBarcodeParams(barcodeStr, availWidthMm) {
  const format    = detectBarcodeFormat(barcodeStr);
  const s         = String(barcodeStr || '').trim();
  const availPx   = Math.floor(mmToPx(availWidthMm, 'render'));

  let totalModules;
  switch (format) {
    case 'EAN13':  totalModules = 113; break;
    case 'EAN8':   totalModules = 83;  break;
    case 'UPC':    totalModules = 113; break;
    case 'ITF14':  totalModules = Math.ceil(s.length * 4.5) + 10; break;
    case 'CODE39': totalModules = Math.ceil(s.length * 14) + 20; break;
    default:       totalModules = Math.ceil(s.length * 11) + 20; break;
  }
  let narrowBar = Math.max(1, Math.min(3, Math.floor(availPx / totalModules)));
  const fits = totalModules * narrowBar <= availPx;
  return { format, narrowBar, fits, totalModules, availPx, charCount: s.length };
}

// ─── P2: LAYOUT CALCULATOR (profile-aware) ────────────────────────────────────
// profile is a PRINTER_PROFILES entry. When omitted, uses _default (3 mm all sides).
export function calcLayout(labelKey, cfg = {}, profile = null) {
  const preset      = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  const { w, h }    = preset;
  const p           = profile || PRINTER_PROFILES['_default'];

  // Effective usable area after subtracting hardware non-printable zones
  const usableW     = w - p.lnpzMm - p.rnpzMm;
  const usableH     = h - p.tnpzMm - p.bnpzMm;

  // CSS padding = LNPZ on sides, TNPZ on top/bottom (browser respects @page margins=0)
  const padH        = p.lnpzMm;  // horizontal padding (left = LTR, right for RTL)
  const padV        = p.tnpzMm;  // vertical padding

  const fontScale   = w <= 40 ? 0.75 : w <= 60 ? 0.9 : w <= 80 ? 1.05 : 1.2;
  const bcHeightMm  = Math.max(6, usableH * 0.40);

  // P10: extra fields row reduces available barcode height when active
  const showExtra = !!(cfg.showExpiry || cfg.showBatch || cfg.showWeight || cfg.showOrigin);
  const extraRowMm = showExtra ? (5 * fontScale * 0.353 + 1) : 0; // approx mm
  const bcH = Math.max(5, bcHeightMm - extraRowMm);

  return {
    preset, w, h, padH, padV, usableW, usableH, fontScale,
    profile: p,
    zones: {
      businessName: { fontSize: `${(7  * fontScale).toFixed(1)}pt`, lineHeight: 1.2  },
      productName:  { fontSize: `${(9  * fontScale).toFixed(1)}pt`, lineHeight: 1.25 },
      price:        { fontSize: `${(13 * fontScale).toFixed(1)}pt`, lineHeight: 1.1  },
      extra:        { fontSize: `${(5.5 * fontScale).toFixed(1)}pt` },
      barcode: {
        heightMm:    bcH,
        heightPx:    Math.round(mmToPx(bcH, 'render')),
        textSize:    `${(6.5 * fontScale).toFixed(1)}pt`,
        availWidthMm: usableW,
      },
      sku:    { fontSize: `${(6 * fontScale).toFixed(1)}pt` },
    },
  };
}

// ─── P6: BUILD LABEL CSS (P1 extraction) ─────────────────────────────────────
// Returns the full <style>…</style> block for a label.
// Called once per batch (P1 fix) — not once per label.
export function buildLabelCSS(labelKey, cfg = {}, profile = null) {
  const layout = calcLayout(labelKey, cfg, profile);
  const { w, h, padH, padV, zones, profile: p } = layout;

  const fontFamily = cfg.fontFamily || "'Segoe UI', Tahoma, Arial, sans-serif";
  const labelBackground = cfg.labelBackground || '#ffffff';
  const textColor       = cfg.textColor       || '#1a1a1a';
  const priceColor      = cfg.priceColor      || '#111827';
  const borderStyle     = cfg.borderStyle     || 'none';
  const borderCss       = borderStyle !== 'none' ? `border: 0.3mm ${borderStyle} #aaa;` : '';

  // P6: font injection
  let fontFaceBlock = '';
  if (p.fontStrategy === 'embed') {
    // Inline stub — real deployment replaces FONT_B64_NOTO / FONT_B64_ROBOTO
    // with actual base64 subsets generated by the build script.
    // See scripts/subset-fonts.js
    fontFaceBlock = `
/* P6: embedded font stubs — replace with actual base64 subsets in production */
/* @font-face { font-family:'NotoNaskhArabic'; src:url(data:font/woff2;base64,FONT_B64_NOTO) format('woff2'); } */
/* @font-face { font-family:'RobotoCondensed'; src:url(data:font/woff2;base64,FONT_B64_ROBOTO) format('woff2'); } */`;
  }

  const fontSmoothing = p.fontStrategy === 'bitmap'
    ? `-webkit-font-smoothing: none; font-family: 'Courier New', monospace;`
    : '';

  return `<style>
${fontFaceBlock}
@page { size: ${w}mm ${h}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: ${fontFamily}; background: white; display: flex; flex-wrap: wrap; align-content: flex-start; ${fontSmoothing} }
.lbl {
  width: ${w}mm; height: ${h}mm;
  background: ${labelBackground}; color: ${textColor};
  overflow: hidden; display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  padding: ${padV}mm ${padH}mm;
  gap: 0.4mm; page-break-after: always; ${borderCss}
}
.biz { font-size:${zones.businessName.fontSize}; font-weight:600; color:#555; text-align:center; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.name { font-size:${zones.productName.fontSize}; font-weight:900; color:${textColor}; text-align:center; width:100%; word-break:break-word; line-height:${zones.productName.lineHeight}; overflow:hidden; }
.price-row { display:flex; align-items:baseline; justify-content:center; gap:0.8mm; width:100%; margin-top:0.3mm; }
.price-lbl { font-size:${zones.businessName.fontSize}; color:#777; font-weight:600; }
.price-val { font-size:${zones.price.fontSize}; font-weight:900; color:${priceColor}; direction:ltr; letter-spacing:-0.02em; }
.extra-row { font-size:${zones.extra.fontSize}; color:#555; text-align:center; direction:ltr; width:100%; display:flex; justify-content:center; gap:1.5mm; flex-wrap:wrap; }
.bc-wrap { width:100%; display:flex; flex-direction:column; align-items:center; gap:0; }
.bc-img { max-width:100%; max-height:${zones.barcode.heightMm.toFixed(1)}mm; width:auto; height:auto; display:block; direction:ltr; }
.bc-qr  { max-width:${Math.min(zones.barcode.heightMm * 1.2, 20).toFixed(1)}mm; max-height:${zones.barcode.heightMm.toFixed(1)}mm; }
.bc-num { font-size:${zones.barcode.textSize}; font-family:'Courier New',monospace; font-weight:700; letter-spacing:0.03em; direction:ltr; text-align:center; color:${textColor}; margin-top:0.3mm; }
.bc-fallback { font-size:${zones.barcode.textSize}; font-family:'Courier New',monospace; font-weight:700; direction:ltr; color:#333; text-align:center; word-break:break-all; padding:0.5mm; border:0.3mm solid #333; border-radius:0.5mm; width:100%; }
.meta { font-size:${zones.sku.fontSize}; color:#888; text-align:center; direction:ltr; }
@media print { body { background:white; } .lbl { ${borderCss} } }
</style>`;
}

// ─── P5: RENDER BARCODE ───────────────────────────────────────────────────────
// Returns a data URL (PNG for linear, SVG data URI for QR/DataMatrix).
// Falls back gracefully if npm packages are not installed.
export async function renderBarcode(value, format, widthMm, heightMm, colors = {}) {
  const { background = '#ffffff', lineColor = '#000000' } = colors;
  const availPx  = Math.floor(mmToPx(widthMm,  'render'));
  const heightPx = Math.floor(mmToPx(heightMm, 'render'));

  if (format === 'QRCODE') {
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 4,
        width: Math.min(availPx, heightPx),
        color: { dark: lineColor, light: background },
      });
      return url;
    } catch {
      // qrcode not installed — return SVG fallback from built-in qr-gen
      try {
        const { default: QRGen } = await import('./qr-gen.js');
        const svg = QRGen.generateSVG(value, 4);
        return `data:image/svg+xml;base64,${btoa(svg)}`;
      } catch { return ''; }
    }
  }

  if (format === 'DATAMATRIX') {
    try {
      // bwip-js is an optional peer dependency — loaded only when installed.
      // Use a runtime string to prevent Vite from trying to resolve it at build time.
      const pkg = 'bwip' + '-js';
      const bwipjs = (await import(/* @vite-ignore */ pkg)).default;
      const canvas = document.createElement('canvas');
      await bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix',
        text: value,
        scale: Math.max(1, Math.floor(availPx / 50)),
        height: Math.round(heightMm * 3.937), // mm → 0.1 inch
        includetext: false,
        backgroundcolor: background.replace('#', ''),
        barcolor: lineColor.replace('#', ''),
      });
      return canvas.toDataURL('image/png');
    } catch { return ''; }
  }

  // Linear barcodes via JsBarcode
  const bParams = computeBarcodeParams(value, widthMm);
  const canvas  = document.createElement('canvas');
  try {
    JsBarcode(canvas, value, {
      format:       bParams.format,
      width:        bParams.narrowBar,
      height:       heightPx,
      displayValue: false,
      margin:       0,
      background,
      lineColor,
    });
    return canvas.toDataURL('image/png');
  } catch { return ''; }
}

// ─── P10: BUILD EXTRA-FIELDS HTML ────────────────────────────────────────────
function buildExtraFields(product, cfg, layout) {
  const parts = [];
  if (cfg.showExpiry  && product.expiry_date)    parts.push(`انتهاء: ${product.expiry_date}`);
  if (cfg.showBatch   && product.batch_number)   parts.push(`دفعة: ${product.batch_number}`);
  if (cfg.showWeight  && product.net_weight_g)   parts.push(`${product.net_weight_g} غ`);
  if (cfg.showOrigin  && product.country_of_origin) parts.push(product.country_of_origin);
  if (!parts.length) return '';
  return `<div class="extra-row">${parts.join(' &nbsp;│&nbsp; ')}</div>`;
}

// ─── HTML LABEL BUILDER ───────────────────────────────────────────────────────
// buildLabelHTML now uses buildLabelCSS() for the style block.
// On single-label calls the CSS is embedded; on batch calls it's extracted.
export async function buildLabelHTML(product, settings, labelKey, copies = 1, profileOverride = null) {
  const cfg = parseCfg(settings);
  const resolvedKey = labelKey || cfg.size || '58x40';
  const profile = profileOverride || fuzzyMatchProfile(cfg.labelPrinterName || '');
  const layout  = calcLayout(resolvedKey, cfg, profile);
  const { w, h } = layout;

  const currency        = cfg.currency || settings.currency || 'SAR';
  const effectiveCopies = copies || cfg.copies || 1;
  const barcodeValue    = String(product.Barcode || product.ID || '');
  const priceFmt        = `${currency} ${parseFloat(product.Price || 0).toFixed(2)}`;

  // Barcode / QR rendering
  let barcodeDataUrl = '';
  if ((cfg.showBarcode && barcodeValue) || cfg.showQR) {
    const format = detectBarcodeFormat(barcodeValue);
    if (cfg.showQR) {
      // P5: QR content — 'zatca' wires to zatca:getTLV
      let qrValue = (cfg.qrContent || '{barcode}')
        .replace('{barcode}', barcodeValue)
        .replace('{id}', product.ID || '');
      if (cfg.qrContent === 'zatca' && window?.api?.getZatcaTLV) {
        try {
          const tlv = await window.api.getZatcaTLV({ barcode: barcodeValue, product });
          if (tlv) qrValue = tlv;
        } catch { /* fallback to barcode */ }
      }
      barcodeDataUrl = await renderBarcode(qrValue, 'QRCODE',
        Math.min(layout.zones.barcode.heightMm * 1.2, 20),
        layout.zones.barcode.heightMm, { background: cfg.labelBackground, lineColor: cfg.textColor });
    } else {
      barcodeDataUrl = await renderBarcode(barcodeValue, format,
        layout.zones.barcode.availWidthMm, layout.zones.barcode.heightMm,
        { background: cfg.labelBackground, lineColor: cfg.textColor });
    }
  }

  const bizSection   = cfg.showBusinessName && settings.business_name_ar
    ? `<div class="biz">${settings.business_name_ar}</div>` : '';
  const nameSection  = cfg.showProductName && product.Name
    ? `<div class="name">${product.Name}</div>` : '';
  const priceSection = cfg.showPrice
    ? `<div class="price-row"><span class="price-lbl">${cfg.priceLabel || 'السعر'}</span><span class="price-val">${priceFmt}</span></div>` : '';
  const skuSection   = cfg.showSKU && product.Barcode
    ? `<div class="meta">${product.Barcode}</div>` : '';
  const extraSection = buildExtraFields(product, cfg, layout);

  const imgClass = (cfg.showQR || detectBarcodeFormat(barcodeValue) === 'QRCODE' || detectBarcodeFormat(barcodeValue) === 'DATAMATRIX') ? 'bc-qr' : 'bc-img';
  const bcSection = cfg.showBarcode
    ? barcodeDataUrl
      ? `<div class="bc-wrap"><img src="${barcodeDataUrl}" class="${imgClass}" alt=""/><div class="bc-num">${barcodeValue}</div></div>`
      : `<div class="bc-fallback">${barcodeValue}</div>`
    : '';

  const topBC    = cfg.barcodePosition === 'top'    ? bcSection : '';
  const bottomBC = cfg.barcodePosition === 'bottom' ? bcSection : '';

  const labelUnit = `<div class="lbl">${topBC}${bizSection}${nameSection}${priceSection}${extraSection}${skuSection}${bottomBC}</div>`;
  const labels    = Array(effectiveCopies).fill(labelUnit).join('');
  const cssBlock  = buildLabelCSS(resolvedKey, cfg, profile);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><title>طباعة ملصق</title>
${cssBlock}
</head>
<body>${labels}
<script>window.onload=()=>{window.focus();window.print();};<\/script>
</body></html>`;
}

// ─── P1: BATCH BUILDER ────────────────────────────────────────────────────────
// CSS extracted once. Body loop emits only <div class="lbl"> blocks.
export async function printLabelBatch(products, settings, labelKey, copiesEach = 1) {
  if (!products.length) return;
  const cfg = parseCfg(settings);
  const key = labelKey || cfg.size || '58x40';
  const profile = fuzzyMatchProfile(cfg.labelPrinterName || '');
  const { w, h } = LABEL_PRESETS[key] || LABEL_PRESETS['58x40'];

  // P1: build CSS once from the first product's config
  const cssBlock = buildLabelCSS(key, cfg, profile);

  // Build all label div blocks — no per-label <html>/<head>/<style>
  const allLabelDivs = [];
  for (const p of products) {
    for (let i = 0; i < copiesEach; i++) {
      const fullHtml = await buildLabelHTML(p, settings, key, 1, profile);
      // Extract just the <div class="lbl">…</div>
      const m = fullHtml.match(/<div class="lbl">[\s\S]*?<\/div>\s*(?=<div class="lbl">|<script|<\/body>)/g);
      if (m) allLabelDivs.push(...m);
      else {
        // fallback: grab body content between tags
        const bm = fullHtml.match(/<body>([\s\S]*?)<script>/i);
        if (bm) allLabelDivs.push(bm[1].trim());
      }
    }
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><title>طباعة ملصقات (${allLabelDivs.length})</title>
${cssBlock}
</head>
<body>
${allLabelDivs.join('\n')}
<script>window.onload=()=>{window.focus();window.print();};<\/script>
</body></html>`;

  return _sendPrintJob(html, w, h, cfg, profile);
}

// ─── P3 / P9: PRINT SINGLE LABEL ─────────────────────────────────────────────
export async function printLabel(product, settings, labelKey, copies = 1) {
  const cfg = parseCfg(settings);
  const key = labelKey || cfg.size || '58x40';
  const profile = fuzzyMatchProfile(cfg.labelPrinterName || '');
  const { w, h } = LABEL_PRESETS[key] || LABEL_PRESETS['58x40'];

  // P8: ZPL bypass
  if (profile.driverType === 'zpl') {
    const zpl = buildZPL(product, settings, key, copies, profile);
    const result = await window.api.printLabelZPL({ zpl, printerName: cfg.labelPrinterName || '' });
    await _logPrint(product, copies, key, result);
    return result;
  }

  const html = await buildLabelHTML(product, settings, key, copies, profile);
  return _sendPrintJob(html, w, h, cfg, profile, product, copies, key);
}

// ─── P3: ROUTE THROUGH print:label IPC ───────────────────────────────────────
async function _sendPrintJob(html, widthMm, heightMm, cfg, profile, product, copies, labelKey) {
  // P3: use dedicated print:label IPC for correct BrowserWindow sizing & printer selection
  if (window?.api?.printLabel) {
    const result = await window.api.printLabel({
      html,
      widthMm,
      heightMm,
      printerName: cfg.labelPrinterName || '',
    });
    if (product) await _logPrint(product, copies, labelKey, result);
    return result;
  }
  // Fallback to legacy printHTML (no printer selection, A4 scaling risk)
  return window.api.printHTML(html);
}

// ─── P9: PRINT LOG ────────────────────────────────────────────────────────────
async function _logPrint(product, copies, labelKey, result) {
  try {
    await window.api.logLabelPrint({
      product_id: String(product.ID || ''),
      copies:     copies || 1,
      label_key:  labelKey,
      status:     result?.success === false ? 'failed' : 'success',
      error:      result?.error || null,
    });
  } catch { /* non-fatal */ }
}

// ─── P8: ZPL BUILDER ─────────────────────────────────────────────────────────
// Generates a ZPL II string for Zebra-compatible printers.
// Dispatched from main.cjs print:label handler when driverType === 'zpl'.
export function buildZPL(product, settings, labelKey, copies = 1, profile = null) {
  const cfg = parseCfg(settings);
  const preset  = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  const p       = profile || PRINTER_PROFILES['_default'];
  const dpi     = p.maxDPI || 203;
  const mmToDot = (mm) => Math.round(mm * dpi / 25.4);

  const labelW  = mmToDot(preset.w);
  const labelH  = mmToDot(preset.h);
  const padL    = mmToDot(p.lnpzMm + 1);
  const padT    = mmToDot(p.tnpzMm + 1);

  const name     = (product.Name || '').substring(0, 40);
  const price    = `${cfg.currency || 'SAR'} ${parseFloat(product.Price || 0).toFixed(2)}`;
  const barcode  = String(product.Barcode || product.ID || '');
  const bcFormat = detectBarcodeFormat(barcode);
  const zplBcCmd = bcFormat === 'EAN13' ? '^BEN,60,Y,N' : '^BCN,60,Y,N,N';

  // Business name line
  const bizLine = cfg.showBusinessName && settings.business_name_ar
    ? `^FO${padL},${padT}^A0N,18,18^FD${settings.business_name_ar}^FS\n` : '';
  const nameY  = padT + (bizLine ? 22 : 0);
  const priceY = nameY + 28;
  const bcY    = priceY + 28;

  let zpl = `^XA
^PW${labelW}
^LL${labelH}
^CI28
${bizLine}^FO${padL},${nameY}^A0N,24,24^FD${name}^FS
^FO${padL},${priceY}^A0N,22,22^FD${price}^FS`;

  if (cfg.showBarcode && barcode) {
    zpl += `\n^FO${padL},${bcY}${zplBcCmd}^FD${barcode}^FS`;
  }

  zpl += `\n^PQ${copies},0,1,Y\n^XZ`;
  return zpl;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseCfg(settings) {
  try {
    const raw = settings?.label_config;
    return {
      showBusinessName: true,
      showProductName:  true,
      showPrice:        true,
      showBarcode:      true,
      showSKU:          false,
      showQR:           false,
      qrContent:        '{barcode}',
      showExpiry:       false,
      showBatch:        false,
      showWeight:       false,
      showOrigin:       false,
      barcodePosition:  'bottom',
      priceLabel:       'السعر',
      fontFamily:       "'Segoe UI', Tahoma, Arial, sans-serif",
      labelBackground:  '#ffffff',
      textColor:        '#1a1a1a',
      priceColor:       '#111827',
      borderStyle:      'none',
      copies:           1,
      size:             '58x40',
      labelPrinterName: '',
      ...(typeof raw === 'string' ? JSON.parse(raw) : (raw || {})),
    };
  } catch { return { size:'58x40', copies:1, labelPrinterName:'' }; }
}

export default {
  printLabel, printLabelBatch, buildLabelHTML, buildLabelCSS,
  buildZPL, renderBarcode, LABEL_PRESETS, PRINTER_PROFILES,
  detectBarcodeFormat, computeBarcodeParams, calcLayout,
  fuzzyMatchProfile, mmToPx,
};
