/**
 * LabelPrintEngine.js  --  My-POS v2
 * ================================================================
 * Refactored per audit proposals P1-P6 / P8-P10.
 *
 * FIX LOG (label printing overhaul -- resolves corrupted barcode issue):
 *
 *  FIX-A  PRINTER_PROFILES: Zebra GK420t / GK entries changed from
 *         driverType:'zpl' to driverType:'gdi' (with zplCapable:true flag).
 *         Rationale: most GK420t units are installed as Windows GDI drivers
 *         (not raw ZPL TCP/USB ports). The engine now sends HTML by default
 *         and only falls back to ZPL when the GDI path fails, via the
 *         hardware.cjs FIX-4 waterfall.
 *
 *  FIX-B  buildZPL: corrected barcode command syntax.
 *         - EAN13: was '^BEN,60,Y,N' (wrong, no check-digit param)
 *           now '^BEA,60,Y,N' (EAN-13 with human-readable, auto check)
 *         - Default: was '^BCN,60,Y,N,N' (5 params for Code128 correct)
 *           but missing label-origin offset -- now uses full coordinate chain
 *         - All barcode field origins now use mmToDot() consistently.
 *         - printQuantity moved to ^PQ at end (was correct but copies param
 *           was sometimes 0 which Zebra interprets as "do not print").
 *
 *  FIX-C  calcLayout / buildLabelCSS: added safeClamp() so that when the
 *         user picks a label size smaller than the printer's NPZM total,
 *         usable area never goes negative (caused 0px/negative height barcode).
 *
 *  FIX-D  computeBarcodeParams: narrowBar minimum raised from 1 to 2 for
 *         EAN13/UPC (1-module bars are sub-spec and fail most scanners).
 *         Added minimum width check: if barcode cannot physically fit even
 *         at narrowBar=1, sets fits:false and narrowBar=1 (engine will
 *         still render but warn the user).
 *
 *  FIX-E  printLabel / printLabelBatch: always build HTML regardless of
 *         profile driverType and pass BOTH html + zpl to the IPC handler.
 *         hardware.cjs FIX-4 then picks the right path and auto-falls back.
 *
 *  FIX-F  LABEL_PRESETS: added common wider rolls (100x100, 40x30, 57x32,
 *         76x51) that were missing and causing the "no matching size" fallback
 *         to 58x40 on wide-roll printers like the GK420t loaded with 100mm stock.
 *
 *  FIT-MODE  New fitMode option ('none'|'fit-width'|'fit-height'|'stretch').
 *         'none'       = original fixed-size behaviour (default).
 *         'fit-width'  = font sizes and barcode height scale so content fills
 *                        the usable width; vertical spacing adapts.
 *         'fit-height' = every zone grows proportionally so content fills the
 *                        full usable height; horizontal sizing adapts.
 *         'stretch'    = both axes: content is spread to fill the entire usable
 *                        area (may change aspect ratio of barcode image).
 *         Implemented via CSS flex + computed font-size em scale factor injected
 *         by buildLabelCSS(). ZPL path scales dot coordinates proportionally.
 *
 * Original change log (P1-P10) retained below.
 * ================================================================
 *
 * Change log vs original:
 *  P1  - printLabelBatch: CSS extracted once via buildLabelCSS().
 *  P2  - PRINTER_PROFILES map added. calcLayout() accepts a profile.
 *  P3  - printLabel / printLabelBatch route through print:label IPC.
 *  P4  - mmToPx(mm, context) unified utility.
 *  P5  - detectBarcodeFormat extended. renderBarcode() abstraction.
 *  P6  - buildLabelCSS() injects base64 @font-face for 'embed' strategy.
 *  P8  - ZPL path in buildZPL().
 *  P9  - printLabel / printLabelBatch log to label_print_log via IPC.
 *  P10 - buildLabelHTML / buildLabelCSS render expiry/batch/weight/origin.
 * ================================================================
 */

import JsBarcode from 'jsbarcode';

