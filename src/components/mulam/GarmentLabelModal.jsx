import React, { useState } from 'react';
import { X, Printer, Tag, Check, Layers, AlertCircle } from 'lucide-react';
import { printGarmentThermalLabel, printAllGarmentLabelsBatch, generateGarmentThermalLabelHTML } from '../../utils/tailorPrintAndShare';
import { useToast } from '../ToastManager';

export default function GarmentLabelModal({
  isOpen,
  onClose,
  order = {},
  garment = null,
  garments = [],
  settings = {}
}) {
  const { showToast } = useToast?.() ?? { showToast: (m) => alert(m.message || m) };
  const [size, setSize] = useState('60x40'); // '60x40' or '50x30'
  const [printing, setPrinting] = useState(false);

  if (!isOpen) return null;

  const items = garments.length > 0 ? garments : (order.items || []);
  const activeGarment = garment || items[0] || {};
  const activeIndex = items.findIndex(i => (i.id && activeGarment.id && i.id === activeGarment.id)) + 1 || 1;
  const totalCount = items.length || 1;

  const handlePrintSingle = async () => {
    setPrinting(true);
    try {
      const res = await printGarmentThermalLabel({
        order,
        garment: activeGarment,
        index: activeIndex,
        total: totalCount,
        settings,
        size
      });
      if (res?.success !== false) {
        showToast?.({ type: 'success', message: 'تم إرسال الملصق الحراري للطابعة بنجاح' });
      } else {
        showToast?.({ type: 'error', message: 'تعذر الطباعة: ' + (res?.error || '') });
      }
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: 'حدث خطأ أثناء طباعة الملصق' });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAll = async () => {
    setPrinting(true);
    try {
      const res = await printAllGarmentLabelsBatch({
        order,
        garments: items,
        settings,
        size
      });
      if (res?.success !== false) {
        showToast?.({ type: 'success', message: `تم إرسال ${items.length} ملصقات للطابعة بنجاح` });
      } else {
        showToast?.({ type: 'error', message: 'تعذر الطباعة: ' + (res?.error || '') });
      }
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: 'حدث خطأ أثناء طباعة ملصقات الدفعة' });
    } finally {
      setPrinting(false);
    }
  };

  const orderId = order.orderId || order.id || activeGarment.order_id || '—';
  const customerName = order.customer?.name || order.customer_name || 'عميل نقدي';
  const deliveryDate = order.deliveryDate || order.target_delivery_date || '—';
  const fabricName = activeGarment.fabric_name || 'قماش محدد';
  const tailorName = activeGarment.tailor_name || 'المعلم';
  const cutterName = activeGarment.cutter_name || 'القصاص';
  const isUrgent = order.isUrgent || order.is_urgent || activeGarment.is_urgent;

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Tag size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                طباعة ملصق الباركود والتعليق للثوب
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                طلب #{orderId} • ملصق حراري مقاوم للجيب والشماعة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Size Choice */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              مقاس لفة الملصق الحراري:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSize('60x40')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: size === '60x40' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  background: size === '60x40' ? '#f1f5f9' : '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>60 × 40 مم (قياسي)</span>
                {size === '60x40' && <Check size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setSize('50x30')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: size === '50x30' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  background: size === '50x30' ? '#f1f5f9' : '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>50 × 30 مم (مدمج)</span>
                {size === '50x30' && <Check size={16} />}
              </button>
            </div>
          </div>

          {/* Visual Label Preview */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              معاينة مظهر الملصق المطبوع:
            </label>
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #94a3b8',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  width: size === '50x30' ? '220px' : '260px',
                  minHeight: size === '50x30' ? '135px' : '160px',
                  border: '2px solid #000000',
                  borderRadius: '6px',
                  background: '#ffffff',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
              >
                {/* Tag Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
                  <span style={{ fontWeight: 900, fontSize: '11px', color: '#000' }}>
                    {settings.business_name_ar || 'محل الخياطة'}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#000', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>
                    ثوب {activeIndex} من {totalCount}
                  </span>
                </div>

                {/* Meta Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                  <span style={{ fontWeight: 900, fontSize: '13px', fontFamily: 'monospace' }}>
                    #ORD-{orderId}
                  </span>
                  {isUrgent ? (
                    <span style={{ fontSize: '9px', fontWeight: 900, border: '1px solid #000', padding: '0 3px' }}>
                      ⚠️ مستعجل
                    </span>
                  ) : null}
                  <span style={{ fontSize: '9px', fontWeight: 700 }}>تسليم: {deliveryDate}</span>
                </div>

                {/* Customer */}
                <div style={{ fontWeight: 900, fontSize: '12px', color: '#000', margin: '2px 0' }}>
                  {customerName}
                </div>

                {/* Fabric */}
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#333' }}>
                  {activeGarment.garment_type === 'thobe' ? 'ثوب رجالي' : (activeGarment.garment_type || 'تفصيل')} • {fabricName}
                </div>

                {/* Mock Barcode */}
                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <div style={{ height: '22px', background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px)' }} />
                  <div style={{ fontSize: '8.5px', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                    ORD-{orderId}-G{activeGarment.id || activeIndex}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', borderTop: '1px dashed #000', paddingTop: '2px' }}>
                  <span>القصاص: {cutterName}</span>
                  <span>المعلم: {tailorName}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: '#1e40af', lineHeight: 1.4 }}>
              يتم تدبيس هذا الملصق الحراري بداخل جيب الثوب أو تعليقه على الشماعة. يتيح للخياط والقصاص مسح الباركود لتحديث مرحلة العمل مباشرة، ويمنع اختلاط الثياب في المعمل.
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            إلغاء
          </button>

          {totalCount > 1 && (
            <button
              type="button"
              onClick={handlePrintAll}
              disabled={printing}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid #3b82f6',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layers size={16} />
              <span>طباعة الكل ({totalCount} ملصقات)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintSingle}
            disabled={printing}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
          >
            <Printer size={16} />
            <span>{printing ? 'جارِ الطباعة...' : `طباعة الملصق (ثوب ${activeIndex})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
