import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Barcode, 
  CheckCircle2, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  X, 
  RotateCcw, 
  ArrowRight, 
  Scissors, 
  Sparkles, 
  Clock, 
  User, 
  Layers,
  ChevronDown
} from 'lucide-react';
import { playScanSuccess, playScanError, playReadyFanfare } from '../utils/audioFeedback';

export default function WorkshopBarcodeStationModal({
  isOpen,
  onClose,
  orders = [],
  garmentMap = {},
  onAdvanceOrder,
  onAdvanceGarment,
  onOpenHandover,
  showToast
}) {
  const [scanInput, setScanInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanMode, setScanMode] = useState('auto'); // 'auto' | 'station_cutting' | 'station_stitching' | 'station_finishing' | 'station_ready'
  const [recentScans, setRecentScans] = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastMatched, setLastMatched] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null); // { type: 'success'|'error', text: '' }

  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Auto-focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Keep input focused when clicking anywhere inside the modal
  const handleModalClick = () => {
    inputRef.current?.focus();
  };

  // ── Core Barcode Processing Engine ───────────────────────────────────────
  const processBarcode = useCallback(async (rawCode) => {
    if (!rawCode) return;
    const cleanCode = String(rawCode).trim().replace(/^[#]/, '');
    if (!cleanCode) return;

    // Search 1: Direct Order ID match (e.g. 123, ORD-123)
    let matchedOrder = orders.find(o => 
      String(o.id) === cleanCode || 
      `ORD-${o.id}`.toLowerCase() === cleanCode.toLowerCase() ||
      `INV-${o.id}`.toLowerCase() === cleanCode.toLowerCase()
    );

    // Search 2: Customer phone match
    if (!matchedOrder && cleanCode.length >= 7) {
      matchedOrder = orders.find(o => 
        (o.customer_phone || '').includes(cleanCode)
      );
    }

    // Search 3: Garment ID match across all loaded garments
    let matchedGarment = null;
    let garmentParentOrder = null;

    if (!matchedOrder) {
      for (const order of orders) {
        const garments = garmentMap[order.id] || [];
        const foundG = garments.find(g => 
          String(g.id) === cleanCode || 
          `GAR-${g.id}`.toLowerCase() === cleanCode.toLowerCase() ||
          `G-${g.id}`.toLowerCase() === cleanCode.toLowerCase() ||
          (g.barcode && String(g.barcode) === cleanCode)
        );
        if (foundG) {
          matchedGarment = foundG;
          garmentParentOrder = order;
          break;
        }
      }
    }

    // ── Handle Result ──────────────────────────────────────────────────────
    if (matchedOrder) {
      const orderGarments = garmentMap[matchedOrder.id] || [];
      
      // Determine target transition
      const res = await onAdvanceOrder(matchedOrder.id, scanMode !== 'auto' ? scanMode : null);
      
      if (res && res.success !== false) {
        if (soundEnabled) {
          if (res.isReady) {
            playReadyFanfare();
          } else {
            playScanSuccess();
          }
        }
        
        const scanItem = {
          id: Date.now(),
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'order',
          code: cleanCode,
          orderId: matchedOrder.id,
          customerName: matchedOrder.customer_name || 'عميل نقدي',
          pieces: orderGarments.length || 1,
          action: res.actionText || 'ترقية المحطة بنجاح',
          status: 'success'
        };

        setRecentScans(prev => [scanItem, ...prev.slice(0, 19)]);
        setSessionCount(c => c + (orderGarments.length || 1));
        setLastMatched({ order: matchedOrder, garments: orderGarments, actionText: res.actionText });
        setFeedbackStatus({ type: 'success', text: `تم مسح وترقية الطلب #${matchedOrder.id} - ${matchedOrder.customer_name || ''}` });

        // If ready, option to open handover
        if (res.isReady && onOpenHandover) {
          onOpenHandover(matchedOrder);
        }
      } else {
        if (soundEnabled) playScanError();
        setFeedbackStatus({ type: 'error', text: res?.error || `تعذر ترقية الطلب #${matchedOrder.id}` });
      }

    } else if (matchedGarment && garmentParentOrder) {
      const res = await onAdvanceGarment(matchedGarment.id, matchedGarment.production_stage);
      
      if (res && res.success !== false) {
        if (soundEnabled) playScanSuccess();
        const scanItem = {
          id: Date.now(),
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'garment',
          code: cleanCode,
          orderId: garmentParentOrder.id,
          garmentId: matchedGarment.id,
          customerName: garmentParentOrder.customer_name || 'عميل نقدي',
          pieces: 1,
          action: `ترقية قطعة (${matchedGarment.garment_type || 'ثوب'}) إلى ${res.nextStageLabel || 'المرحلة التالية'}`,
          status: 'success'
        };

        setRecentScans(prev => [scanItem, ...prev.slice(0, 19)]);
        setSessionCount(c => c + 1);
        setLastMatched({ order: garmentParentOrder, garments: [matchedGarment], actionText: scanItem.action });
        setFeedbackStatus({ type: 'success', text: scanItem.action });
      } else {
        if (soundEnabled) playScanError();
        setFeedbackStatus({ type: 'error', text: res?.error || `تعذر ترقية القطعة #${matchedGarment.id}` });
      }

    } else {
      // Not found
      if (soundEnabled) playScanError();
      const errItem = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'unknown',
        code: cleanCode,
        orderId: '---',
        customerName: 'غير موجود',
        action: 'الباركود غير مطابق لأي طلب أو قطعة نشطة في المعمل',
        status: 'error'
      };
      setRecentScans(prev => [errItem, ...prev.slice(0, 19)]);
      setFeedbackStatus({ type: 'error', text: `الرمز [${cleanCode}] غير موجود أو تم تسليمه مسبقاً` });
    }

    setScanInput('');
  }, [orders, garmentMap, scanMode, soundEnabled, onAdvanceOrder, onAdvanceGarment, onOpenHandover]);

  // ── Hardware Barcode Scanner Global Event Listener ───────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      // Escape closes modal
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key submits barcode
      if (e.key === 'Enter') {
        const code = bufferRef.current.trim() || scanInput.trim();
        if (code) {
          e.preventDefault();
          bufferRef.current = '';
          processBarcode(code);
        }
        return;
      }

      // If scanner bursts characters (<80ms delta), accumulate in buffer
      if (e.key.length === 1) {
        if (delta > 120) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose, processBarcode, scanInput]);

  if (!isOpen) return null;

  return (
    <div 
      dir="rtl"
      onClick={handleModalClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div 
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div 
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.25)',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8'
              }}
            >
              <Barcode size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>
                  محطة المسح الضوئي لمعمل الخياطة (Hands-Free Station)
                </h2>
                <span 
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', animation: 'pulse 1.5s infinite' }} />
                  القارئ نشط ومستعد
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                مرر قارئ الباركود على بطاقة الثوب (Hanger Tag) أو الفاتورة لترقية المرحلة فورياً بدون لمس الشاشة
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'كتم الصوت التنبيهي' : 'تفعيل نغمات التأكيد'}
              style={{
                background: soundEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                color: soundEnabled ? '#34d399' : '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? 'النغمة مفعلة' : 'صامت'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Command & Station Control Strip */}
        <div 
          style={{
            padding: '14px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Target Station Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
              مسار الترقية عند المسح:
            </span>
            {[
              { id: 'auto', label: 'ترقية تلقائية للمحطة التالية (Auto)', icon: Sparkles },
              { id: 'station_stitching', label: 'إلى الخياطة', icon: Scissors },
              { id: 'station_finishing', label: 'إلى الكوي والتشطيب', icon: Layers },
              { id: 'station_ready', label: 'إلى الجاهزية للتسليم', icon: CheckCircle2 }
            ].map(m => {
              const Icon = m.icon;
              const isSelected = scanMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScanMode(m.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #6366f1' : '1px solid #cbd5e1',
                    background: isSelected ? '#6366f1' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Session Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#0f172a'
              }}
            >
              ممسوحات الجلسة: <span style={{ color: '#10b981', fontSize: '15px' }}>{sessionCount} قطعة</span>
            </div>
          </div>
        </div>

        {/* Input Bar & Instant Feedback Area */}
        <div style={{ padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <form 
            onSubmit={e => {
              e.preventDefault();
              if (scanInput.trim()) {
                processBarcode(scanInput.trim());
              }
            }}
            style={{ display: 'flex', gap: '10px' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                placeholder="وجه قارئ الباركود، أو اكتب رقم الطلب/الباركود واضغط Enter..."
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '12px',
                  border: '2px solid #6366f1',
                  background: '#fcfcfd',
                  padding: '0 45px 0 16px',
                  fontSize: '16px',
                  fontWeight: 800,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#0f172a',
                  outline: 'none',
                  boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.12)',
                  boxSizing: 'border-box'
                }}
              />
              <div 
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6366f1',
                  pointerEvents: 'none'
                }}
              >
                <Barcode size={24} />
              </div>
            </div>

            <button
              type="submit"
              style={{
                minWidth: '120px',
                background: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>تنفيذ المسح</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Dynamic Feedback Notification Bar */}
          {feedbackStatus && (
            <div 
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: feedbackStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${feedbackStatus.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                color: feedbackStatus.type === 'success' ? '#166534' : '#991b1b',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {feedbackStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{feedbackStatus.text}</span>
            </div>
          )}
        </div>

        {/* Body Content: Last Matched Garment Card & Recent Live Scans Table */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#f8fafc'
          }}
        >
          {/* Recent Scanned Log Table */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div 
              style={{
                padding: '12px 18px',
                background: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                <Clock size={16} color="#6366f1" />
                <span>سجل الممسوحات اللحظي لهذا اليوم</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                يعرض آخر 20 عملية مسح
              </span>
            </div>

            {recentScans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <Barcode size={48} strokeWidth={1.2} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#64748b' }}>في انتظار أول عملية مسح...</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>مرر باركود الثوب أو الفاتورة لمشاهدة الترقية الحية هنا</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '10px 14px' }}>الوقت</th>
                      <th style={{ padding: '10px 14px' }}>الرمز الممسوح</th>
                      <th style={{ padding: '10px 14px' }}>رقم الطلب</th>
                      <th style={{ padding: '10px 14px' }}>العميل</th>
                      <th style={{ padding: '10px 14px' }}>الإجراء المنفذ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentScans.map((scan) => (
                      <tr 
                        key={scan.id} 
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: scan.status === 'success' ? '#ffffff' : '#fef2f2'
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", color: '#64748b' }}>
                          {scan.time}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800 }}>
                          {scan.code}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: '#6366f1' }}>
                          #{scan.orderId}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                          {scan.customerName}
                        </td>
                        <td style={{ padding: '10px 14px', color: scan.status === 'success' ? '#0f172a' : '#ef4444', fontWeight: 700 }}>
                          {scan.action}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              background: scan.status === 'success' ? '#dcfce7' : '#fee2e2',
                              color: scan.status === 'success' ? '#15803d' : '#b91c1c'
                            }}
                          >
                            {scan.status === 'success' ? 'ناجح' : 'فشل'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer info strip */}
        <div 
          style={{
            padding: '12px 24px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b'
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>اختصار الخروج: <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>Esc</kbd></span>
            <span>قارئات الباركود المدعومة: USB / Bluetooth / Wireless Handheld (Code128 / EAN13)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            إغلاق المحطة
          </button>
        </div>

      </div>
    </div>
  );
}