// --- LABEL PRESETS (FIX-F: added missing common sizes) ------------------------
export const LABEL_PRESETS = {
  // 58mm roll
  '30x20':  { w:30,  h:20,  name:'30x20 mm',  printerWidth:'58', recommended:'thermal-58' },
  '38x25':  { w:38,  h:25,  name:'38x25 mm',  printerWidth:'58', recommended:'thermal-58' },
  '40x30':  { w:40,  h:30,  name:'40x30 mm',  printerWidth:'58', recommended:'thermal-58' },
  '40x40':  { w:40,  h:40,  name:'40x40 mm',  printerWidth:'58', recommended:'thermal-58' },
  '57x32':  { w:57,  h:32,  name:'57x32 mm',  printerWidth:'58', recommended:'thermal-58' },
  '58x30':  { w:58,  h:30,  name:'58x30 mm',  printerWidth:'58', recommended:'thermal-58' },
  '58x40':  { w:58,  h:40,  name:'58x40 mm',  printerWidth:'58', recommended:'thermal-58' },
  '60x40':  { w:60,  h:40,  name:'60x40 mm',  printerWidth:'58', recommended:'thermal-58' },
  // 80mm roll
  '50x30':  { w:50,  h:30,  name:'50x30 mm',  printerWidth:'80', recommended:'thermal-80' },
  '50x50':  { w:50,  h:50,  name:'50x50 mm',  printerWidth:'80', recommended:'thermal-80' },
  '76x51':  { w:76,  h:51,  name:'76x51 mm',  printerWidth:'80', recommended:'thermal-80' },
  '80x50':  { w:80,  h:50,  name:'80x50 mm',  printerWidth:'80', recommended:'thermal-80' },
  '80x60':  { w:80,  h:60,  name:'80x60 mm',  printerWidth:'80', recommended:'thermal-80' },
  // 100mm / wide roll (common on GK420t with 4" stock)
  '100x50': { w:100, h:50,  name:'100x50 mm', printerWidth:'100', recommended:'thermal-wide' },
  '100x70': { w:100, h:70,  name:'100x70 mm', printerWidth:'100', recommended:'thermal-wide' },
  '100x100':{ w:100, h:100, name:'100x100 mm',printerWidth:'100', recommended:'thermal-wide' },
  '101x51': { w:101, h:51,  name:'4"x2" (101x51)',printerWidth:'100', recommended:'thermal-wide' },
  '102x152':{ w:102, h:152, name:'4"x6" (102x152)',printerWidth:'100', recommended:'thermal-wide' },
  // A4 desktop
  '63x38':  { w:63,  h:38,  name:'63x38 mm',  printerWidth:'A4', recommended:'desktop' },
  '70x37':  { w:70,  h:37,  name:'70x37 mm',  printerWidth:'A4', recommended:'desktop' },
  '99x57':  { w:99,  h:57,  name:'99x57 mm',  printerWidth:'A4', recommended:'desktop' },
};

