import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Scissors, CheckCircle2, Clock, MapPin, Phone, MessageSquare,
  Search, AlertCircle, Sparkles, ChevronLeft, ArrowRight, ShieldCheck,
  Calendar, Layers, Shirt, User
} from 'lucide-react';
import { shareViaWhatsAppDirect } from '../utils/tailorPrintAndShare';

export default function CustomerOrderTracker() {
  const { orderId: paramOrderId } = useParams();
  const navigate = useNavigate();

  const [searchKey, setSearchKey] = useState(paramOrderId || '');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const [errorMsg, setErrorMsg] = useState('');

  // Load Settings
  useEffect(() => {
    async function loadShopSettings() {
      try {
        if (window.api?.getSettings) {
          const s = await window.api.getSettings();
          setSettings(s || {});
        }
      } catch (e) {
        console.warn('Tracker: settings load error', e);
      }
    }
    loadShopSettings();
  }, []);

  // Search or fetch order by ID or phone
  const searchOrder = async (key) => {
    const query = String(key || '').trim().replace(/^#/, '').replace(/^ORD-/, '');
    if (!query) {
      setErrorMsg('يرجى إدخال رقم الطلب أو رقم الجوال');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (window.api?.tailor) {
        // Fetch from tailor API
        const allOrders = await window.api.tailor.getOrders?.() || [];
        const found = allOrders.find(o => 
          String(o.id) === query ||
          String(o.order_id) === query ||
          String(o.invoice_number || '').toLowerCase().includes(query.toLowerCase()) ||
          String(o.customer_phone || '').includes(query)
        );

        if (found) {
          // If items need garments detail
          let items = found.items || [];
          if (!items.length && window.api.tailor.getGarments) {
            items = await window.api.tailor.getGarments(found.id) || [];
          }
          setOrder({ ...found, items });
        } else {
          setOrder(null);
          setErrorMsg('لم يتم العثور على طلب مطابق لرقم الطلب أو الجوال المدخل');
        }
      }
    } catch (err) {
      console.error('Track order error:', err);
      setErrorMsg('حدث خطأ أثناء محاولة جلب بيانات الطلب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramOrderId) {
      searchOrder(paramOrderId);
    }
  }, [paramOrderId]);

  const handleManualSearch = (e) => {
    e.preventDefault();
    searchOrder(searchKey);
  };

  // Determine stage progression
  // Stages: 'cutting' -> 'stitching' -> 'ironing' / 'finishing' -> 'ready' -> 'delivered'
  const stages = [
    { key: 'received', label: 'استلام الطلب وتأكيد المقاسات', icon: Sparkles, desc: 'تم تثبيت المقاسات واعتماد تفاصيل التفصيل' },
    { key: 'cutting', label: 'قص وتفصيل الباترون', icon: Scissors, desc: 'يقوم القصاص بتفصيل طاقة القماش بحسب المقاس' },
    { key: 'stitching', label: 'الخياطة والتجميع اليدوي', icon: Shirt, desc: 'حياكة الثوب، تركيب الياقة والكبك والجيوب' },
    { key: 'finishing', label: 'الكي والتشطيب النهائي', icon: Layers, desc: 'مراجعة الجودة والكي بالبخار وتركيب الأزرار' },
    { key: 'ready', label: 'جاهز للاستلام أو البروفة', icon: CheckCircle2, desc: 'الثوب جاهز ومُعلّق بالفرع بانتظار استلامك' },
    { key: 'delivered', label: 'تم الاستلام بنجاح', icon: ShieldCheck, desc: 'تم تسليم الثوب ومطابقته' }
  ];

  const getStageIndex = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'delivered') return 5;
    if (s === 'ready') return 4;
    if (s === 'finishing' || s === 'ironing' || s === 'qc') return 3;
    if (s === 'stitching' || s === 'sewing') return 2;
    if (s === 'cutting') return 1;
    return 0;
  };

  const currentStageIdx = order ? getStageIndex(order.status) : 0;
  const balance = order ? (order.balance_due !== undefined ? order.balance_due : (order.remaining_amount || 0)) : 0;
  const shopName = settings.business_name_ar || 'مشغل البصمة الذكية للخياطة';
  const shopPhone = settings.phone || settings.whatsapp || '0533174895';

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: "'Cairo', 'Tajawal', -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <Scissors size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
              {shopName}
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
              بوابة التتبع الذاتي لطلبات التفصيل والمقاسات
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/tailor-pos')}
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>لوحة النظام</span>
          <ChevronLeft size={14} />
        </button>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Search Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '24px'
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
            🔍 تتبع حالة ثوبك لحظة بلحظة
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            أدخل رقم الطلب المسجل بالفاتورة (مثال: 2001) أو رقم جوالك المسجل لدينا لمعرفة مرحلة التفصيل الحالية وموعد الاستلام.
          </p>

          <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <input
                type="text"
                placeholder="أدخل رقم الطلب أو رقم الجوال..."
                value={searchKey}
                onChange={e => setSearchKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#f8fafc'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
            >
              <Search size={18} />
              <span>{loading ? 'جارِ البحث...' : 'تتبع الطلب'}</span>
            </button>
          </form>

          {errorMsg && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Order Details View */}
        {order && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Order Highlight Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                      #ORD-{order.id || order.order_id}
                    </span>
                    {order.is_urgent ? (
                      <span style={{ fontSize: '12px', background: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                        ⚠️ مستعجل
                      </span>
                    ) : null}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>
                    طلب العميل: {order.customer_name || 'عميل نقدي'}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.8 }}>
                    تاريخ استلام الطلب: {order.created_at ? new Date(order.created_at).toLocaleDateString('ar-SA') : '—'}
                  </p>
                </div>

                <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '2px' }}>موعد التسليم المتوقع:</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8' }}>
                    {order.delivery_date || order.target_delivery_date || 'خلال أيام'}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Stepper / Progress Timeline */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}
            >
              <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                📍 المسار التشغيلي المباشر للثوب
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
                {stages.map((stg, idx) => {
                  const isPast = idx < currentStageIdx;
                  const isCurrent = idx === currentStageIdx;
                  const isUpcoming = idx > currentStageIdx;
                  const StageIcon = stg.icon;

                  let circleBg = '#e2e8f0';
                  let circleColor = '#94a3b8';
                  let borderStyle = 'none';

                  if (isPast) {
                    circleBg = '#10b981';
                    circleColor = '#ffffff';
                  } else if (isCurrent) {
                    circleBg = '#2563eb';
                    circleColor = '#ffffff';
                    borderStyle = '4px solid #dbeafe';
                  }

                  return (
                    <div key={stg.key} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative' }}>
                      {/* Connecting Line */}
                      {idx < stages.length - 1 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '36px',
                            right: '17px',
                            width: '2px',
                            height: 'calc(100% - 10px)',
                            background: isPast ? '#10b981' : '#e2e8f0',
                            zIndex: 1
                          }}
                        />
                      )}

                      {/* Icon Circle */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: circleBg,
                          color: circleColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          zIndex: 2,
                          boxShadow: borderStyle ? '0 0 0 4px #dbeafe' : 'none',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <StageIcon size={18} />
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, paddingBottom: idx < stages.length - 1 ? '10px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: isCurrent || isPast ? 800 : 600,
                              color: isCurrent ? '#2563eb' : (isPast ? '#0f172a' : '#64748b')
                            }}
                          >
                            {stg.label}
                          </h4>
                          {isCurrent && (
                            <span
                              style={{
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                border: '1px solid #bfdbfe'
                              }}
                            >
                              المرحلة الحالية الآن ⏳
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                          {stg.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Garments Breakdown */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                ✂️ تفاصيل القطع والأقمشة ({order.items?.length || 1} قطع)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(order.items || []).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      background: '#f8fafc',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        ثوب ({idx + 1}): {item.garment_type === 'thobe' ? 'ثوب سعودي أصيل' : (item.garment_type || 'قطعة تفصيل')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        🧵 نوع القماش: <strong>{item.fabric_name || 'قماش مختار من المحل'}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        المعلم المسند: {item.tailor_name || 'معلم الورشة'} • القصاص: {item.cutter_name || 'قصاص المعمل'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                        {item.price || 0} ر.س
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#2563eb',
                          fontWeight: 700,
                          background: '#eff6ff',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          marginTop: '4px',
                          display: 'inline-block'
                        }}
                      >
                        المرحلة: {item.stage || item.production_stage || order.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary & Balance Callout */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>إجمالي تكلفة التفصيل:</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                  {parseFloat(order.total_amount || 0).toFixed(2)} ر.س
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>الدفعة المسددة (العربون):</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                  {parseFloat(order.paid_amount || order.deposit_paid || 0).toFixed(2)} ر.س
                </div>
              </div>

              <div
                style={{
                  background: balance > 0 ? '#fffbeb' : '#f0fdf4',
                  padding: '14px',
                  borderRadius: '12px',
                  border: balance > 0 ? '1px solid #fef3c7' : '1px solid #bbf7d0'
                }}
              >
                <div style={{ fontSize: '12px', color: balance > 0 ? '#92400e' : '#166534', fontWeight: 700 }}>
                  المتبقي المطلوب سداده عند الاستلام:
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: balance > 0 ? '#b45309' : '#15803d', marginTop: '4px' }}>
                  {balance > 0 ? `${parseFloat(balance).toFixed(2)} ر.س` : 'مسدد بالكامل ✅'}
                </div>
              </div>
            </div>

            {/* Quick Contact & Action Buttons */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  هل لديك استفسار حول تفصيل ثوبك؟
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  فريق الخياطة وخدمة العملاء جاهز للرد الفوري
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const msg = `مرحباً، أستفسر عن حالة طلبي رقم #ORD-${order.id || order.order_id} باسم ${order.customer_name}`;
                    shareViaWhatsAppDirect({ phone: shopPhone, message: msg });
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <MessageSquare size={16} />
                  <span>محادثة واتساب</span>
                </button>

                {shopPhone && (
                  <a
                    href={`tel:${shopPhone}`}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 800,
                      fontSize: '13px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Phone size={16} />
                    <span>اتصال بالفرع</span>
                  </a>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer
        style={{
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94a3b8'
        }}
      >
        {shopName} • نظام تتبع مراحل الخياطة والتفصيل الذكي
      </footer>
    </div>
  );
}
