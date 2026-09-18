import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scissors, Factory, Users, Package, BarChart3, Settings as SettingsIcon,
  ShoppingCart, Wallet, Award, Clock, ChevronLeft, Fingerprint,
  TrendingUp, CheckCircle2, AlertTriangle, Calendar, Truck, AlertCircle,
  FileText, Search, Plus, ArrowUpRight, ShieldCheck, RefreshCw, Send, Layers,
  LayoutGrid, ArrowRight, ExternalLink, Sparkles
} from 'lucide-react';

export default function HomePrototypes({ 
  currentDesign = 'bento', 
  onSelectDesign,
  stats, 
  tailorStats, 
  shift, 
  userName, 
  businessType 
}) {
  const navigate = useNavigate();
  const [customerSearch, setCustomerSearch] = useState('');
  const [activePill, setActivePill] = useState('all');
  const [activeRole, setActiveRole] = useState('tailor');

  // Key shortcuts listener for Touch/Terminal mode (Design 3)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'F1') { e.preventDefault(); navigate(businessType === 'tailor' ? '/tailor-pos' : '/pos'); }
      if (e.key === 'F2') { e.preventDefault(); navigate('/orders-board'); }
      if (e.key === 'F3') { e.preventDefault(); navigate('/customers'); }
      if (e.key === 'F4') { e.preventDefault(); navigate('/alterations'); }
      if (e.key === 'F5') { e.preventDefault(); navigate('/pos'); }
      if (e.key === 'F6') { e.preventDefault(); navigate('/stock'); }
      if (e.key === 'F7') { e.preventDefault(); navigate('/sales-history'); }
      if (e.key === 'F8') { e.preventDefault(); navigate('/settings'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, businessType]);

  /* ─────────────────────────────────────────────────────────────────────────
     DESIGN 1: Bento Command Canvas (Apple-style Modular Hierarchy)
  ───────────────────────────────────────────────────────────────────────── */
  const renderBentoCanvas = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Quick Status Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37,99,235,0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>رصيد الدرج الحالي</div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }} className="font-mono">
              {shift?.starting_cash ? Number(shift.starting_cash).toFixed(2) : '2,450.00'} ر.س
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(5,150,105,0.08)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#065f46', fontWeight: '700' }}>جاهز للتسليم للعميل</div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: '#059669', marginTop: '2px' }} className="font-mono">
              {tailorStats?.readyForPickup ?? 6} أثواب
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(217,119,6,0.08)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>تنبيهات طاقات الأقمشة</div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: '#d97706', marginTop: '2px' }} className="font-mono">
              {tailorStats?.lowFabrics ?? 3} أقمشة منخفضة
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>مبيعات اليوم</div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }} className="font-mono">
              {stats?.todaySalesTotal ? Number(stats.todaySalesTotal).toFixed(2) : '3,820.00'} ر.س
            </div>
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px'
      }}>
        
        {/* Bento Tile 1: Hero Action (New Tailor Order) - 7 cols */}
        <div style={{
          gridColumn: 'span 7',
          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '24px',
          padding: '30px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '260px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ position: 'absolute', left: '-30px', bottom: '-30px', opacity: 0.05, pointerEvents: 'none' }}>
            <Scissors size={260} />
          </div>

          <div style={{ zIndex: 2 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', borderRadius: '99px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
              <Sparkles size={14} />
              <span>المحطة الرئيسية الأسرع</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              طلب تفصيل ثوب جديد
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, maxWidth: '440px', lineHeight: 1.6 }}>
              استقبال العميل، اختيار نوع القماش والموديل والتطريز، تسجيل المقاسات الدقيقة وإصدار الفاتورة الفورية.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '26px', zIndex: 2, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/tailor-pos')}
              style={{
                padding: '12px 24px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>فتح شاشة التفصيل الفوري</span>
            </button>

            <button
              onClick={() => navigate('/alterations')}
              style={{
                padding: '12px 20px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Scissors size={16} />
              <span>+ استلام تعديل سريع</span>
            </button>
          </div>
        </div>

        {/* Bento Tile 2: Workshop Kanban Telemetry - 5 cols */}
        <div style={{
          gridColumn: 'span 5',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '24px 26px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Factory size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>لوحة إنتاج المعمل</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>متابعة خطوط التفصيل والتشطيب</span>
                </div>
              </div>
              <button 
                onClick={() => navigate('/orders-board')}
                style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700' }}
              >
                <span>شاشة المعمل</span>
                <ArrowUpRight size={16} />
              </button>
            </div>

            {/* Stage Progress meters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>✂️ مرحلة القص والتفصيل</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#2563eb' }}>8 أثواب</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>🧵 مرحلة الخياطة والتركيب</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#7c3aed' }}>12 ثوب</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(5,150,105,0.06)', borderRadius: '12px', border: '1px solid rgba(5,150,105,0.2)' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>✅ جاهز لتسليم العميل</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#059669' }}>6 أثواب</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/orders-board')}
            style={{
              width: '100%',
              padding: '11px',
              marginTop: '16px',
              background: 'rgba(37,99,235,0.06)',
              color: '#2563eb',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            فتح خط الإنتاج والباركود
          </button>
        </div>

        {/* Bento Tile 3: Client Measurement Profile Quick-Lookup - 4 cols */}
        <div style={{
          gridColumn: 'span 4',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>سجل مقاسات العملاء</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>استعلام فوري وتعديل البروفايل</span>
            </div>
          </div>

          <div style={{ position: 'relative', marginTop: '12px' }}>
            <input
              type="text"
              placeholder="اكتب رقم جوال العميل أو الاسم..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 38px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-app)',
                fontSize: '13px',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
          </div>

          <button
            onClick={() => navigate('/customers')}
            style={{
              width: '100%',
              padding: '11px',
              marginTop: '14px',
              background: '#7c3aed',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            فتح سجل المقاسات
          </button>
        </div>

        {/* Bento Tile 4: Instant Retail POS & Ready Wear - 4 cols */}
        <div style={{
          gridColumn: 'span 4',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>نقطة البيع الكاشير</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>بيع مباشر، إكسسوارات، أقمشة</span>
            </div>
          </div>

          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '8px 0 16px 0' }}>
            إصدار فواتير ضريبية مبسطة فورية للأقمشة الجاهزة، الكبك، العقال، والشيلان دون انتظار أخذ المقاسات.
          </p>

          <button
            onClick={() => navigate('/pos')}
            style={{
              width: '100%',
              padding: '11px',
              background: 'var(--bg-app)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            بدء بيع سريع
          </button>
        </div>

        {/* Bento Tile 5: Stock & Inventory Telemetry - 4 cols */}
        <div style={{
          gridColumn: 'span 4',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(217,119,6,0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>مخزون الأقمشة</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>طاقات الأقمشة والمستلزمات</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(217,119,6,0.06)', borderRadius: '12px', border: '1px solid rgba(217,119,6,0.2)', margin: '8px 0 14px 0' }}>
            <span style={{ fontSize: '12.5px', color: '#92400e', fontWeight: '700' }}>⚠️ أقمشة بلغت حد إعادة الطلب</span>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#d97706' }}>3 طاقات</span>
          </div>

          <button
            onClick={() => navigate('/stock')}
            style={{
              width: '100%',
              padding: '11px',
              background: 'var(--bg-app)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            جرد وتوريد الأقمشة
          </button>
        </div>

      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     DESIGN 2: Process-Driven Workflow Funnel (Physical Tailor Stages)
  ───────────────────────────────────────────────────────────────────────── */
  const renderProcessFunnel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Funnel Pipeline Lanes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px'
      }}>

        {/* Lane 1: Intake & Measurements */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>الاستقبال والمقاسات</h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>البداية</span>
          </div>

          <button
            onClick={() => navigate('/tailor-pos')}
            style={{
              padding: '14px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '13px',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>✂️ طلب تفصيل جديد</span>
              <Plus size={16} />
            </div>
            <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: '400' }}>أخذ مقاس، قماش، وتحديد موعد</span>
          </button>

          <button
            onClick={() => navigate('/customers')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>📏 دفتر المقاسات</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>البحث برقم جوال العميل</div>
          </button>

          <button
            onClick={() => navigate('/alterations')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>🏷️ طلب تعديل ملابس</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>تقصير، تضييق، تصليح سريع</div>
          </button>
        </div>

        {/* Lane 2: Workshop & Production */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#059669', color: '#fff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>المعمل والتشغيل</h3>
            </div>
            <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>14 ثوب جاري</span>
          </div>

          <button
            onClick={() => navigate('/orders-board')}
            style={{
              padding: '14px',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '13px',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🏭 لوحة مراحل المعمل</span>
              <ArrowUpRight size={16} />
            </div>
            <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: '400' }}>قص • خياطة • تشطيب • كوي</span>
          </button>

          <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>مرحلة القص:</span>
              <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>8 أثواب</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>مرحلة الخياطة:</span>
              <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>6 أثواب</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/orders-board')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>🏷️ محطة طباعة الباركود</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>لصق التكت على قطع القماش</div>
          </button>
        </div>

        {/* Lane 3: Delivery & Notifications */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7c3aed', color: '#fff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>التسليم والواتساب</h3>
            </div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '700' }}>6 جاهزة</span>
          </div>

          <button
            onClick={() => navigate('/orders-board')}
            style={{
              padding: '14px',
              background: '#7c3aed',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '13px',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📦 تسليم الأثواب الجاهزة</span>
              <CheckCircle2 size={16} />
            </div>
            <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: '400' }}>تسليم، تحصيل متبقي، وطباعة</span>
          </button>

          <button
            onClick={() => navigate('/sales-history')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>💬 إرسال إشعارات واتساب</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>إشعار العملاء بالجاهزية فوراً</div>
          </button>

          <button
            onClick={() => navigate('/sales-history')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>🧾 سجل الفواتير والمبيعات</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>إعادة طباعة ومشاركة المستند</div>
          </button>
        </div>

        {/* Lane 4: Operations & Financials */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#475569', color: '#fff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>العمليات والمالية</h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>المحل</span>
          </div>

          <button
            onClick={() => navigate('/stock')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>📦 جرد وتوريد الأقمشة</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>أمتار الطاقات وتنبيهات النفاد</div>
          </button>

          <button
            onClick={() => navigate('/purchases')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>📥 فواتير المشتريات</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>تسجيل شحنات الأقمشة من المورد</div>
          </button>

          <button
            onClick={() => navigate('/settings')}
            style={{
              padding: '12px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              textAlign: 'right',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '700' }}>⚙️ إعدادات النظام والربط</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>طابعات، باركود، وهيئة الزكاة</div>
          </button>
        </div>

      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     DESIGN 3: Touch Terminal Launchpad (POS Touch + Keyboard F1–F8)
  ───────────────────────────────────────────────────────────────────────── */
  const renderTouchTerminal = () => {
    const tiles = [
      { key: '١', title: 'طلب تفصيل جديد', desc: 'استقبال عميل وتفصيل', icon: <Scissors size={28} />, color: '#2563eb', path: '/tailor-pos' },
      { key: '٢', title: 'لوحة إنتاج المعمل', desc: 'مراحل القص والخياطة', icon: <Factory size={28} />, color: '#059669', path: '/orders-board' },
      { key: '٣', title: 'سجل مقاسات العملاء', desc: 'بحث وتعديل المقاسات', icon: <Users size={28} />, color: '#7c3aed', path: '/customers' },
      { key: '٤', title: 'تعديلات الملابس', desc: 'استلام وتسليم التعديلات', icon: <Scissors size={28} />, color: '#ea580c', path: '/alterations' },
      { key: '٥', title: 'نقطة البيع الكاشير', desc: 'بيع سريع وأقمشة جاهزة', icon: <ShoppingCart size={28} />, color: '#0284c7', path: '/pos' },
      { key: '٦', title: 'مخزون الأقمشة', desc: 'طاقات الأقمشة والمواد', icon: <Package size={28} />, color: '#d97706', path: '/stock' },
      { key: '٧', title: 'سجل المبيعات', desc: 'فواتير اليوم والإشعارات', icon: <FileText size={28} />, color: '#0d9488', path: '/sales-history' },
      { key: '٨', title: 'إعدادات النظام', desc: 'طابعات، واتساب، وزكاة', icon: <SettingsIcon size={28} />, color: '#475569', path: '/settings' }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Category Pills Header */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: '⚡ كل المحطات السريعة' },
            { id: 'tailor', label: '🧵 التفصيل والمعمل' },
            { id: 'stock', label: '📦 المخزون والأقمشة' },
            { id: 'sales', label: '💰 المبيعات والمالية' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setActivePill(p.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '99px',
                border: activePill === p.id ? '2px solid #2563eb' : '1px solid var(--border-subtle)',
                background: activePill === p.id ? '#2563eb' : 'var(--bg-card)',
                color: activePill === p.id ? '#ffffff' : 'var(--text-main)',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Big Touch Tiles Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px'
        }}>
          {tiles.map(t => (
            <button
              key={t.key}
              onClick={() => navigate(t.path)}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '20px',
                padding: '24px 20px',
                border: '2px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
                position: 'relative',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit'
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = t.color;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Keyboard Badge */}
              <span style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'monospace',
                color: 'var(--text-muted)'
              }}>
                {t.key}
              </span>

              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: `${t.color}15`,
                color: t.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '6px'
              }}>
                {t.icon}
              </div>

              <div>
                <h4 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-main)' }}>{t.title}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────────────────
     DESIGN 4: Split Cockpit (65% Express Grid + 35% Live Store Pulse)
  ───────────────────────────────────────────────────────────────────────── */
  const renderSplitCockpit = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '65% 35%',
      gap: '24px',
      alignItems: 'start'
    }}>
      {/* 65% Main Canvas Stations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
          🚀 المحطات التشغيلية الرئيسية
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          
          <button
            onClick={() => navigate('/tailor-pos')}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '22px',
              border: '2px solid rgba(37,99,235,0.3)',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scissors size={24} strokeWidth={2.2} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb', background: 'rgba(37,99,235,0.08)', padding: '4px 10px', borderRadius: '8px' }}>الأكثر استخداماً</span>
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>طلب تفصيل ثوب جديد</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>أخذ المقاسات، اختيار الأقمشة والتطريز، إصدار الفاتورة</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/orders-board')}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '22px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(5,150,105,0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Factory size={24} strokeWidth={2.2} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669', background: 'rgba(5,150,105,0.08)', padding: '4px 10px', borderRadius: '8px' }}>14 جاري</span>
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>لوحة إنتاج المعمل</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>متابعة خطوط القص، الخياطة، الكوي ومحطة الباركود</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/customers')}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '22px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={24} strokeWidth={2.2} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '4px 10px', borderRadius: '8px' }}>دليل المقاسات</span>
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>العملاء وسجل المقاسات</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>البحث برقم الجوال، سجل الطلبات السابقة وبروفايل المقاس</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/stock')}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '18px',
              padding: '22px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(217,119,6,0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} strokeWidth={2.2} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#d97706', background: 'rgba(217,119,6,0.08)', padding: '4px 10px', borderRadius: '8px' }}>طاقات الأقمشة</span>
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>مخزون الأقمشة والمواد</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>أمتار الأقمشة، الأزرار، السحابات وفواتير المشتريات</p>
            </div>
          </button>

        </div>
      </div>

      {/* 35% Live Store Pulse & Telemetry */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>📊 نبض الوردية الحي</h3>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
        </div>

        {/* Cash Balance */}
        <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '14px' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>رصيد الدرج النقدي</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }} className="font-mono">
            {shift?.starting_cash ? Number(shift.starting_cash).toFixed(2) : '2,450.00'} ر.س
          </div>
        </div>

        {/* Live Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>مبيعات الوردية اليوم:</span>
            <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>3,820.00 ر.س</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>فواتير صادرة:</span>
            <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>18 فاتورة</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#065f46', fontWeight: '700' }}>أثواب جاهزة للتسليم:</span>
            <span style={{ fontWeight: '800', color: '#059669' }}>6 أثواب</span>
          </div>
        </div>

        {/* Urgent Alerts */}
        <div style={{ padding: '14px', background: 'rgba(220,38,38,0.05)', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: '700', fontSize: '12.5px' }}>
            <AlertTriangle size={16} />
            <span>٣ طلبات تجاوزت موعد التسليم في المعمل</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
          <button
            onClick={() => navigate('/shift?action=close')}
            style={{
              padding: '11px',
              background: 'rgba(220,38,38,0.06)',
              color: '#dc2626',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            🔒 إغلاق الوردية وتسليم النقدية
          </button>
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     DESIGN 5: Role-Adaptive Command Center (Tailor vs Cashier vs Manager)
  ───────────────────────────────────────────────────────────────────────── */
  const renderRoleAdaptive = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Role Switcher Pills */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '6px',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        display: 'inline-flex',
        alignSelf: 'flex-start',
        gap: '6px'
      }}>
        {[
          { id: 'tailor', label: '🧵 وضع الخياطة والتفصيل' },
          { id: 'cashier', label: '🛒 وضع الكاشير والمبيعات' },
          { id: 'manager', label: '💼 وضع الإدارة والمحاسبة' }
        ].map(r => (
          <button
            key={r.id}
            onClick={() => setActiveRole(r.id)}
            style={{
              padding: '9px 18px',
              borderRadius: '12px',
              border: 'none',
              background: activeRole === r.id ? '#2563eb' : 'transparent',
              color: activeRole === r.id ? '#ffffff' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Role-Specific Cards */}
      {activeRole === 'tailor' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          <button
            onClick={() => navigate('/tailor-pos')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '2px solid #2563eb', textAlign: 'right', cursor: 'pointer' }}
          >
            <Scissors size={32} color="#2563eb" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>تفصيل ثوب جديد</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>استقبال العميل، الموديل، والمقاسات</p>
          </button>

          <button
            onClick={() => navigate('/orders-board')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', textAlign: 'right', cursor: 'pointer' }}
          >
            <Factory size={32} color="#059669" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>مراحل المعمل والإنتاج</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>قص، خياطة، تطريز، كوي وجاهز</p>
          </button>

          <button
            onClick={() => navigate('/customers')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', textAlign: 'right', cursor: 'pointer' }}
          >
            <Users size={32} color="#7c3aed" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>سجل المقاسات</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>بحث المقاس برقم جوال العميل</p>
          </button>
        </div>
      )}

      {activeRole === 'cashier' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          <button
            onClick={() => navigate('/pos')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '2px solid #0284c7', textAlign: 'right', cursor: 'pointer' }}
          >
            <ShoppingCart size={32} color="#0284c7" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>نقطة البيع المباشر</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>أقمشة جاهزة وإكسسوارات فورية</p>
          </button>

          <button
            onClick={() => navigate('/sales-history')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', textAlign: 'right', cursor: 'pointer' }}
          >
            <FileText size={32} color="#059669" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>الفواتير والمبيعات</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>إعادة طباعة وإرسال واتساب للعميل</p>
          </button>

          <button
            onClick={() => navigate('/shift')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', textAlign: 'right', cursor: 'pointer' }}
          >
            <Wallet size={32} color="#d97706" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>إدارة الوردية والدرج</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>تسليم الكاش وجرد الوردية</p>
          </button>
        </div>
      )}

      {activeRole === 'manager' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '2px solid #7c3aed', textAlign: 'right', cursor: 'pointer' }}
          >
            <BarChart3 size={32} color="#7c3aed" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>لوحة التحليلات والأرباح</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>مراقبة الأداء اليومي والشهري</p>
          </button>

          <button
            onClick={() => navigate('/stock')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', textAlign: 'right', cursor: 'pointer' }}
          >
            <Package size={32} color="#d97706" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>إدارة المخزون والمشتريات</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>جرد الأقمشة وفواتير الموردين</p>
          </button>

          <button
            onClick={() => navigate('/settings')}
            style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)', textAlign: 'right', cursor: 'pointer' }}
          >
            <SettingsIcon size={32} color="#475569" />
            <h4 style={{ fontSize: '17px', fontWeight: '800', margin: '14px 0 6px 0', color: 'var(--text-main)' }}>إعدادات المنشأة والربط</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>ربط هيئة الزكاة، الطابعات، والواتساب</p>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Interactive Prototype Switcher Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '14px 20px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutGrid size={20} color="#38bdf8" />
          <span style={{ fontSize: '13.5px', fontWeight: '800' }}>مستعرض النماذج المقترحة (اختر النموذج لمعاينته حياً):</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'bento', label: '١. البطاقات الذكية المنظمة' },
            { id: 'funnel', label: '٢. مسار دورة العمل والمراحل' },
            { id: 'touch', label: '٣. شاشة الأزرار اللمسية السريعة' },
            { id: 'cockpit', label: '٤. لوحة التحكم المزدوجة' },
            { id: 'adaptive', label: '٥. مخصص حسب وظيفة الموظف' }
          ].map(d => (
            <button
              key={d.id}
              onClick={() => onSelectDesign(d.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '99px',
                border: currentDesign === d.id ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: currentDesign === d.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                color: currentDesign === d.id ? '#0f172a' : '#e2e8f0',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render the Selected Live Prototype Canvas */}
      {currentDesign === 'bento' && renderBentoCanvas()}
      {currentDesign === 'funnel' && renderProcessFunnel()}
      {currentDesign === 'touch' && renderTouchTerminal()}
      {currentDesign === 'cockpit' && renderSplitCockpit()}
      {currentDesign === 'adaptive' && renderRoleAdaptive()}

    </div>
  );
}
