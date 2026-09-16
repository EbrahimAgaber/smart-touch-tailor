import React, { useState, useEffect, useMemo } from 'react';
import MulamSubNav from '../components/mulam/MulamSubNav';
import { useToast } from '../components/ToastManager';
import {
  Scissors, Plus, Trash2, CheckCircle2, AlertTriangle, Search, Filter,
  Tag, Layers, RefreshCw, DollarSign, Package, FileSpreadsheet, X, Check
} from 'lucide-react';

export default function FabricRemnants() {
  const { showToast } = useToast?.() ?? { showToast: (m) => alert(m.message || m) };
  const [remnants, setRemnants] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'used' | 'scrapped'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [actionModal, setActionModal] = useState(null); // { type: 'use' | 'sell' | 'scrap', item }

  // New Remnant Form
  const [form, setForm] = useState({
    fabric_id: '',
    fabric_name: '',
    bolt_code: '',
    length_meters: '',
    width_inches: '58',
    classification: 'kids_thobe',
    storage_bin: 'درج فواضل 1',
    estimated_value: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.api?.tailor) {
        const [remData, fabData] = await Promise.all([
          window.api.tailor.getFabricRemnants?.().catch(() => []),
          window.api.tailor.getFabrics?.().catch(() => [])
        ]);
        setRemnants(Array.isArray(remData) ? remData : []);
        setFabrics(Array.isArray(fabData) ? fabData : []);
      }
    } catch (e) {
      console.error('Error loading remnants:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFabricSelect = (fabricId) => {
    const fab = fabrics.find(f => String(f.ID || f.id) === String(fabricId));
    if (fab) {
      setForm(prev => ({
        ...prev,
        fabric_id: fab.ID || fab.id,
        fabric_name: fab.Name,
        estimated_value: (parseFloat(prev.length_meters || 1) * (fab.Price * 0.5)).toFixed(0)
      }));
    }
  };

  const handleSaveNew = async (e) => {
    e.preventDefault();
    if (!form.fabric_name.trim()) {
      showToast?.({ type: 'error', message: 'يرجى اختيار نوع القماش' });
      return;
    }
    const len = parseFloat(form.length_meters);
    if (!len || len <= 0) {
      showToast?.({ type: 'error', message: 'يرجى إدخال طول الفاضل بالأمتار' });
      return;
    }

    try {
      if (window.api?.tailor?.saveFabricRemnant) {
        await window.api.tailor.saveFabricRemnant({
          ...form,
          length_meters: len,
          estimated_value: parseFloat(form.estimated_value || 0)
        });
        showToast?.({ type: 'success', message: 'تم تسجيل كسر الطاقة بنجاح' });
        setShowModal(false);
        setForm({
          fabric_id: '',
          fabric_name: '',
          bolt_code: '',
          length_meters: '',
          width_inches: '58',
          classification: 'kids_thobe',
          storage_bin: 'درج فواضل 1',
          estimated_value: '',
          notes: ''
        });
        loadData();
      }
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: 'تعذر حفظ الفاضل' });
    }
  };

  const handleApplyAction = async (actionType, remnantId, extra = {}) => {
    try {
      if (window.api?.tailor?.useFabricRemnant) {
        await window.api.tailor.useFabricRemnant({
          remnant_id: remnantId,
          action: actionType, // 'use' | 'sell' | 'scrap'
          ...extra
        });
        showToast?.({
          type: 'success',
          message: actionType === 'scrap' ? 'تم شطب الفاضل كهدر تالف' : (actionType === 'sell' ? 'تم تسجيل بيع الفاضل' : 'تم استخدام الفاضل في التفصيل')
        });
        setActionModal(null);
        loadData();
      }
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: 'تعذر تنفيذ العملية' });
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const available = remnants.filter(r => r.status === 'available');
    const used = remnants.filter(r => r.status === 'used');
    const scrapped = remnants.filter(r => r.status === 'written_off');

    const totalAvailableMeters = available.reduce((acc, r) => acc + (parseFloat(r.length_meters) || 0), 0);
    const totalAvailableValue = available.reduce((acc, r) => acc + (parseFloat(r.estimated_value) || 0), 0);
    const totalUsedMeters = used.reduce((acc, r) => acc + (parseFloat(r.length_meters) || 0), 0);
    const totalScrappedMeters = scrapped.reduce((acc, r) => acc + (parseFloat(r.length_meters) || 0), 0);

    const totalMeters = totalAvailableMeters + totalUsedMeters + totalScrappedMeters;
    const reuseRate = totalMeters > 0 ? ((totalUsedMeters / totalMeters) * 100).toFixed(1) : '100';

    return {
      availableCount: available.length,
      totalAvailableMeters: totalAvailableMeters.toFixed(1),
      totalAvailableValue: totalAvailableValue.toFixed(0),
      totalUsedMeters: totalUsedMeters.toFixed(1),
      totalScrappedMeters: totalScrappedMeters.toFixed(1),
      reuseRate
    };
  }, [remnants]);

  // Filtered List
  const filteredRemnants = useMemo(() => {
    return remnants.filter(r => {
      // Tab check
      if (activeTab === 'available' && r.status !== 'available') return false;
      if (activeTab === 'used' && r.status !== 'used') return false;
      if (activeTab === 'scrapped' && r.status !== 'written_off') return false;

      // Classification
      if (filterClass !== 'all' && r.classification !== filterClass) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fName = (r.fabric_name || '').toLowerCase();
        const bCode = (r.bolt_code || '').toLowerCase();
        const bin = (r.storage_bin || '').toLowerCase();
        return fName.includes(q) || bCode.includes(q) || bin.includes(q);
      }
      return true;
    });
  }, [remnants, activeTab, filterClass, searchQuery]);

  const classLabels = {
    kids_thobe: { label: 'يكفي ثوب أطفال', color: '#0284c7', bg: '#e0f2fe' },
    pants_pockets: { label: 'سراويل وجيوب', color: '#16a34a', bg: '#dcfce7' },
    collar_cuffs: { label: 'ياقات وحشوات وكبك', color: '#d97706', bg: '#fef3c7' },
    damaged_scrap: { label: 'قصاصات وهدر تالف', color: '#dc2626', bg: '#fee2e2' }
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <MulamSubNav activeTab="remnants" />

      <div style={{ flex: 1, padding: '20px 24px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Header Title & Add Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>
              🧵 إدارة فواضل وهدر الأقمشة (كسور الطاقات)
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              متابعة بواقي الطاقات، تصنيف الفواضل لأثواب الأطفال والسراويل، ومنع هدر وتلف الأقمشة
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
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
            <Plus size={18} />
            <span>تسجيل فاضل طاقة جديد</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>الفواضل المتوفرة بالمشغل</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
              {metrics.totalAvailableMeters} <span style={{ fontSize: '13px', fontWeight: 600 }}>متر</span>
            </div>
            <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', fontWeight: 700 }}>
              {metrics.availableCount} قطع قماش جاهزة للاستخدام
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>القيمة المقدرة للفواضل</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
              {metrics.totalAvailableValue} <span style={{ fontSize: '13px', fontWeight: 600 }}>ر.س</span>
            </div>
            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
              قابلة لإعادة التدوير والبيع
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>أمتار تم استغلالها بنجاح</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#2563eb', marginTop: '6px' }}>
              {metrics.totalUsedMeters} <span style={{ fontSize: '13px', fontWeight: 600 }}>متر</span>
            </div>
            <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '4px' }}>
              استُخدمت بأثواب أطفال وسراويل
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>إجمالي الهدر والتالف المشطوب</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626', marginTop: '6px' }}>
              {metrics.totalScrappedMeters} <span style={{ fontSize: '13px', fontWeight: 600 }}>متر</span>
            </div>
            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
              نسبة استغلال الأقمشة: {metrics.reuseRate}%
            </div>
          </div>
        </div>

        {/* Filter & Tabs Bar */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '14px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('available')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'available' ? '1px solid #0f172a' : '1px solid transparent',
                background: activeTab === 'available' ? '#0f172a' : 'transparent',
                color: activeTab === 'available' ? '#ffffff' : '#64748b',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              المتوفرة حالياً ({metrics.availableCount})
            </button>
            <button
              onClick={() => setActiveTab('used')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'used' ? '1px solid #0f172a' : '1px solid transparent',
                background: activeTab === 'used' ? '#0f172a' : 'transparent',
                color: activeTab === 'used' ? '#ffffff' : '#64748b',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              تم استخدامها
            </button>
            <button
              onClick={() => setActiveTab('scrapped')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeTab === 'scrapped' ? '1px solid #0f172a' : '1px solid transparent',
                background: activeTab === 'scrapped' ? '#0f172a' : 'transparent',
                color: activeTab === 'scrapped' ? '#ffffff' : '#64748b',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              سجل الشطب والتالف
            </button>
          </div>

          {/* Search & Classification Select */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                background: '#f8fafc'
              }}
            >
              <option value="all">كافة التصنيفات</option>
              <option value="kids_thobe">ثوب أطفال</option>
              <option value="pants_pockets">سراويل وجيوب</option>
              <option value="collar_cuffs">ياقات وحشوات</option>
              <option value="damaged_scrap">هدر وتالف</option>
            </select>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="بحث بالقماش، كود الطاقة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 12px 8px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#f8fafc',
                  width: '200px'
                }}
              />
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            </div>
          </div>
        </div>

        {/* Remnants Table / Cards */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {filteredRemnants.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Scissors size={36} strokeWidth={1.5} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>لا توجد فواضل أقمشة في هذا القسم</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>يمكنك تسجيل كسر طاقة جديد في أي وقت</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px' }}>
                    <th style={{ padding: '12px 16px' }}>نوع القماش</th>
                    <th style={{ padding: '12px 16px' }}>كود الطاقة</th>
                    <th style={{ padding: '12px 16px' }}>الطول</th>
                    <th style={{ padding: '12px 16px' }}>التصنيف المقترح</th>
                    <th style={{ padding: '12px 16px' }}>مكان الحفظ</th>
                    <th style={{ padding: '12px 16px' }}>القيمة</th>
                    <th style={{ padding: '12px 16px' }}>الحالة</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRemnants.map(item => {
                    const cInfo = classLabels[item.classification] || classLabels.kids_thobe;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                          {item.fabric_name}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>
                          {item.bolt_code || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0284c7' }}>
                          {item.length_meters} م
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '4px' }}>
                            ({(item.length_meters * 1.0936).toFixed(1)} ياردة)
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              background: cInfo.bg,
                              color: cInfo.color,
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            {cInfo.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {item.storage_bin || 'درج الفواضل'}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>
                          {item.estimated_value || 0} ر.س
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {item.status === 'available' ? (
                            <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                              متوفر
                            </span>
                          ) : item.status === 'used' ? (
                            <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                              تم الاستخدام
                            </span>
                          ) : (
                            <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                              مشطوب
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {item.status === 'available' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                title="استخدام في تفصيل ثوب"
                                onClick={() => handleApplyAction('use', item.id)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0284c7',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                استخدام
                              </button>
                              <button
                                type="button"
                                title="بيع الفاضل ككسر مخفض"
                                onClick={() => handleApplyAction('sell', item.id)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#16a34a',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                بيع كسر
                              </button>
                              <button
                                type="button"
                                title="شطب كهدر وتالف"
                                onClick={() => handleApplyAction('scrap', item.id)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fee2e2',
                                  background: '#fff1f2',
                                  color: '#e11d48',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                شطب
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {item.action_notes || '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal: New Remnant */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scissors size={18} color="#0f172a" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  تسجيل فاضل طاقة / كسر قماش
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNew} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  اختر القماش:
                </label>
                <select
                  value={form.fabric_id}
                  onChange={e => handleFabricSelect(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                >
                  <option value="">-- اختر القماش المتبقي منه الفاضل --</option>
                  {fabrics.map(f => (
                    <option key={f.ID || f.id} value={f.ID || f.id}>
                      {f.Name} ({f.Price} ر.س/متر)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    طول الفاضل (بالأمتار):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="مثال: 1.85"
                    value={form.length_meters}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        length_meters: v,
                        estimated_value: (parseFloat(v || 0) * 25).toFixed(0)
                      }));
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    كود / رقم الطاقة (اختياري):
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: B-402"
                    value={form.bolt_code}
                    onChange={e => setForm({ ...form, bolt_code: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    التصنيف الاستثماري:
                  </label>
                  <select
                    value={form.classification}
                    onChange={e => setForm({ ...form, classification: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="kids_thobe">ثوب أطفال (1.5 - 2.2 م)</option>
                    <option value="pants_pockets">سراويل وجيوب (0.8 - 1.4 م)</option>
                    <option value="collar_cuffs">ياقات وحشوات وكبك (0.3 - 0.7 م)</option>
                    <option value="damaged_scrap">هدر وتالف (قصاصات)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    مكان التخزين / الدرج:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: رف 3 - صندوق أ"
                    value={form.storage_bin}
                    onChange={e => setForm({ ...form, storage_bin: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  القيمة التقديرية / سعر البيع المخفض (ر.س):
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.estimated_value}
                  onChange={e => setForm({ ...form, estimated_value: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#0f172a', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
                >
                  حفظ الفاضل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
