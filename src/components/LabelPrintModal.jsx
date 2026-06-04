/**
 * LabelPrintModal.jsx  —  My-POS v2
 * ════════════════════════════════════════════════════════════════════
 * Refactored per audit P3, P7, P9, P10.
 *
 * Changes vs original:
 *  P3  – Print routed through window.api.printLabel (new IPC), not printHTML.
 *  P7  – "Label Template" dropdown: fetches label_templates filtered by
 *         product.category_id; selected template's config_json overrides global.
 *  P9  – alert() replaced with ToastManager.  Retry queue sub-panel shows
 *         failed jobs from label_print_log.  "Reprint Last Label" shortcut.
 *  P10 – Extra fields panel (expiry, batch, weight, origin) rendered when
 *         toggles active in cfg; font auto-reduced on small layouts.
 * ════════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Printer, Tag, ChevronDown, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import {
  LABEL_PRESETS,
  buildLabelHTML,
  computeBarcodeParams,
  detectBarcodeFormat,
  fuzzyMatchProfile,
  printLabel,
} from '../utils/LabelPrintEngine.js';
import { useToast } from './ToastManager.jsx';

// ─── Mini Preview ─────────────────────────────────────────────────────────────
function MiniPreview({ product, settings, labelKey, cfg }) {
  const [bcUrl, setBcUrl] = useState('');
  const preset = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  // P4: derive scale from a fixed 200 px container width
  const containerPx = 200;
  const scale = containerPx / preset.w;

  useEffect(() => {
    if (!cfg.showBarcode || !product.Barcode) return;
    try {
      const canvas  = document.createElement('canvas');
      const bParams = computeBarcodeParams(String(product.Barcode), preset.w - 5);
      JsBarcode(canvas, String(product.Barcode), {
        format:       bParams.format,
        width:        bParams.narrowBar,
        height:       30,
        displayValue: true,
        fontSize:     8,
        textMargin:   2,
        margin:       0,
        background:   '#ffffff',
        lineColor:    '#111',
      });
      setBcUrl(canvas.toDataURL('image/png'));
    } catch { setBcUrl(''); }
  }, [product, cfg, labelKey]);

  const pW = Math.round(preset.w * scale);
  const pH = Math.round(preset.h * scale);
  const fs = {
    biz:   Math.max(6,  Math.round(9  * scale / (200/58))),
    prod:  Math.max(7,  Math.round(12 * scale / (200/58))),
    price: Math.max(8,  Math.round(14 * scale / (200/58))),
    sku:   Math.max(5,  Math.round(8  * scale / (200/58))),
    extra: Math.max(4,  Math.round(7  * scale / (200/58))),
  };

  const extraParts = [];
  if (cfg.showExpiry && product.expiry_date)     extraParts.push(`انتهاء: ${product.expiry_date}`);
  if (cfg.showBatch  && product.batch_number)    extraParts.push(`دفعة: ${product.batch_number}`);
  if (cfg.showWeight && product.net_weight_g)    extraParts.push(`${product.net_weight_g}غ`);
  if (cfg.showOrigin && product.country_of_origin) extraParts.push(product.country_of_origin);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
      <div style={{ width:pW+'px', height:pH+'px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'4px', boxShadow:'0 3px 12px rgba(0,0,0,0.08)', padding:'5px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px', overflow:'hidden', fontFamily: cfg.fontFamily||'Tahoma', direction:'rtl' }}>
        {cfg.showBusinessName && settings.business_name_ar && <div style={{ fontSize:fs.biz+'px', color:'#666', fontWeight:600, textAlign:'center', width:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{settings.business_name_ar}</div>}
        {cfg.showProductName  && <div style={{ fontSize:fs.prod+'px', fontWeight:900, color:'#1a1a1a', textAlign:'center', width:'100%', wordBreak:'break-word', lineHeight:1.2 }}>{product.Name}</div>}
        {cfg.showPrice && <div style={{ fontSize:fs.price+'px', fontWeight:900, color:'#1e3a8a', direction:'ltr' }}>{settings.currency||'SAR'} {parseFloat(product.Price||0).toFixed(2)}</div>}
        {extraParts.length > 0 && <div style={{ fontSize:fs.extra+'px', color:'#555', direction:'ltr', textAlign:'center' }}>{extraParts.join(' │ ')}</div>}
        {cfg.showBarcode && bcUrl && <img src={bcUrl} style={{ maxWidth:'100%', height:'auto' }} alt="bc"/>}
        {cfg.showBarcode && !bcUrl && product.Barcode && <div style={{ fontSize:fs.sku+'px', fontFamily:'monospace', border:'1px solid #333', padding:'1px 2px', wordBreak:'break-all', color:'#333' }}>{product.Barcode}</div>}
      </div>
      <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:700 }}>{preset.w}×{preset.h} مم</div>
    </div>
  );
}

// ─── Retry Queue Sub-Panel ────────────────────────────────────────────────────
function RetryQueuePanel({ productId, onReprint }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    if (!window?.api?.getLabelPrintLog) return;
    window.api.getLabelPrintLog({ product_id: productId, limit: 5 })
      .then(r => setLogs(Array.isArray(r) ? r.filter(l => l.status === 'failed') : []))
      .catch(() => {});
  }, [productId]);

  if (!logs.length) return null;
  return (
    <div style={{ padding:'10px 12px', borderRadius:'10px', background:'#fff7ed', border:'1px solid #fed7aa', fontSize:'12px' }}>
      <div style={{ fontWeight:700, color:'#92400e', marginBottom:'6px', display:'flex', alignItems:'center', gap:'5px' }}>
        <AlertTriangle size={13}/> طوابير فاشلة ({logs.length})
      </div>
      {logs.map(l => (
        <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderTop:'1px solid #fed7aa', color:'#78350f' }}>
          <span style={{ fontSize:'11px' }}>{new Date(l.timestamp).toLocaleTimeString('ar-SA')} — {l.label_key}</span>
          <button onClick={() => onReprint(l)} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #f97316', background:'#fff7ed', color:'#ea580c', cursor:'pointer', fontSize:'11px', fontFamily:'inherit' }}>
            إعادة
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function LabelPrintModal({ product, settings, onClose }) {
  const { showToast } = useToast?.() || { showToast: (msg) => console.warn(msg) };

  const parsedCfg = (() => {
    try {
      const raw = settings?.label_config;
      return {
        showBusinessName:true, showProductName:true, showPrice:true,
        showBarcode:true, showSKU:false, showQR:false, qrContent:'{barcode}',
        showExpiry:false, showBatch:false, showWeight:false, showOrigin:false,
        barcodePosition:'bottom', fontFamily:'Tahoma, Arial, sans-serif',
        labelBackground:'#ffffff', textColor:'#1a1a1a', priceColor:'#111827',
        borderStyle:'none', labelPrinterName:'',
        ...(typeof raw === 'string' ? JSON.parse(raw) : (raw || {})),
      };
    } catch { return { showBusinessName:true, showProductName:true, showPrice:true, showBarcode:true, barcodePosition:'bottom', fontFamily:'Tahoma, Arial, sans-serif', labelBackground:'#ffffff', textColor:'#1a1a1a', priceColor:'#111827', borderStyle:'none', labelPrinterName:'' }; }
  })();

  const defaultKey = parsedCfg.size || '58x40';

  const [labelKey,         setLabelKey]         = useState(defaultKey);
  const [copies,           setCopies]           = useState(parsedCfg.copies || 1);
  const [printing,         setPrinting]         = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  // P7: template state
  const [templates,        setTemplates]        = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [activeCfg,        setActiveCfg]        = useState(parsedCfg);
  // P10: extra field overrides (live editable in modal)
  const [extraFields,      setExtraFields]      = useState({
    expiry_date:        product.expiry_date        || '',
    batch_number:       product.batch_number       || '',
    net_weight_g:       product.net_weight_g       || '',
    country_of_origin:  product.country_of_origin  || '',
  });

  // P7: load templates for this product's category
  useEffect(() => {
    if (!window?.api?.getLabelTemplates) return;
    window.api.getLabelTemplates({ category_id: product.Category })
      .then(r => setTemplates(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [product.Category]);

  // P7: apply selected template config
  const applyTemplate = useCallback((tplId) => {
    setSelectedTemplate(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) { setActiveCfg(parsedCfg); return; }
    try {
      const tplCfg = JSON.parse(tpl.config_json || '{}');
      setActiveCfg({ ...parsedCfg, ...tplCfg });
      if (tplCfg.size) setLabelKey(tplCfg.size);
    } catch { setActiveCfg(parsedCfg); }
  }, [templates, parsedCfg]);

  // Merge extra field overrides into the product object for preview/print
  const mergedProduct = { ...product, ...extraFields };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printLabel(mergedProduct, settings, labelKey, copies, activeCfg);
      showToast?.({ type:'success', message:'تمت الطباعة بنجاح' });
      onClose();
    } catch (e) {
      showToast?.({ type:'error', message:'خطأ في الطباعة: ' + e.message });
    }
    setPrinting(false);
  };

  // P9: Reprint last label
  const handleReprintFromLog = async (logEntry) => {
    setPrinting(true);
    try {
      const html = await buildLabelHTML(mergedProduct, settings, logEntry.label_key || labelKey, logEntry.copies || 1);
      await window.api.printHTML(html);
      showToast?.({ type:'success', message:'إعادة الطباعة نجحت' });
    } catch (e) {
      showToast?.({ type:'error', message:'فشل إعادة الطباعة: ' + e.message });
    }
    setPrinting(false);
  };

  const preset  = LABEL_PRESETS[labelKey] || LABEL_PRESETS['58x40'];
  const bParams = product.Barcode ? computeBarcodeParams(String(product.Barcode), preset.w - 5) : null;
  const fmt     = product.Barcode ? detectBarcodeFormat(String(product.Barcode)) : null;

  const hasExtraToggles = activeCfg.showExpiry || activeCfg.showBatch || activeCfg.showWeight || activeCfg.showOrigin;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:'var(--bg-card)', borderRadius:'20px', boxShadow:'0 25px 60px rgba(0,0,0,0.25)', width:'580px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', overflow:'hidden auto', direction:'rtl' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-subtle)', position:'sticky', top:0, background:'var(--bg-card)', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', background:'#eff6ff', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563eb' }}><Tag size={17}/></div>
            <div>
              <div style={{ fontWeight:900, fontSize:'15px', color:'var(--text-main)' }}>طباعة ملصق المنتج</div>
              <div style={{ fontSize:'12px', color:'#64748b' }}>{product.Name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none', background:'var(--bg-app)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}><X size={16}/></button>
        </div>

        {/* Body */}
        <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 190px', gap:'20px', alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

            {/* P7: Template picker */}
            {templates.length > 0 && (
              <div>
                <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'6px' }}>قالب الملصق</div>
                <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'10px', border:'1.5px solid var(--border-subtle)', background:'var(--bg-app)', color:'var(--text-main)', fontSize:'13px', fontFamily:'inherit', cursor:'pointer' }}>
                  <option value=''>الإعداد الافتراضي</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {/* Size picker */}
            <div>
              <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'6px' }}>حجم الملصق</div>
              <div style={{ position:'relative' }}>
                <button onClick={() => setShowSizeDropdown(v => !v)}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:'12px', border:'1.5px solid var(--border-subtle)', background:'var(--bg-app)', color:'var(--text-main)', cursor:'pointer', fontFamily:'inherit', fontSize:'13px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>{preset.name} ({labelKey})</span><ChevronDown size={14}/>
                </button>
                {showSizeDropdown && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, left:0, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'12px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:10, maxHeight:'220px', overflowY:'auto' }}>
                    {Object.entries(LABEL_PRESETS).map(([k, p]) => (
                      <button key={k} onClick={() => { setLabelKey(k); setShowSizeDropdown(false); }}
                        style={{ width:'100%', padding:'10px 14px', background: k===labelKey ? '#eff6ff' : 'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:'13px', fontWeight: k===labelKey ? 800 : 600, color: k===labelKey ? '#2563eb' : 'var(--text-main)', textAlign:'right', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>{p.name}</span><span style={{ fontSize:'11px', color:'#94a3b8' }}>{p.printerWidth} مم</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Copies */}
            <div>
              <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)', marginBottom:'6px' }}>عدد النسخ</div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <button onClick={() => setCopies(v => Math.max(1, v - 1))} style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid var(--border-subtle)', background:'var(--bg-app)', cursor:'pointer', fontFamily:'inherit', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-main)' }}>−</button>
                <span style={{ fontSize:'24px', fontWeight:900, color:'var(--text-main)', minWidth:'32px', textAlign:'center' }}>{copies}</span>
                <button onClick={() => setCopies(v => Math.min(99, v + 1))} style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid var(--border-subtle)', background:'var(--bg-app)', cursor:'pointer', fontFamily:'inherit', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-main)' }}>+</button>
              </div>
            </div>

            {/* P10: Extra fields */}
            {hasExtraToggles && (
              <div style={{ padding:'12px', borderRadius:'12px', background:'var(--bg-app)', border:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-muted)' }}>حقول إضافية</div>
                {activeCfg.showExpiry && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-main)', minWidth:'60px' }}>انتهاء:</label>
                    <input type="date" value={extraFields.expiry_date} onChange={e => setExtraFields(f => ({ ...f, expiry_date: e.target.value }))}
                      style={{ flex:1, padding:'6px 8px', borderRadius:'8px', border:'1px solid var(--border-subtle)', background:'var(--bg-card)', color:'var(--text-main)', fontSize:'12px', fontFamily:'inherit' }}/>
                  </div>
                )}
                {activeCfg.showBatch && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-main)', minWidth:'60px' }}>دفعة:</label>
                    <input value={extraFields.batch_number} onChange={e => setExtraFields(f => ({ ...f, batch_number: e.target.value }))} placeholder="رقم الدفعة"
                      style={{ flex:1, padding:'6px 8px', borderRadius:'8px', border:'1px solid var(--border-subtle)', background:'var(--bg-card)', color:'var(--text-main)', fontSize:'12px', fontFamily:'inherit' }}/>
                  </div>
                )}
                {activeCfg.showWeight && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-main)', minWidth:'60px' }}>الوزن (غ):</label>
                    <input type="number" value={extraFields.net_weight_g} onChange={e => setExtraFields(f => ({ ...f, net_weight_g: e.target.value }))} placeholder="0"
                      style={{ flex:1, padding:'6px 8px', borderRadius:'8px', border:'1px solid var(--border-subtle)', background:'var(--bg-card)', color:'var(--text-main)', fontSize:'12px', fontFamily:'inherit' }}/>
                  </div>
                )}
                {activeCfg.showOrigin && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-main)', minWidth:'60px' }}>المنشأ:</label>
                    <input value={extraFields.country_of_origin} onChange={e => setExtraFields(f => ({ ...f, country_of_origin: e.target.value }))} placeholder="SA"
                      style={{ flex:1, padding:'6px 8px', borderRadius:'8px', border:'1px solid var(--border-subtle)', background:'var(--bg-card)', color:'var(--text-main)', fontSize:'12px', fontFamily:'inherit' }}/>
                  </div>
                )}
              </div>
            )}

            {/* Barcode status */}
            {bParams && (
              <div style={{ padding:'8px 10px', borderRadius:'8px', fontSize:'11px', lineHeight:1.6, background: bParams.fits ? '#f0fdf4' : '#fffbeb', border:`1px solid ${bParams.fits ? '#bbf7d0' : '#fde68a'}`, color: bParams.fits ? '#065f46' : '#92400e' }}>
                <div style={{ fontWeight:700, marginBottom:'3px' }}>{bParams.fits ? '✅ الباركود يناسب الملصق' : '⚠️ باركود طويل — سيُضغط تلقائياً'}</div>
                <div>الباركود: <strong>{product.Barcode}</strong> — صيغة: <strong>{fmt}</strong></div>
              </div>
            )}

            {/* P9: Retry queue */}
            <RetryQueuePanel productId={String(product.ID)} onReprint={handleReprintFromLog}/>
          </div>

          {/* Preview */}
          <MiniPreview product={mergedProduct} settings={settings} labelKey={labelKey} cfg={activeCfg}/>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border-subtle)', display:'flex', gap:'10px', position:'sticky', bottom:0, background:'var(--bg-card)' }}>
          <button onClick={handlePrint} disabled={printing}
            style={{ flex:1, padding:'12px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'12px', fontWeight:800, fontSize:'14px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:'0 4px 12px rgba(37,99,235,0.3)', opacity: printing ? 0.6 : 1 }}>
            <Printer size={16}/> {printing ? 'جاري الطباعة...' : `طباعة ${copies > 1 ? copies + ' نسخ' : 'ملصق'}`}
          </button>
          <button onClick={onClose}
            style={{ padding:'12px 20px', background:'var(--bg-app)', color:'var(--text-muted)', border:'1px solid var(--border-subtle)', borderRadius:'12px', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