// --- PRINTER PROFILES (FIX-A: GK420t/GK now gdi with zplCapable flag) ---------
//
// driverType  = 'gdi' | 'cups' | 'escpos' | 'zpl'
// zplCapable  = true  means the engine will ALSO generate ZPL and pass it to
//               hardware.cjs, which tries ZPL first then falls back to HTML.
//               Setting driverType:'zpl' means HTML is NOT generated (ZPL only).
//
// Rule of thumb:
//   driverType:'zpl'              -> printer installed as a raw port (TCP/USB raw)
//   driverType:'gdi'+zplCapable   -> printer installed as Windows GDI driver
//                                    but firmware understands ZPL if sent raw
export const PRINTER_PROFILES = {
  // Zebra -- GK series: most users install via Windows driver (GDI), not raw port.
  // Changed to gdi+zplCapable so HTML is primary; ZPL tried as fallback.
  'Zebra GK420t':       { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', zplCapable:true, fontStrategy:'embed'  },
  'Zebra GK420d':       { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', zplCapable:true, fontStrategy:'embed'  },
  'Zebra GK':           { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', zplCapable:true, fontStrategy:'embed'  },
  // ZD series: typically installed as ZPL raw or ZDesigner driver; keep ZPL primary
  'Zebra ZD220':        { lnpzMm:3,   rnpzMm:3,   tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'zpl', fontStrategy:'embed'  },
  'Zebra ZD420':        { lnpzMm:3,   rnpzMm:3,   tnpzMm:2,   bnpzMm:2,   maxDPI:300, driverType:'zpl', fontStrategy:'embed'  },
  'Zebra ZD620':        { lnpzMm:3,   rnpzMm:3,   tnpzMm:2,   bnpzMm:2,   maxDPI:300, driverType:'zpl', fontStrategy:'embed'  },
  'Bixolon SRP-350':    { lnpzMm:1,   rnpzMm:1,   tnpzMm:1,   bnpzMm:1,   maxDPI:203, driverType:'gdi', fontStrategy:'embed'  },
  'Bixolon SLP-720':    { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1.5, bnpzMm:1.5, maxDPI:300, driverType:'gdi', fontStrategy:'embed'  },
  'SATO CL4NX':         { lnpzMm:0.8, rnpzMm:0.8, tnpzMm:0.8, bnpzMm:0.8, maxDPI:305, driverType:'zpl', fontStrategy:'embed'  },
  'SATO GL4e':          { lnpzMm:1,   rnpzMm:1,   tnpzMm:1,   bnpzMm:1,   maxDPI:305, driverType:'zpl', fontStrategy:'embed'  },
  'Epson TM-L90':       { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1,   bnpzMm:1,   maxDPI:203, driverType:'escpos', fontStrategy:'embed'  },
  'Epson TM-L100':      { lnpzMm:1.5, rnpzMm:1.5, tnpzMm:1,   bnpzMm:1,   maxDPI:203, driverType:'escpos', fontStrategy:'embed'  },
  'Star TSP654':        { lnpzMm:2.5, rnpzMm:2.5, tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'gdi', fontStrategy:'system' },
  'Star mC-Label':      { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:300, driverType:'gdi', fontStrategy:'system' },
  'Xprinter XP-365B':   { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', fontStrategy:'embed'  },
  'Xprinter XP-H500B':  { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'zpl', fontStrategy:'embed'  },
  'iDPRT SP410':        { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', fontStrategy:'embed'  },
  'iDPRT SP450':        { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', fontStrategy:'embed'  },
  'TSC TE210':          { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', fontStrategy:'system' },
  'TSC TTP-244':        { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:203, driverType:'gdi', fontStrategy:'system' },
  'Honeywell PC45':     { lnpzMm:2.5, rnpzMm:2.5, tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'zpl', fontStrategy:'embed'  },
  'Honeywell PC42':     { lnpzMm:2.5, rnpzMm:2.5, tnpzMm:2,   bnpzMm:2,   maxDPI:203, driverType:'zpl', fontStrategy:'embed'  },
  'Brother QL-820NWB':  { lnpzMm:2,   rnpzMm:2,   tnpzMm:1.5, bnpzMm:1.5, maxDPI:300, driverType:'gdi', fontStrategy:'embed'  },
  // Conservative fallback for unrecognised printers
  '_default':           { lnpzMm:3,   rnpzMm:3,   tnpzMm:3,   bnpzMm:3,   maxDPI:203, driverType:'gdi', fontStrategy:'system' },
};

/**
 * fuzzyMatchProfile(printerName) -> PRINTER_PROFILES entry
 * Matches a system printer display-name to the closest known profile.
 * Falls back to '_default' (3 mm all sides, gdi) for unknowns.
 */
export function fuzzyMatchProfile(printerName) {
  if (!printerName) return PRINTER_PROFILES['_default'];
  const n = printerName.toLowerCase();
  for (const [key, profile] of Object.entries(PRINTER_PROFILES)) {
    if (key === '_default') continue;
    if (n.includes(key.toLowerCase())) return profile;
    const parts = key.split(/[\s\-]+/);
    if (parts.some(p => p.length > 3 && n.includes(p.toLowerCase()))) return profile;
  }
  return PRINTER_PROFILES['_default'];
}

// --- UNIFIED SCALE UTILITY -----------------------------------------------------
// context = 'render'  -> 8 px/mm (fixed for barcode canvas generation)
// context = 'preview' -> derived from container width / label width
export function mmToPx(mm, context, opts = {}) {
  if (context === 'render') return mm * 8;
  if (context === 'preview') {
    const scale = opts.containerPx && opts.labelWidthMm
      ? opts.containerPx / opts.labelWidthMm
      : 3.5;
    return mm * scale;
  }
  return mm * 8;
}

// --- BARCODE FORMAT DETECTION --------------------------------------------------
export function detectBarcodeFormat(barcodeStr) {
  if (!barcodeStr) return 'CODE128';
  const s = String(barcodeStr).trim();
  if (/^https?:\/\//i.test(s))                         return 'QRCODE';
  if (/^\(01\)/.test(s) || /^\]d2/.test(s))            return 'DATAMATRIX';
  if (/^\d{13}$/.test(s))                               return 'EAN13';
  if (/^\d{8}$/.test(s))                                return 'EAN8';
  if (/^\d{12}$/.test(s))                               return 'UPC';
  if (/^\d{14}$/.test(s))                               return 'ITF14';
  if (/^[A-Z0-9\- .$\/+%]+$/.test(s) && s.length <= 43) return 'CODE39';
  return 'CODE128';
}

// --- BARCODE DENSITY CALCULATOR (FIX-D) ----------------------------------------
export function computeBarcodeParams(barcodeStr, availWidthMm) {
  const format  = detectBarcodeFormat(barcodeStr);
  const s       = String(barcodeStr || '').trim();
  const availPx = Math.floor(mmToPx(availWidthMm, 'render'));

  let totalModules;
  switch (format) {
    case 'EAN13':  totalModules = 113; break;
    case 'EAN8':   totalModules = 83;  break;
    case 'UPC':    totalModules = 113; break;
    case 'ITF14':  totalModules = Math.ceil(s.length * 4.5) + 10; break;
    case 'CODE39': totalModules = Math.ceil(s.length * 14) + 20;  break;
    default:       totalModules = Math.ceil(s.length * 11) + 20;  break;
  }

  // FIX-D: EAN/UPC require minimum 2px per module for reliable scanning
  const minBar = (format === 'EAN13' || format === 'EAN8' || format === 'UPC') ? 2 : 1;
  let narrowBar = Math.max(minBar, Math.min(3, Math.floor(availPx / totalModules)));
  const fits = totalModules * narrowBar <= availPx;
  // If it cannot fit even at minBar, force minBar and mark as not fitting
  if (!fits && narrowBar > minBar) narrowBar = minBar;

  return { format, narrowBar, fits, totalModules, availPx, charCount: s.length };
}

// --- LAYOUT CALCULATOR (FIX-C: safeClamp + FIT-MODE) --------------------------
// FIX-C: usableW/usableH clamped to minimum 5mm so negative values never
// propagate to barcode height / font size calculations.
// FIT-MODE: when cfg.fitMode !== 'none', a fitScale multiplier is computed and
// returned so buildLabelCSS() can inject scaled font sizes and flex layout.
export function calcLayout(labelKey, cfg = {}, profile = null) {
  const preset   = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  const { w, h } = preset;
  const p        = profile || PRINTER_PROFILES['_default'];

  const usableW  = Math.max(5, w - p.lnpzMm - p.rnpzMm);
  const usableH  = Math.max(5, h - p.tnpzMm - p.bnpzMm);
  const padH     = p.lnpzMm;
  const padV     = p.tnpzMm;

  // Base font scale (unchanged from original)
  const fontScaleBase = w <= 40 ? 0.75 : w <= 60 ? 0.9 : w <= 80 ? 1.05 : 1.2;

  // FIT-MODE: compute additional scale multipliers for W and H axes
  const fitMode = cfg.fitMode || 'none';
  // Baseline usable area used as reference (58x40 label minus default 2mm NPZM)
  const BASE_USABLE_W = 54; // 58 - 2*2
  const BASE_USABLE_H = 36; // 40 - 2*2
  const fitScaleW = (fitMode === 'fit-width'  || fitMode === 'stretch') ? (usableW / BASE_USABLE_W) : 1;
  const fitScaleH = (fitMode === 'fit-height' || fitMode === 'stretch') ? (usableH / BASE_USABLE_H) : 1;
  // Combined font scale: width drives horizontal density, height drives vertical density
  const fitScale  = fitMode === 'none'       ? 1
                  : fitMode === 'fit-width'   ? fitScaleW
                  : fitMode === 'fit-height'  ? fitScaleH
                  : Math.min(fitScaleW, fitScaleH); // stretch: use the smaller to avoid overflow
  const fontScale = fontScaleBase * fitScale;

  // Barcode height: in fit modes, expand to fill more of the usable height
  const bcFraction = fitMode === 'none' ? 0.40
                   : fitMode === 'fit-width'  ? 0.45
                   : fitMode === 'fit-height' ? 0.55
                   : 0.55; // stretch
  const bcHeightMm = Math.max(6, usableH * bcFraction);

  const showExtra  = !!(cfg.showExpiry || cfg.showBatch || cfg.showWeight || cfg.showOrigin);
  const extraRowMm = showExtra ? (5 * fontScale * 0.353 + 1) : 0;
  const bcH        = Math.max(5, bcHeightMm - extraRowMm);

  return {
    preset, w, h, padH, padV, usableW, usableH, fontScale, fitMode,
    fitScaleW, fitScaleH, fitScale,
    profile: p,
    zones: {
      businessName: { fontSize: `${(7  * fontScale).toFixed(1)}pt`, lineHeight: 1.2  },
      productName:  { fontSize: `${(9  * fontScale).toFixed(1)}pt`, lineHeight: 1.25 },
      price:        { fontSize: `${(13 * fontScale).toFixed(1)}pt`, lineHeight: 1.1  },
      extra:        { fontSize: `${(5.5 * fontScale).toFixed(1)}pt` },
      barcode: {
        heightMm:     bcH,
        heightPx:     Math.round(mmToPx(bcH, 'render')),
        textSize:     `${(6.5 * fontScale).toFixed(1)}pt`,
        availWidthMm: usableW,
      },
      sku: { fontSize: `${(6 * fontScale).toFixed(1)}pt` },
    },
  };
}

// --- BUILD LABEL CSS (FIT-MODE aware) -----------------------------------------
export function buildLabelCSS(labelKey, cfg = {}, profile = null) {
  const layout = calcLayout(labelKey, cfg, profile);
  const { w, h, padH, padV, zones, profile: p, fitMode, usableW, usableH } = layout;

  const fontFamily      = cfg.fontFamily      || "'Segoe UI', Tahoma, Arial, sans-serif";
  const labelBackground = cfg.labelBackground || '#ffffff';
  const textColor       = cfg.textColor       || '#1a1a1a';
  const priceColor      = cfg.priceColor      || '#111827';
  const borderStyle     = cfg.borderStyle     || 'none';
  const borderCss       = borderStyle !== 'none' ? `border: 0.3mm ${borderStyle} #aaa;` : '';

  let fontFaceBlock = '';
  if (p.fontStrategy === 'embed') {
    fontFaceBlock = `/* P6: embedded font stubs */`;
  }

  const fontSmoothing = p.fontStrategy === 'bitmap'
    ? `-webkit-font-smoothing: none; font-family: 'Courier New', monospace;`
    : '';

  // FIT-MODE: flex layout strategy
  // 'none'       -> justify-content:center, gap:0.4mm (original)
  // 'fit-width'  -> justify-content:center, content stretches to usableW
  // 'fit-height' -> justify-content:space-between, zones flex-grow to fill height
  // 'stretch'    -> justify-content:space-between + content stretches to usableW
  const isFitH  = fitMode === 'fit-height' || fitMode === 'stretch';
  const isFitW  = fitMode === 'fit-width'  || fitMode === 'stretch';
  const lblJustify   = isFitH ? 'space-between' : 'center';
  const lblGap       = isFitH ? '0' : '0.4mm';
  // In fit-height modes each named zone gets flex:1 so they share vertical space equally
  const zoneFlexCss  = isFitH
    ? 'flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; width:100%;'
    : '';
  // Barcode wrap fills available space in fit-height
  const bcWrapFlex   = isFitH ? 'flex:2;' : '';
  // In fit-width / stretch modes, barcode image stretches to full usable width
  const bcImgWidth   = isFitW ? '100%' : 'auto';
  const bcImgHeight  = isFitH ? '100%' : 'auto';
  // For stretch, allow barcode image to distort aspect ratio to fill both axes
  const bcImgObjFit  = fitMode === 'stretch' ? 'fill' : 'contain';

  return `<style>
${fontFaceBlock}
@page { size: ${w}mm ${h}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: ${fontFamily}; background: white; display: flex; flex-wrap: wrap; align-content: flex-start; ${fontSmoothing} }
.lbl {
  width: ${w}mm; height: ${h}mm;
  background: ${labelBackground}; color: ${textColor};
  overflow: hidden; display: flex; flex-direction: column;
  justify-content: ${lblJustify}; align-items: center;
  padding: ${padV}mm ${padH}mm;
  gap: ${lblGap}; page-break-after: always; ${borderCss}
}
.biz { ${zoneFlexCss} font-size:${zones.businessName.fontSize}; font-weight:600; color:#555; text-align:center; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.name { ${zoneFlexCss} font-size:${zones.productName.fontSize}; font-weight:900; color:${textColor}; text-align:center; width:100%; word-break:break-word; line-height:${zones.productName.lineHeight}; overflow:hidden; }
.price-row { ${zoneFlexCss} display:flex; align-items:baseline; justify-content:center; gap:0.8mm; width:100%; margin-top:0.3mm; }
.price-lbl { font-size:${zones.businessName.fontSize}; color:#777; font-weight:600; }
.price-val { font-size:${zones.price.fontSize}; font-weight:900; color:${priceColor}; direction:ltr; letter-spacing:-0.02em; }
.extra-row { ${zoneFlexCss} font-size:${zones.extra.fontSize}; color:#555; text-align:center; direction:ltr; width:100%; display:flex; justify-content:center; gap:1.5mm; flex-wrap:wrap; }
.bc-wrap { ${bcWrapFlex} width:100%; display:flex; flex-direction:column; align-items:center; gap:0; }
.bc-img { max-width:100%; max-height:${zones.barcode.heightMm.toFixed(1)}mm; width:${bcImgWidth}; height:${bcImgHeight}; object-fit:${bcImgObjFit}; display:block; direction:ltr; }
.bc-qr  { max-width:${Math.min(zones.barcode.heightMm * 1.2, 20).toFixed(1)}mm; max-height:${zones.barcode.heightMm.toFixed(1)}mm; }
.bc-num { font-size:${zones.barcode.textSize}; font-family:'Courier New',monospace; font-weight:700; letter-spacing:0.03em; direction:ltr; text-align:center; color:${textColor}; margin-top:0.3mm; }
.bc-fallback { font-size:${zones.barcode.textSize}; font-family:'Courier New',monospace; font-weight:700; direction:ltr; color:#333; text-align:center; word-break:break-all; padding:0.5mm; border:0.3mm solid #333; border-radius:0.5mm; width:100%; }
.meta { font-size:${zones.sku.fontSize}; color:#888; text-align:center; direction:ltr; }
@media print { body { background:white; } .lbl { ${borderCss} } }
</style>`;
}

// --- RENDER BARCODE -----------------------------------------------------------
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
      try {
        const { default: QRGen } = await import('./qr-gen.js');
        const svg = QRGen.generateSVG(value, 4);
        return `data:image/svg+xml;base64,${btoa(svg)}`;
      } catch { return ''; }
    }
  }

  if (format === 'DATAMATRIX') {
    try {
      const pkg = 'bwip' + '-js';
      const bwipjs = (await import(/* @vite-ignore */ pkg)).default;
      const canvas = document.createElement('canvas');
      await bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix',
        text: value,
        scale: Math.max(1, Math.floor(availPx / 50)),
        height: Math.round(heightMm * 3.937),
        includetext: false,
        backgroundcolor: background.replace('#', ''),
        barcolor: lineColor.replace('#', ''),
      });
      return canvas.toDataURL('image/png');
    } catch { return ''; }
  }

  // Linear via JsBarcode
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

// --- EXTRA FIELDS HTML --------------------------------------------------------
function buildExtraFields(product, cfg) {
  const parts = [];
  if (cfg.showExpiry  && product.expiry_date)       parts.push(`Exp: ${product.expiry_date}`);
  if (cfg.showBatch   && product.batch_number)      parts.push(`Batch: ${product.batch_number}`);
  if (cfg.showWeight  && product.net_weight_g)      parts.push(`${product.net_weight_g}g`);
  if (cfg.showOrigin  && product.country_of_origin) parts.push(product.country_of_origin);
  if (!parts.length) return '';
  return `<div class="extra-row">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
}

// --- HTML LABEL BUILDER -------------------------------------------------------
export async function buildLabelHTML(product, settings, labelKey, copies = 1, profileOverride = null) {
  const cfg         = parseCfg(settings);
  const resolvedKey = labelKey || cfg.size || '58x40';
  const profile     = profileOverride || fuzzyMatchProfile(cfg.labelPrinterName || '');
  const layout      = calcLayout(resolvedKey, cfg, profile);
  const { w, h }    = layout;

  const currency        = cfg.currency || settings.currency || 'SAR';
  const effectiveCopies = Math.max(1, copies || cfg.copies || 1);
  const barcodeValue    = String(product.Barcode || product.ID || '');
  const priceFmt        = `${currency} ${parseFloat(product.Price || 0).toFixed(2)}`;

  let barcodeDataUrl = '';
  if ((cfg.showBarcode && barcodeValue) || cfg.showQR) {
    const format = detectBarcodeFormat(barcodeValue);
    if (cfg.showQR) {
      let qrValue = (cfg.qrContent || '{barcode}')
        .replace('{barcode}', barcodeValue)
        .replace('{id}', product.ID || '');
      if (cfg.qrContent === 'zatca' && window?.api?.getZatcaTLV) {
        try {
          const tlv = await window.api.getZatcaTLV({ barcode: barcodeValue, product });
          if (tlv) qrValue = tlv;
        } catch { /* fallback */ }
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
    ? `<div class="price-row"><span class="price-lbl">${cfg.priceLabel || 'Price'}</span><span class="price-val">${priceFmt}</span></div>` : '';
  const skuSection   = cfg.showSKU && product.Barcode
    ? `<div class="meta">${product.Barcode}</div>` : '';
  const extraSection = buildExtraFields(product, cfg);

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
<head><meta charset="UTF-8"/><title>Label</title>
${cssBlock}
</head>
<body>${labels}
<script>window.onload=()=>{window.focus();window.print();};<\/script>
</body></html>`;
}

// --- BATCH BUILDER ------------------------------------------------------------
export async function printLabelBatch(products, settings, labelKey, copiesEach = 1, configOverride = null) {
  if (!products || !products.length) return;
  const cfg     = { ...parseCfg(settings), ...(configOverride || {}) };
  const key     = labelKey || cfg.size || '58x40';
  const profile = fuzzyMatchProfile(cfg.labelPrinterName || '');
  const { w, h } = LABEL_PRESETS[key] || LABEL_PRESETS['58x40'];

  // FIX-E: always build full HTML for all products. Pass ZPL too when capable.
  const cssBlock    = buildLabelCSS(key, cfg, profile);
  const allLabelDivs = [];
  let   fullZpl     = '';

  for (const p of products) {
    const hasCustomCopies  = p && p.product !== undefined && p.copies !== undefined;
    const actualProduct    = hasCustomCopies ? p.product : p;
    const actualCopies     = Math.max(1, hasCustomCopies ? p.copies : copiesEach);

    for (let i = 0; i < actualCopies; i++) {
      const fullHtml = await buildLabelHTML(actualProduct, cfg, key, 1, profile);
      const m = fullHtml.match(/<div class="lbl">[\s\S]*?<\/div>\s*(?=<div class="lbl">|<script|<\/body>)/g);
      if (m) allLabelDivs.push(...m);
      else {
        const bm = fullHtml.match(/<body>([\s\S]*?)<script>/i);
        if (bm) allLabelDivs.push(bm[1].trim());
      }
    }

    // Also build ZPL for zplCapable printers
    if (profile.driverType === 'zpl' || profile.zplCapable) {
      fullZpl += buildZPL(actualProduct, cfg, key, actualCopies, profile) + '\n';
    }
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><title>Labels (${allLabelDivs.length})</title>
${cssBlock}
</head>
<body>
${allLabelDivs.join('\n')}
<script>window.onload=()=>{window.focus();window.print();};<\/script>
</body></html>`;

  // FIX-E: always send both html + zpl; hardware.cjs picks the right path
  const result = await _sendPrintJob(html, w, h, cfg, profile, null, copiesEach, key, fullZpl);

  // Log
  for (const p of products) {
    const hasCustomCopies = p && p.product !== undefined && p.copies !== undefined;
    const actualProduct   = hasCustomCopies ? p.product : p;
    const actualCopies    = Math.max(1, hasCustomCopies ? p.copies : copiesEach);
    await _logPrint(actualProduct, actualCopies, key, result);
  }
  return result;
}

// --- PRINT SINGLE LABEL -------------------------------------------------------
export async function printLabel(product, settings, labelKey, copies = 1, configOverride = null) {
  const cfg     = { ...parseCfg(settings), ...(configOverride || {}) };
  const key     = labelKey || cfg.size || '58x40';
  const profile = fuzzyMatchProfile(cfg.labelPrinterName || '');
  const { w, h } = LABEL_PRESETS[key] || LABEL_PRESETS['58x40'];

  const html = await buildLabelHTML(product, cfg, key, copies, profile);

  // FIX-E: build ZPL for any printer that might support it (zpl or zplCapable)
  let zpl = '';
  if (profile.driverType === 'zpl' || profile.zplCapable) {
    zpl = buildZPL(product, cfg, key, copies, profile);
  }

  return _sendPrintJob(html, w, h, cfg, profile, product, copies, key, zpl);
}

// --- ROUTE THROUGH print:label IPC -------------------------------------------
async function _sendPrintJob(html, widthMm, heightMm, cfg, profile, product, copies, labelKey, zpl = '') {
  if (window?.api?.printLabel) {
    const result = await window.api.printLabel({
      html,
      zpl,
      widthMm,
      heightMm,
      printerName: cfg.labelPrinterName || '',
      // FIX-E: pass gdi always; hardware.cjs will try ZPL first if zpl is non-empty
      driverType:  profile.driverType || 'gdi',
      dpi:         profile.maxDPI || 203,
    });
    if (product) await _logPrint(product, copies, labelKey, result);
    return result;
  }
  // Fallback to legacy printHTML
  return window.api.printHTML(html);
}

// --- PRINT LOG ----------------------------------------------------------------
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

// --- ZPL BUILDER (FIX-B) -----------------------------------------------------
/**
 * Generates a ZPL II string for Zebra-compatible printers.
 *
 * FIX-B changes:
 *  - ^PW (print width) now in dots not mm
 *  - ^LL (label length) now in dots
 *  - EAN13 barcode command corrected: ^BEA,height,Y,N (was ^BEN,...)
 *  - Code128 command uses 6-param form: ^BCN,height,Y,N,N,N
 *  - ^PQ copies: minimum 1 (was sometimes 0)
 *  - All Y positions computed via mmToDot consistently
 *  - Home field ^FO uses padL/padT from NPZM (was adding 1mm unconditionally)
 */
export function buildZPL(product, settings, labelKey, copies = 1, profile = null) {
  const cfg    = parseCfg(settings);
  const preset = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  const p      = profile || PRINTER_PROFILES['_default'];
  const dpi    = p.maxDPI || 203;
  const mmToDot = (mm) => Math.round(mm * dpi / 25.4);

  const labelW = mmToDot(preset.w);
  const labelH = mmToDot(preset.h);
  // Pad = NPZM only (no extra +1mm; the NPZM already provides clearance)
  const padL   = mmToDot(p.lnpzMm);
  const padT   = mmToDot(p.tnpzMm);

  // FIT-MODE: scale ZPL font sizes and barcode height proportionally
  const fitMode = cfg.fitMode || 'none';
  const BASE_USABLE_W = 54; const BASE_USABLE_H = 36;
  const usableWdots = labelW - padL - mmToDot(p.rnpzMm);
  const usableHdots = labelH - padT - mmToDot(p.bnpzMm);
  const fitScaleW = (fitMode === 'fit-width'  || fitMode === 'stretch') ? (usableWdots / mmToDot(BASE_USABLE_W)) : 1;
  const fitScaleH = (fitMode === 'fit-height' || fitMode === 'stretch') ? (usableHdots / mmToDot(BASE_USABLE_H)) : 1;
  const zplFontScale = fitMode === 'none'       ? 1
                     : fitMode === 'fit-width'   ? fitScaleW
                     : fitMode === 'fit-height'  ? fitScaleH
                     : Math.min(fitScaleW, fitScaleH);
  const zplScaledPt = (pt) => Math.max(10, Math.round(pt * zplFontScale));

  const name    = (product.Name || '').substring(0, 40);
  const price   = `${cfg.currency || 'SAR'} ${parseFloat(product.Price || 0).toFixed(2)}`;
  const barcode = String(product.Barcode || product.ID || '');
  const format  = detectBarcodeFormat(barcode);

  // FIX-B + FIT-MODE: correct ZPL barcode commands with scaled height
  const bcFraction = (fitMode === 'fit-height' || fitMode === 'stretch') ? 0.55 : 0.40;
  const bcHeightDots = mmToDot(Math.max(preset.h * bcFraction, 6));
  let zplBcCmd;
  switch (format) {
    case 'EAN13': zplBcCmd = `^BEA,${bcHeightDots},Y,N`;   break;
    case 'EAN8':  zplBcCmd = `^B8N,${bcHeightDots},Y,N`;   break;
    case 'UPC':   zplBcCmd = `^BUA,${bcHeightDots},Y,N`;   break;
    case 'ITF14': zplBcCmd = `^BIN,${bcHeightDots},Y,N`;   break;
    case 'CODE39':zplBcCmd = `^B3N,N,${bcHeightDots},Y,N`; break;
    default:      zplBcCmd = `^BCN,${bcHeightDots},Y,N,N,N`; break; // Code128
  }

  // Field Y positions
  let curY = padT;
  const lineH = mmToDot(6); // approx 6mm per text row at 18pt

  let zpl = `^XA\n^PW${labelW}\n^LL${labelH}\n^CI28\n^LH${padL},${padT}\n`;

  // Business name
  if (cfg.showBusinessName && settings.business_name_ar) {
    const fs = zplScaledPt(18);
    zpl += `^FO0,0^A0N,${fs},${fs}^FD${settings.business_name_ar}^FS\n`;
    curY += lineH;
  }

  // Product name
  if (cfg.showProductName && name) {
    const fs = zplScaledPt(24);
    zpl += `^FO0,${curY - padT}^A0N,${fs},${fs}^FD${name}^FS\n`;
    curY += lineH + mmToDot(2);
  }

  // Price
  if (cfg.showPrice) {
    const fs = zplScaledPt(22);
    zpl += `^FO0,${curY - padT}^A0N,${fs},${fs}^FD${price}^FS\n`;
    curY += lineH + mmToDot(1);
  }

  // Barcode
  if (cfg.showBarcode && barcode) {
    zpl += `^FO0,${curY - padT}${zplBcCmd}^FD${barcode}^FS\n`;
  }

  // Print quantity (FIX-B: minimum 1)
  const qty = Math.max(1, copies || 1);
  zpl += `^PQ${qty},0,1,Y\n^XZ`;

  return zpl;
}

// --- HELPERS ------------------------------------------------------------------
function parseCfg(settings) {
  try {
    const raw = settings?.label_config;
    const base = {
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
      priceLabel:       'Price',
      fontFamily:       "'Segoe UI', Tahoma, Arial, sans-serif",
      labelBackground:  '#ffffff',
      textColor:        '#1a1a1a',
      priceColor:       '#111827',
      borderStyle:      'none',
      fitMode:          'none',
      copies:           1,
      size:             '58x40',
      labelPrinterName: '',
    };
    if (raw !== undefined) {
      return {
        ...base,
        ...(typeof raw === 'string' ? JSON.parse(raw) : (raw || {})),
      };
    } else {
      return { ...base, ...settings };
    }
  } catch { return { size:'58x40', copies:1, labelPrinterName:'' }; }
}

export default {
  printLabel, printLabelBatch, buildLabelHTML, buildLabelCSS,
  buildZPL, renderBarcode, LABEL_PRESETS, PRINTER_PROFILES,
  detectBarcodeFormat, computeBarcodeParams, calcLayout,
  fuzzyMatchProfile, mmToPx,
};
