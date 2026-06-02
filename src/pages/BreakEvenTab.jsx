/**
 * BreakEvenTab.jsx — P-021 Break-Even Analysis with pure SVG chart
 * No external chart dependencies. Sliders + SVG line chart.
 */
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const sar = (n) => Math.round(parseFloat(n) || 0).toLocaleString('ar-SA');

const S = {
  card: { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '4px', display: 'block' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box' },
};

function BreakEvenChart({ fixedCosts, variableCostPct, avgPrice }) {
  const vcRatio = variableCostPct / 100;
  const contribution = avgPrice * (1 - vcRatio);
  const bepUnits = contribution > 0 ? Math.ceil(fixedCosts / contribution) : 0;
  const bepRevenue = bepUnits * avgPrice;

  const maxUnits = Math.max(bepUnits * 2, 100);
  const width = 620, height = 320, padL = 80, padB = 50, padT = 30, padR = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxRevenue = maxUnits * avgPrice;

  const xScale = (u) => padL + (u / maxUnits) * chartW;
  const yScale = (v) => padT + chartH - (v / maxRevenue) * chartH;

  // Points for lines
  const revenuePoints = [[0, 0], [maxUnits, maxRevenue]];
  const totalCostPoints = [[0, fixedCosts], [maxUnits, fixedCosts + maxUnits * avgPrice * vcRatio]];

  const toPath = (pts) => pts.map(([u, v], i) => `${i === 0 ? 'M' : 'L'} ${xScale(u).toFixed(1)} ${yScale(v).toFixed(1)}`).join(' ');

  const bepX = xScale(bepUnits);
  const bepY = yScale(bepRevenue);

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(r => ({
    val: r * maxRevenue,
    y: padT + chartH * (1 - r),
    label: sar(r * maxRevenue),
  }));
  // X axis ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map(r => ({
    val: Math.round(r * maxUnits),
    x: padL + r * chartW,
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: '700px', display: 'block' }}>
        {/* Background grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={padL + chartW} y2={t.y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{t.label}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} y1={padT} x2={t.x} y2={padT + chartH} stroke="#f8fafc" strokeWidth="1" />
            <text x={t.x} y={padT + chartH + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{t.val}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="1" />

        {/* Fixed cost line */}
        <line x1={padL} y1={yScale(fixedCosts)} x2={padL + chartW} y2={yScale(fixedCosts)}
          stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,4" />
        <text x={padL + chartW - 4} y={yScale(fixedCosts) - 6} textAnchor="end" fontSize="10" fill="#f59e0b" fontWeight="bold">
          التكاليف الثابتة
        </text>

        {/* Revenue line */}
        <path d={toPath(revenuePoints)} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
        <text x={padL + chartW - 4} y={yScale(maxRevenue) - 6} textAnchor="end" fontSize="10" fill="#3b82f6" fontWeight="bold">
          الإيراد
        </text>

        {/* Total cost line */}
        <path d={toPath(totalCostPoints)} fill="none" stroke="#ef4444" strokeWidth="2.5" />
        <text x={padL + 60} y={yScale(fixedCosts + 60 * avgPrice * vcRatio) - 8} textAnchor="start" fontSize="10" fill="#ef4444" fontWeight="bold">
          إجمالي التكاليف
        </text>

        {/* Profit zone */}
        {bepUnits > 0 && bepUnits < maxUnits && (
          <rect x={bepX} y={padT} width={padL + chartW - bepX} height={chartH}
            fill="#10b981" opacity="0.06" />
        )}

        {/* BEP marker */}
        {bepUnits > 0 && bepUnits <= maxUnits && (
          <g>
            <line x1={bepX} y1={padT} x2={bepX} y2={padT + chartH} stroke="#10b981" strokeWidth="2" strokeDasharray="4,3" />
            <circle cx={bepX} cy={bepY} r="6" fill="#10b981" />
            <text x={bepX + 8} y={bepY - 8} fontSize="11" fill="#10b981" fontWeight="bold">
              نقطة التعادل: {bepUnits} وحدة
            </text>
            <text x={bepX + 8} y={bepY + 6} fontSize="10" fill="#10b981">
              {sar(bepRevenue)} ر.س
            </text>
          </g>
        )}

        {/* Axis labels */}
        <text x={padL + chartW / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="#64748b">
          عدد الوحدات المباعة
        </text>
        <text x={14} y={padT + chartH / 2} textAnchor="middle" fontSize="11" fill="#64748b"
          transform={`rotate(-90, 14, ${padT + chartH / 2})`}>
          الإيراد (ر.س)
        </text>
      </svg>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
        {[
          { label: 'نقطة التعادل (وحدات)', val: bepUnits.toLocaleString('ar-SA'), color: '#10b981' },
          { label: 'نقطة التعادل (ر.س)', val: `${sar(bepRevenue)} ر.س`, color: '#3b82f6' },
          { label: 'هامش المساهمة', val: `${sar(contribution)} ر.س/وحدة`, color: '#8b5cf6' },
          { label: 'نسبة هامش المساهمة', val: `${((1 - vcRatio) * 100).toFixed(1)}%`, color: '#f59e0b' },
        ].map((item, i) => (
          <div key={i} style={{ flex: '1', minWidth: '140px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${item.color}20` }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BreakEvenTab() {
  const [inputs, setInputs] = useState({ fixedCosts: 5000, variableCostPct: 40, avgPrice: 100 });
  const [loading, setLoading] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api.p2.getBreakEvenInputs().then(data => {
      if (data && (data.fixedCosts > 0 || data.avgPrice > 1)) {
        setInputs({
          fixedCosts: data.fixedCosts || 5000,
          variableCostPct: data.variableCostPct || 40,
          avgPrice: data.avgPrice || 100,
        });
        setAutoLoaded(true);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (field, val) => setInputs(v => ({ ...v, [field]: parseFloat(val) || 0 }));

  return (
    <div dir="rtl" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', opacity: loading ? 0.6 : 1 }}>
      {/* Controls */}
      <div style={S.card}>
        <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>تحليل التعادل</h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
          {autoLoaded ? '✓ تم تحميل البيانات من آخر 3 أشهر' : 'أدخل قيم يدوياً أو حمّل من الدفاتر'}
        </p>

        {[
          { label: 'التكاليف الثابتة الشهرية (ر.س)', field: 'fixedCosts', min: 0, max: 500000, step: 100 },
          { label: 'نسبة التكاليف المتغيرة (%)', field: 'variableCostPct', min: 0, max: 99, step: 1 },
          { label: 'متوسط سعر البيع (ر.س)', field: 'avgPrice', min: 1, max: 100000, step: 1 },
        ].map(f => (
          <div key={f.field} style={{ marginBottom: '18px' }}>
            <label style={S.label}>
              {f.label}: <strong style={{ color: '#0f172a' }}>
                {f.field === 'variableCostPct' ? `${inputs[f.field]}%` : `${sar(inputs[f.field])} ر.س`}
              </strong>
            </label>
            <input type="range" min={f.min} max={f.max} step={f.step} value={inputs[f.field]}
              onChange={e => set(f.field, e.target.value)}
              style={{ width: '100%', accentColor: '#3b82f6' }} />
            <input type="number" value={inputs[f.field]} min={f.min} max={f.max} step={f.step}
              onChange={e => set(f.field, e.target.value)}
              style={{ ...S.input, marginTop: '6px', padding: '6px 10px' }} />
          </div>
        ))}

        <button onClick={() => {
          setLoading(true);
          window.api.p2.getBreakEvenInputs().then(data => {
            if (data) setInputs({ fixedCosts: data.fixedCosts || 5000, variableCostPct: data.variableCostPct || 40, avgPrice: data.avgPrice || 100 });
            setLoading(false);
          }).catch(() => setLoading(false));
        }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', color: '#64748b', fontFamily: 'inherit', fontWeight: '700' }}>
          <RefreshCw size={13} /> تحديث من الدفاتر
        </button>
      </div>

      {/* Chart */}
      <div style={S.card}>
        <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' }}>
          مخطط نقطة التعادل
        </h3>
        <BreakEvenChart
          fixedCosts={inputs.fixedCosts}
          variableCostPct={inputs.variableCostPct}
          avgPrice={inputs.avgPrice}
        />
        <div style={{ marginTop: '20px', padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
          <strong>كيفية القراءة:</strong> حيث يتقاطع خط الإيراد (أزرق) مع خط التكاليف الكلية (أحمر) هي نقطة التعادل. 
          المنطقة الخضراء تمثل الربح، والمنطقة البيضاء تمثل الخسارة.
        </div>
      </div>
    </div>
  );
}

export default BreakEvenTab;
