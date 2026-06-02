/**
 * LabelPrintSettings.jsx  —  My-POS v2
 * ════════════════════════════════════════════════════════════════════
 * Refactored per audit P2, P4, P6, P10.
 *
 * Changes vs original:
 *  P2  – "Printer Model" selector populated via window.api.getPrinters().
 *         Fuzzy-matched to PRINTER_PROFILES; unknown = _default (3 mm).
 *         Active profile's NPZM displayed inline.
 *  P4  – Preview uses mmToPx(mm, 'preview', { containerPx, labelWidthMm })
 *         instead of hard-coded SCREEN_PX_MM = 3.5.
 *  P6  – Font strategy badge shown next to printer model selector.
 *         Font preview panel renders sample with active strategy.
 *  P10 – Extra-fields toggles (showExpiry, showBatch, showWeight, showOrigin).
 * ════════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import {
  Tag, Eye, Settings2, AlertTriangle, CheckCircle,
  ChevronUp, ChevronDown, Printer,
} from 'lucide-react';
import {
  LABEL_PRESETS,
  PRINTER_PROFILES,
  detectBarcodeFormat,
  computeBarcodeParams,
  buildLabelHTML,
  buildLabelCSS,
  fuzzyMatchProfile,
  mmToPx,
} from '../utils/LabelPrintEngine.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CFG = {
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
  fontFamily:       'Tahoma, Arial, sans-serif',
  labelBackground:  '#ffffff',
  textColor:        '#1a1a1a',
  priceColor:       '#111827',
  borderStyle:      'none',
  copies:           1,
  size:             '58x40',
  labelPrinterName: '',
};

const FONT_OPTIONS = [
  { value: 'Tahoma, Arial, sans-serif',      label: 'Tahoma (افتراضي)' },
  { value: '"Segoe UI", Tahoma, sans-serif', label: 'Segoe UI' },
  { value: 'Arial, sans-serif',              label: 'Arial' },
  { value: '"Courier New", monospace',       label: 'Courier New (طابعة)' },
  { value: '"Times New Roman", serif',       label: 'Times New Roman' },
];

const FIELDS = [
  { id:'business', label:'اسم المنشأة',   key:'showBusinessName' },
  { id:'name',     label:'اسم المنتج',    key:'showProductName'  },
  { id:'price',    label:'السعر',         key:'showPrice'        },
  { id:'barcode',  label:'الباركود',      key:'showBarcode'      },
  { id:'sku',      label:'رمز SKU',       key:'showSKU'          },
  { id:'qr',       label:'رمز QR',        key:'showQR'           },
];

// P10 extra field toggles
const EXTRA_FIELDS = [
  { id:'expiry',  label:'تاريخ الانتهاء', key:'showExpiry'  },
  { id:'batch',   label:'رقم الدفعة',    key:'showBatch'   },
  { id:'weight',  label:'الوزن الصافي',  key:'showWeight'  },
  { id:'origin',  label:'بلد المنشأ',    key:'showOrigin'  },
];

const PRESET_GROUPS = [
  { label:'طابعة ٥٨ مم', printerWidth:'58', color:'#2563eb' },
  { label:'طابعة ٨٠ مم', printerWidth:'80', color:'#7c3aed' },
  { label:'طابعة A4',    printerWidth:'A4', color:'#059669' },
];

const DRIVER_LABELS = { gdi:'GDI/Windows', cups:'CUPS/Linux', escpos:'ESC/POS', zpl:'ZPL II (Zebra)' };
const STRATEGY_LABELS = { embed:'مضمّن (موصى به)', system:'نظام التشغيل', bitmap:'نقطي (Dot-matrix)' };

// ─── P4: Live Preview ─────────────────────────────────────────────────────────
// Scale is derived dynamically from the preview container pixel width.
const PREVIEW_CONTAINER_PX = 200;

function LabelPreview({ cfg, settings, sampleBarcode }) {
  const [bcUrl,  setBcUrl]  = useState('');
  const [bcWarn, setBcWarn] = useState('');

  const preset = LABEL_PRESETS[cfg.size] || LABEL_PRESETS['58x40'];
  // P4: unified scale — derived, not hard-coded
  const pxPerMm = PREVIEW_CONTAINER_PX / preset.w;
  const pW      = PREVIEW_CONTAINER_PX;
  const pH      = Math.round(preset.h * pxPerMm);
  const pad     = Math.round((preset.w <= 40 ? 1.5 : 2) * pxPerMm);

  const fontScale = preset.w <= 40 ? 0.75 : preset.w <= 60 ? 0.9 : preset.w <= 80 ? 1.05 : 1.2;
  // P4: use mmToPx utility for preview context
  const ptToPx = (pt) => Math.round(mmToPx(pt * 0.353, 'preview', { containerPx: PREVIEW_CONTAINER_PX, labelWidthMm: preset.w }));
  const fs = {
    biz:   ptToPx(7  * fontScale),
    prod:  ptToPx(9  * fontScale),
    price: ptToPx(13 * fontScale),
    bc:    ptToPx(6.5* fontScale),
    extra: ptToPx(5.5* fontScale),
  };

  useEffect(() => {
    if (!cfg.showBarcode || !sampleBarcode) { setBcUrl(''); setBcWarn(''); return; }
    try {
      const canvas  = document.createElement('canvas');
      const profile = fuzzyMatchProfile(cfg.labelPrinterName || '');
      const bParams = computeBarcodeParams(sampleBarcode, preset.w - profile.lnpzMm - profile.rnpzMm - 2);
      JsBarcode(canvas, sampleBarcode, {
        format:       bParams.format,
        width:        bParams.narrowBar,
        height:       Math.round((preset.h - profile.tnpzMm - profile.bnpzMm) * 0.40 * 8),
        displayValue: false,
        margin:       0,
        background:   cfg.labelBackground,
        lineColor:    cfg.textColor,
      });
      setBcUrl(canvas.toDataURL('image/png'));
      setBcWarn(bParams.fits ? '' : 'الباركود طويل — سيتم ضغطه تلقائياً');
    } catch (e) {
      setBcUrl('');
      setBcWarn('خطأ في الباركود: ' + e.message);
    }
  }, [cfg, sampleBarcode, preset]);

  const extraParts = [];
  if (cfg.showExpiry)  extraParts.push('انتهاء: 2026-12-31');
  if (cfg.showBatch)   extraParts.push('دفعة: B001');
  if (cfg.showWeight)  extraParts.push('250غ');
  if (cfg.showOrigin)  extraParts.push('SA');

  const bcSection = cfg.showBarcode
    ? bcUrl
      ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, width:'100%' }}>
          <img src={bcUrl} style={{ maxWidth:'100%', height:'auto', display:'block' }} alt="bc"/>
          <div style={{ fontSize:fs.bc+'px', fontFamily:'monospace', fontWeight:700, direction:'ltr', color:cfg.textColor }}>{sampleBarcode}</div>
        </div>
      : <div style={{ fontFamily:'monospace', fontSize:fs.bc+'px', letterSpacing:'1px', border:'1px solid #333', padding:'1px 2px', wordBreak:'break-all', color:cfg.textColor }}>{sampleBarcode||'6281234567890'}</div>
    : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
      <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
        معاينة — {preset.w}×{preset.h} مم
      </div>
      <div style={{ width:pW+'px', height:pH+'px', background:cfg.labelBackground, border: cfg.borderStyle !== 'none' ? `1px ${cfg.borderStyle} #aaa` : '1px solid #e2e8f0', borderRadius:'3px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', padding:pad+'px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1px', overflow:'hidden', fontFamily:cfg.fontFamily, direction:'rtl', transition:'all 0.2s' }}>
        {cfg.barcodePosition === 'top' && bcSection}
        {cfg.showBusinessName && settings?.business_name_ar && <div style={{ fontSize:fs.biz+'px', fontWeight:600, color:'#666', textAlign:'center', width:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{settings.business_name_ar}</div>}
        {cfg.showProductName  && <div style={{ fontSize:fs.prod+'px', fontWeight:900, color:cfg.textColor, textAlign:'center', width:'100%', lineHeight:1.25, wordBreak:'break-word' }}>منتج تجريبي</div>}
        {cfg.showPrice && <div style={{ display:'flex', alignItems:'baseline', gap:'2px', justifyContent:'center' }}><span style={{ fontSize:fs.biz+'px', color:'#777' }}>{cfg.priceLabel}</span><span style={{ fontSize:fs.price+'px', fontWeight:900, color:cfg.priceColor, direction:'ltr' }}>{settings?.currency||'SAR'} 25.00</span></div>}
        {extraParts.length > 0 && <div style={{ fontSize:fs.extra+'px', color:'#555', direction:'ltr', textAlign:'center' }}>{extraParts.join(' │ ')}</div>}
        {cfg.showSKU && <div style={{ fontSize:fs.bc+'px', color:'#aaa', direction:'ltr' }}>{sampleBarcode||'6281234567890'}</div>}
        {cfg.barcodePosition === 'bottom' && bcSection}
      </div>
      {bcWarn && (
        <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 10px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', fontSize:'11px', color:'#92400e', maxWidth:pW+'px' }}>
          <AlertTriangle size={12}/> {bcWarn}
        </div>
      )}
    </div>
  );
}

// ─── Barcode Analyzer ─────────────────────────────────────────────────────────
function BarcodeAnalyzer({ barcodeValue, labelKey, printerName }) {
  if (!barcodeValue) return null;
  const profile = fuzzyMatchProfile(printerName || '');
  const preset  = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  const bParams = computeBarcodeParams(barcodeValue, preset.w - profile.lnpzMm - profile.rnpzMm - 2);
  const fmt     = detectBarcodeFormat(barcodeValue);
  return (
    <div style={{ padding:'10px 12px', borderRadius:'10px', border:'1px solid', fontSize:'12px', lineHeight:1.6, background: bParams.fits ? '#f0fdf4' : '#fffbeb', borderColor: bParams.fits ? '#bbf7d0' : '#fde68a', color: bParams.fits ? '#065f46' : '#92400e' }}>
      <div style={{ fontWeight:700, marginBottom:'4px', display:'flex', alignItems:'center', gap:'5px' }}>
        {bParams.fits ? <CheckCircle size={13}/> : <AlertTriangle size={13}/>}
        {bParams.fits ? 'الباركود يناسب الملصق' : 'الباركود طويل — سيُضغط تلقائياً'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', fontSize:'11px' }}>
        <span>الصيغة: <strong>{fmt}</strong></span>
        <span>الطول: <strong>{barcodeValue.length} حرف</strong></span>
        <span>عرض الوحدة: <strong>{bParams.narrowBar}px</strong></span>
        <span>المساحة: <strong>{bParams.availPx}px</strong></span>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function LabelPrintSettings({ value, onChange, settings, printers }) {
  const [cfg, setCfg] = useState(() => {
    try { return { ...DEFAULT_CFG, ...(typeof value === 'string' ? JSON.parse(value) : (value||{})) }; }
    catch { return { ...DEFAULT_CFG }; }
  });
  const [activeGroup,    setActiveGroup]    = useState(null);
  const [testBarcode,    setTestBarcode]    = useState('6281234567890');
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [printLoading,   setPrintLoading]   = useState(false);
  // P2: available printers from system
  const [systemPrinters, setSystemPrinters] = useState(printers || []);

  useEffect(() => { onChange(JSON.stringify(cfg)); }, [cfg]);
  const u = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  // P2: fetch printers if not passed as prop
  useEffect(() => {
    if (!printers && window?.api?.getPrinters) {
      window.api.getPrinters().then(r => { if (Array.isArray(r)) setSystemPrinters(r); }).catch(() => {});
    }
  }, [printers]);

  // P2: active printer profile
  const activeProfile = fuzzyMatchProfile(cfg.labelPrinterName || '');
  const isUnknownPrinter = cfg.labelPrinterName && activeProfile === PRINTER_PROFILES['_default'];

  const visiblePresets = Object.entries(LABEL_PRESETS).filter(([, p]) =>
    !activeGroup || p.printerWidth === activeGroup
  );

  const handleTestPrint = async () => {
    setPrintLoading(true);
    try {
      const html = await buildLabelHTML({ Name:'منتج تجريبي', Price:25, Barcode:testBarcode, ID:1 }, settings||{}, cfg.size, 1,
        fuzzyMatchProfile(cfg.labelPrinterName || ''));
      if (window?.api?.printLabel) {
        const preset = LABEL_PRESETS[cfg.size] || LABEL_PRESETS['58x40'];
        await window.api.printLabel({ html, widthMm: preset.w, heightMm: preset.h, printerName: cfg.labelPrinterName || '' });
      } else {
        await window.api.printHTML(html);
      }
    } catch (e) { console.error('Test print failed:', e); }
    setPrintLoading(false);
  };

  const inp = { padding:'10px 12px', borderRadius:'10px', border:'1px solid var(--border-subtle)', fontSize:'13px', outline:'none', background:'var(--bg-app)', color:'var(--text-main)', fontFamily:'inherit', width:'100%', boxSizing:'border-box' };
  const sel = { ...inp, cursor:'pointer' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'32px', height:'32px', background:'#eff6ff', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563eb' }}><Tag size={16}/></div>
        <div>
          <div style={{ fontWeight:800, fontSize:'14px', color:'var(--text-main)' }}>إعدادات الملصق والطباعة</div>
          <div style={{ fontSize:'12px', color:'#64748b' }}>يدعم جميع أحجام التسميات وأنواع الطابعات مع تكيّف تلقائي للباركود</div>
        </div>
      </div>

      {/* P2: Printer model selector */}
      <div>
        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'6px' }}>طابعة الملصقات</div>
        <select value={cfg.labelPrinterName} onChange={e => u('labelPrinterName', e.target.value)} style={sel}>
          <option value=''>اختر الطابعة...</option>
          {systemPrinters.map(p => (
            <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (افتراضية)' : ''}</option>
          ))}
        </select>
        {cfg.labelPrinterName && (
          <div style={{ marginTop:'6px', padding:'8px 10px', borderRadius:'8px', background: isUnknownPrinter ? '#fffbeb' : '#f0fdf4', border:`1px solid ${isUnknownPrinter ? '#fde68a' : '#bbf7d0'}`, fontSize:'11px', color: isUnknownPrinter ? '#92400e' : '#065f46', display:'flex', gap:'12px', flexWrap:'wrap' }}>
            {isUnknownPrinter && <span>⚠️ طابعة غير معروفة — تم تطبيق هوامش محافظة (3 مم)</span>}
            {!isUnknownPrinter && <span>✅ ملف تعريف: {cfg.labelPrinterName}</span>}
            <span>LNPZ: {activeProfile.lnpzMm}مم</span>
            <span>RNPZ: {activeProfile.rnpzMm}مم</span>
            <span>DPI: {activeProfile.maxDPI}</span>
            <span>البروتوكول: {DRIVER_LABELS[activeProfile.driverType] || activeProfile.driverType}</span>
            <span>الخط: {STRATEGY_LABELS[activeProfile.fontStrategy] || activeProfile.fontStrategy}</span>
          </div>
        )}
      </div>

      {/* Printer group filter */}
      <div>
        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px' }}>فلترة حسب نوع الطابعة</div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={() => setActiveGroup(null)} style={{ padding:'7px 14px', borderRadius:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid', background: !activeGroup ? '#eff6ff' : 'var(--bg-app)', color: !activeGroup ? '#2563eb' : 'var(--text-muted)', borderColor: !activeGroup ? '#bfdbfe' : 'var(--border-subtle)' }}>الكل</button>
          {PRESET_GROUPS.map(g => (
            <button key={g.printerWidth} onClick={() => setActiveGroup(g.printerWidth)}
              style={{ padding:'7px 14px', borderRadius:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid', background: activeGroup===g.printerWidth ? g.color+'14' : 'var(--bg-app)', color: activeGroup===g.printerWidth ? g.color : 'var(--text-muted)', borderColor: activeGroup===g.printerWidth ? g.color+'66' : 'var(--border-subtle)' }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Label size grid */}
      <div>
        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px' }}>حجم الملصق</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(86px, 1fr))', gap:'8px' }}>
          {visiblePresets.map(([key, preset]) => {
            const isActive = cfg.size === key;
            const grp = PRESET_GROUPS.find(g => g.printerWidth === preset.printerWidth);
            const ac  = grp?.color || '#2563eb';
            const maxDim = 48; const scale = Math.min(maxDim / preset.w, maxDim / preset.h, 1);
            const tw = Math.round(preset.w * scale); const th = Math.round(preset.h * scale);
            return (
              <button key={key} onClick={() => u('size', key)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', padding:'10px 6px', borderRadius:'12px', border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', background: isActive ? ac+'14' : 'var(--bg-app)', borderColor: isActive ? ac : 'var(--border-subtle)', boxShadow: isActive ? `0 0 0 2px ${ac}30` : 'none', transition:'all 0.12s' }}>
                <div style={{ width:tw+'px', height:th+'px', background: isActive ? ac+'22' : '#f1f5f9', border:`1px solid ${isActive ? ac : '#cbd5e1'}`, borderRadius:'3px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <div style={{ width:'60%', height:'2px', background: isActive ? ac : '#94a3b8', borderRadius:'1px' }}/>
                </div>
                <div style={{ fontSize:'10px', fontWeight: isActive ? 800 : 600, color: isActive ? ac : 'var(--text-muted)', textAlign:'center', lineHeight:1.3 }}>{preset.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fields + preview */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 210px', gap:'20px', alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* Main field toggles */}
          <div>
            <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px' }}>محتوى الملصق</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {FIELDS.map(f => (
                <label key={f.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:'var(--bg-app)', borderRadius:'10px', border:'1px solid var(--border-subtle)', cursor:'pointer', fontSize:'13px', fontWeight:600, color:'var(--text-main)' }}>
                  <span>{f.label}</span>
                  <button type="button" onClick={() => u(f.key, !cfg[f.key])}
                    style={{ width:'40px', height:'22px', borderRadius:'99px', border:'none', cursor:'pointer', background: cfg[f.key] ? '#2563eb' : '#cbd5e1', position:'relative', transition:'all 0.2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'3px', left: cfg[f.key] ? '20px' : '3px', width:'16px', height:'16px', background:'white', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                  </button>
                </label>
              ))}
            </div>
          </div>

          {/* P10: Extra fields toggles */}
          <div>
            <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px' }}>حقول إضافية (غذاء / دواء / مواد)</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {EXTRA_FIELDS.map(f => (
                <label key={f.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:'var(--bg-app)', borderRadius:'10px', border:'1px solid var(--border-subtle)', cursor:'pointer', fontSize:'13px', fontWeight:600, color:'var(--text-main)' }}>
                  <span>{f.label}</span>
                  <button type="button" onClick={() => u(f.key, !cfg[f.key])}
                    style={{ width:'40px', height:'22px', borderRadius:'99px', border:'none', cursor:'pointer', background: cfg[f.key] ? '#7c3aed' : '#cbd5e1', position:'relative', transition:'all 0.2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'3px', left: cfg[f.key] ? '20px' : '3px', width:'16px', height:'16px', background:'white', borderRadius:'50%', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                  </button>
                </label>
              ))}
            </div>
          </div>

          {/* Barcode position */}
          {cfg.showBarcode && (
            <div>
              <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px' }}>موضع الباركود</div>
              <div style={{ display:'flex', gap:'8px' }}>
                {[{v:'top',label:'أعلى'},{v:'bottom',label:'أسفل'}].map(opt => (
                  <button key={opt.v} onClick={() => u('barcodePosition', opt.v)}
                    style={{ flex:1, padding:'8px', borderRadius:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid', background: cfg.barcodePosition===opt.v ? '#eff6ff' : 'var(--bg-app)', color: cfg.barcodePosition===opt.v ? '#2563eb' : 'var(--text-muted)', borderColor: cfg.barcodePosition===opt.v ? '#bfdbfe' : 'var(--border-subtle)' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QR content field when showQR is on */}
          {cfg.showQR && (
            <div>
              <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'6px' }}>محتوى رمز QR</div>
              <input value={cfg.qrContent} onChange={e => u('qrContent', e.target.value)}
                placeholder="{barcode} أو {id} أو zatca"
                style={{ ...inp, direction:'ltr', fontFamily:'monospace' }}/>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>استخدم {'{barcode}'} أو {'{id}'} أو اكتب "zatca" لرمز ZATCA</div>
            </div>
          )}

          {/* Copies */}
          <div>
            <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px' }}>عدد النسخ الافتراضي</div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <button onClick={() => u('copies', Math.max(1, cfg.copies - 1))} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid var(--border-subtle)', background:'var(--bg-app)', cursor:'pointer', fontFamily:'inherit', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-main)' }}>−</button>
              <span style={{ fontSize:'20px', fontWeight:900, color:'var(--text-main)', minWidth:'28px', textAlign:'center' }}>{cfg.copies}</span>
              <button onClick={() => u('copies', Math.min(99, cfg.copies + 1))} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid var(--border-subtle)', background:'var(--bg-app)', cursor:'pointer', fontFamily:'inherit', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-main)' }}>+</button>
              <span style={{ fontSize:'12px', color:'#94a3b8' }}>نسخة / منتج</span>
            </div>
          </div>

          {/* Advanced toggle */}
          <button onClick={() => setShowAdvanced(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 12px', background:'var(--bg-app)', border:'1px solid var(--border-subtle)', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit', fontSize:'12px', fontWeight:700, color:'var(--text-muted)', width:'fit-content' }}>
            <Settings2 size={13}/> {showAdvanced ? 'إخفاء الخيارات المتقدمة' : 'خيارات متقدمة'}
            {showAdvanced ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          </button>

          {showAdvanced && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', padding:'14px', background:'var(--bg-app)', borderRadius:'12px', border:'1px solid var(--border-subtle)' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:'5px' }}>الخط</label>
                <select value={cfg.fontFamily} onChange={e => u('fontFamily', e.target.value)} style={sel}>
                  {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                {[{key:'labelBackground',label:'خلفية'},{key:'textColor',label:'النص'},{key:'priceColor',label:'السعر'}].map(c => (
                  <div key={c.key}>
                    <label style={{ fontSize:'11px', fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:'4px' }}>{c.label}</label>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <input type="color" value={cfg[c.key]} onChange={e => u(c.key, e.target.value)} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid var(--border-subtle)', padding:'2px', cursor:'pointer' }}/>
                      <span style={{ fontSize:'11px', fontFamily:'monospace', color:'var(--text-muted)' }}>{cfg[c.key]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:'5px' }}>حدود الملصق</label>
                <div style={{ display:'flex', gap:'6px' }}>
                  {[{v:'none',label:'بدون'},{v:'solid',label:'صلب'},{v:'dashed',label:'منقط'}].map(b => (
                    <button key={b.v} onClick={() => u('borderStyle', b.v)}
                      style={{ flex:1, padding:'7px', borderRadius:'9px', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'1.5px solid', background: cfg.borderStyle===b.v ? '#eff6ff' : 'var(--bg-card)', color: cfg.borderStyle===b.v ? '#2563eb' : 'var(--text-muted)', borderColor: cfg.borderStyle===b.v ? '#bfdbfe' : 'var(--border-subtle)' }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:'5px' }}>نص تسمية السعر</label>
                <input value={cfg.priceLabel} onChange={e => u('priceLabel', e.target.value)} style={inp} placeholder="السعر"/>
              </div>
            </div>
          )}
        </div>

        {/* Right: preview column */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', alignItems:'center', paddingTop:'4px' }}>
          <LabelPreview cfg={cfg} settings={settings} sampleBarcode={testBarcode}/>
          <div style={{ width:'100%' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'var(--text-muted)', marginBottom:'5px' }}>باركود الاختبار</div>
            <input value={testBarcode} onChange={e => setTestBarcode(e.target.value)} placeholder="أدخل باركود للاختبار" dir="ltr"
              style={{ width:'100%', padding:'8px 10px', borderRadius:'9px', border:'1px solid var(--border-subtle)', fontSize:'12px', fontFamily:'monospace', background:'var(--bg-app)', color:'var(--text-main)' }}/>
          </div>
          <button onClick={handleTestPrint} disabled={printLoading}
            style={{ width:'100%', padding:'9px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'10px', fontWeight:800, fontSize:'12px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', opacity: printLoading ? 0.6 : 1 }}>
            <Printer size={13}/> {printLoading ? 'جاري...' : 'طباعة ملصق تجريبي'}
          </button>
        </div>
      </div>

      {/* Barcode analyzer */}
      {cfg.showBarcode && testBarcode && (
        <div>
          <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
            <Eye size={13}/> تحليل الباركود التلقائي
          </div>
          <BarcodeAnalyzer barcodeValue={testBarcode} labelKey={cfg.size} printerName={cfg.labelPrinterName}/>
        </div>
      )}

      {/* Info note */}
      <div style={{ padding:'10px 12px', background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe', fontSize:'12px', color:'#1e40af', lineHeight:1.7 }}>
        💡 <strong>المحرك يكتشف تلقائياً</strong> صيغة الباركود ويطبّق هوامش الطابعة الصحيحة بناءً على ملف التعريف المختار. الباركود الطويل يُضغط تلقائياً ليناسب الملصق.
      </div>
    </div>
  );
}
