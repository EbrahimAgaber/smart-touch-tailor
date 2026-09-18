import { useState, useEffect, useMemo, useRef } from 'react';
import { openWhatsApp } from '../utils/whatsapp';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../App';
import AppLayout from '../components/AppLayout';
import {
  Search, UserPlus, Phone, Mail, MapPin, Award,
  X, Save, Edit3, ChevronDown, ChevronUp, ShoppingBag, Star, FileText, PlusCircle, Ruler, GitMerge
} from 'lucide-react';

const BLANK = { 
  name: '', phone: '', email: '', address: '', tax_id: '',
  id_type: 'CRN', id_value: '',
  na_short: '', na_building: '', na_street: '', na_secondary: '',
  na_district: '', na_postal: '', na_city: '', na_country: 'المملكة العربية السعودية',
  tags: '', notes: ''
};

// ID_TYPES labels are translated at render time via t()
const ID_TYPE_KEYS = ['CRN','PAS','MOM','MLS','SAG','GCC','OTH'];

export default function Customers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { businessType } = useAppSettings();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

  // Statement modal state
  const [stmtCustomer, setStmtCustomer] = useState(null);
  const [stmtData, setStmtData]         = useState(null);
  const [stmtLoading, setStmtLoading]   = useState(false);
  const [stmtPayAmt, setStmtPayAmt]     = useState('');
  const [stmtPayNote, setStmtPayNote]   = useState('');
  const [stmtPayLoading, setStmtPayLoading] = useState(false);
  const [stmtPayError, setStmtPayError]  = useState('');

  // CRM Campaign state
  const [tierFilter, setTierFilter] = useState('');
  const [showCampaign, setShowCampaign] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState('مرحباً، لدينا عرض خاص لك!');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // Phase 1 - Merge Tool
  const [mergePrimary, setMergePrimary] = useState(null);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [mergeDuplicate, setMergeDuplicate] = useState(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => { fetchCustomers(); }, [search, tierFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await window.api.getCustomers({ search, tier: tierFilter || undefined });
      setCustomers(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(BLANK);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ 
      name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', tax_id: c.tax_id || '',
      id_type: c.id_type || 'CRN', id_value: c.id_value || '',
      na_short: c.na_short || '', na_building: c.na_building || '', na_street: c.na_street || '', 
      na_secondary: c.na_secondary || '', na_district: c.na_district || '', na_postal: c.na_postal || '', 
      na_city: c.na_city || '', na_country: c.na_country || 'المملكة العربية السعودية',
      tags: c.tags || '', notes: c.notes || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const openStatement = async (c) => {
    setStmtCustomer(c);
    setStmtLoading(true);
    setStmtData(null);
    setStmtPayAmt('');
    setStmtPayNote('');
    setStmtPayError('');
    try {
      const data = await window.api.getCustomerStatementBasic(c.id);
      setStmtData(data || { entries: [], balance: 0 });
    } catch(e) { setStmtData({ entries: [], balance: 0 }); }
    setStmtLoading(false);
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(stmtPayAmt);
    if (!amount || amount <= 0) { setStmtPayError('أدخل مبلغاً صحيحاً'); return; }
    setStmtPayLoading(true);
    setStmtPayError('');
    try {
      await window.api.recordCustomerPaymentBasic({ customer_id: stmtCustomer.id, amount, note: stmtPayNote });
      setStmtPayAmt('');
      setStmtPayNote('');
      const data = await window.api.getCustomerStatementBasic(stmtCustomer.id);
      setStmtData(data || { entries: [], balance: 0 });
      fetchCustomers();
    } catch(e) { setStmtPayError(e.message || 'فشل التسجيل'); }
    setStmtPayLoading(false);
  };

  const openHistory = async (c) => {
    setHistoryCustomer(c);
    setHistoryLoading(true);
    try {
      const data = await window.api.getCustomerHistory(c.id);
      setHistory(data || []);
    } catch (e) { setHistory([]); }
    setHistoryLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError(t('customers.modal.name_required'));
    try {
      if (editingId) {
        await window.api.updateCustomer({ ...form, id: editingId });
      } else {
        await window.api.addCustomer(form);
      }
      setShowModal(false);
      setEditingId(null);
      setForm(BLANK);
      fetchCustomers();
    } catch (err) {
      setFormError(t('customers.modal.save_error') + (err.message || ''));
    }
  };

  const tierColor = (tier) => {
    if (tier === 'gold')   return { bg: '#fef3c7', color: '#d97706', label: t('customers.tiers.gold') };
    if (tier === 'silver') return { bg: '#f1f5f9', color:'var(--text-muted)', label: t('customers.tiers.silver') };
    return                        { bg: '#fef9f0', color: '#b45309', label: t('customers.tiers.bronze') };
  };

  const handleMergeSearch = async () => {
      if (!mergeSearch.trim()) return;
      try {
          const res = await window.api.getCustomers({ search: mergeSearch });
          setMergeCandidates((res || []).filter(c => c.id !== mergePrimary?.id));
      } catch (err) {
          console.error(err);
      }
  };

  const executeMerge = async () => {
      if (!mergePrimary || !mergeDuplicate) return;
      setMerging(true);
      try {
          await window.api.tailor?.mergeCustomers({ primary_id: mergePrimary.id, duplicate_id: mergeDuplicate.id });
          setMergePrimary(null);
          setMergeDuplicate(null);
          setMergeSearch('');
          setMergeCandidates([]);
          fetchCustomers();
      } catch (err) {
          alert('Error merging: ' + err.message);
      }
      setMerging(false);
  };

  const totalPoints = customers.reduce((s, c) => s + (c.loyalty_points || 0), 0);
  const totalSpent  = customers.reduce((s, c) => s + (c.total_spent   || 0), 0);

  return (
    <AppLayout title={t('customers.title')}>
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { label:t('customers.stats.total'),         value: customers.length,             color:'#3b82f6', icon:'👥' },
            { label:t('customers.stats.loyalty_points'),value: totalPoints.toLocaleString(), color:'#8b5cf6', icon:'⭐' },
            { label:t('customers.stats.total_spent'),   value:`SAR ${totalSpent.toFixed(0)}`,color:'#10b981', icon:'🛍️' },
          ].map(s => (
            <div key={s.label} className="hover-lift" style={{ background:'var(--bg-card)', border:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:'32px' }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>{s.label}</div>
                <div style={{ fontSize:'22px', fontWeight:'900', color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-4 sm:p-5 rounded-2xl border border-subtle gap-4 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={18} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('customers.controls.search_placeholder')}
                style={{ width:'100%', padding:'11px 44px 11px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit' }}
              />
            </div>
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              style={{ padding:'11px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit', backgroundColor:'#f8fafc', color:'var(--text-main)' }}
            >
              <option value="">جميع الفئات</option>
              <option value="bronze">برونزي</option>
              <option value="silver">فضي</option>
              <option value="gold">ذهبي</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCampaign(true)} style={{ ...primaryBtnStyle, background:'#10b981', color:'white' }}>
              💬 حملة واتساب
            </button>
            <button onClick={openAdd} style={primaryBtnStyle}>
              <UserPlus size={18} /> {t('customers.controls.add_btn')}
            </button>
          </div>
        </div>

        {/* CUSTOMER TABLE */}
        <div className="hover-lift" style={{ background:'var(--bg-card)', border:'1px solid #f1f5f9', overflowY:'auto', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', flex:1, minHeight:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
            <thead style={{ background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' }}>
              <tr>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>{t('customers.table.customer')}</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>{t('customers.table.phone')}</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }} className="max-md:hidden">{t('customers.table.loyalty_points')}</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }} className="max-lg:hidden">{t('customers.table.tier')}</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }} className="max-md:hidden">{t('customers.table.total_spent')}</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }} className="max-xl:hidden">{t('customers.table.registered')}</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>{t('customers.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding:'60px', textAlign:'center', color:'var(--text-muted)' }}>{t('customers.table.loading')}</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:'60px', textAlign:'center', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.4 }}>👥</div>
                  {search ? t('customers.table.no_results') : t('customers.table.no_customers')}
                </td></tr>
              ) : customers.map(c => {
                const tier = tierColor(c.tier);
                return (
                  <tr key={c.id} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={tdStyle}>
                      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', color:'#3b82f6', fontSize:'16px', border:'2px solid #dbeafe', flexShrink:0 }}>
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight:'700', color:'var(--text-main)' }}>{c.name}</div>
                          {c.email && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        {c.phone ? (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(c.phone);
                            }}
                            style={{ cursor: 'pointer', color: '#0369a1', textDecoration: 'underline' }}
                            title={t('customers.table.whatsapp_title')}
                          >
                            {c.phone}
                          </span>
                        ) : <span style={{ color:'#cbd5e1' }}>—</span>}
                        {c.phone && (
                          <button onClick={() => openWhatsApp(c.phone)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#10b981', display:'flex', alignItems:'center', padding:'2px' }} title={t('customers.table.whatsapp_title')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle} className="max-md:hidden">
                      <span style={{ display:'flex', alignItems:'center', gap:'5px', fontWeight:'700', color:'#8b5cf6' }}>
                        <Star size={14} /> {c.loyalty_points || 0}
                      </span>
                    </td>
                    <td style={tdStyle} className="max-lg:hidden">
                      <span style={{ background: tier.bg, color: tier.color, padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:'700' }}>{tier.label}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight:'700', color:'#10b981', fontFamily: "'Inter', sans-serif" }} className="max-md:hidden">SAR {(c.total_spent || 0).toFixed(0)}</td>
                    <td style={{ ...tdStyle, color:'var(--text-muted)', fontSize:'12px' }} className="max-xl:hidden">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => openStatement(c)} style={iconBtn('#8b5cf6','#f5f3ff')} title="كشف حساب">
                          <FileText size={15} />
                        </button>
                        <button onClick={() => openHistory(c)} style={iconBtn('#3b82f6','#eff6ff')} title={t('customers.table.purchase_history_title')}>
                          <ShoppingBag size={15} />
                        </button>
                        <button onClick={() => openEdit(c)} style={iconBtn('#f59e0b','#fef3c7')} title={t('customers.table.edit_title')}>
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => setMergePrimary(c)} style={iconBtn('#8b5cf6','#ede9fe')} title="دمج ملف العميل">
                          <GitMerge size={16} />
                        </button>
                        {businessType === 'tailor' && (
                          <>
                            <button
                              onClick={() => navigate(`/tailor-pos?customerId=${c.id}&phone=${encodeURIComponent(c.phone || '')}&name=${encodeURIComponent(c.name || '')}`)}
                              style={{ ...iconBtn('#10b981', '#ecfdf5'), display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'auto', padding: '0 8px', fontSize: '11px', fontWeight: 800 }}
                              title="✂️ تفصيل جديد لهذا العميل"
                            >
                              <span>✂️</span> <span>تفصيل</span>
                            </button>
                            <button
                              onClick={() => navigate(`/measurements?customer_id=${c.id}`)}
                              style={{ ...iconBtn('#6366f1', '#eef2ff'), display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'auto', padding: '0 8px', fontSize: '11px', fontWeight: 800 }}
                              title="📐 عرض وتعديل المقاسات"
                            >
                              <Ruler size={13} /> <span>المقاسات</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CUSTOMER STATEMENT MODAL ────────────────── */}
      {stmtCustomer && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setStmtCustomer(null)}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', maxWidth:'660px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">

            {/* Header */}
            <div style={{ padding:'20px 28px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#f5f3ff,#ede9fe30)' }}>
              <div>
                <h3 style={{ fontWeight:'900', fontSize:'18px', margin:0, color:'var(--text-main)', display:'flex', alignItems:'center', gap:'8px' }}>
                  <FileText size={18} color="#8b5cf6" /> كشف حساب — {stmtCustomer.name}
                </h3>
                {stmtCustomer.phone && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>📞 {stmtCustomer.phone}</div>}
              </div>
              <button onClick={() => setStmtCustomer(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>

            {/* Balance banner */}
            {stmtData && (
              <div style={{ padding:'12px 28px', background: stmtData.balance > 0 ? '#fef2f2' : '#ecfdf5', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:'700', fontSize:'13px', color: stmtData.balance > 0 ? '#dc2626' : '#10b981' }}>
                  {stmtData.balance > 0 ? '💳 الرصيد المستحق (دين)' : '✅ لا يوجد رصيد مستحق'}
                </span>
                <span style={{ fontWeight:'900', fontSize:'22px', color: stmtData.balance > 0 ? '#dc2626' : '#10b981', fontFamily:"'Inter',sans-serif" }}>
                  SAR {parseFloat(stmtData.balance || 0).toFixed(2)}
                </span>
              </div>
            )}

            {/* Timeline table */}
            <div style={{ flex:1, overflowY:'auto', padding:'12px 28px' }}>
              {stmtLoading ? (
                <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>⏳ جاري التحميل...</div>
              ) : !stmtData || stmtData.entries.length === 0 ? (
                <div style={{ textAlign:'center', padding:'50px', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px', opacity:.4 }}>📋</div>
                  لا توجد حركات مسجّلة
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                      <th style={{ padding:'8px 10px', textAlign:'right', color:'var(--text-muted)', fontWeight:'700', fontSize:'11px' }}>التاريخ</th>
                      <th style={{ padding:'8px 10px', textAlign:'right', color:'var(--text-muted)', fontWeight:'700', fontSize:'11px' }}>البيان</th>
                      <th style={{ padding:'8px 10px', textAlign:'center', color:'#dc2626', fontWeight:'700', fontSize:'11px' }}>مدين (SAR)</th>
                      <th style={{ padding:'8px 10px', textAlign:'center', color:'#10b981', fontWeight:'700', fontSize:'11px' }}>دائن (SAR)</th>
                      <th style={{ padding:'8px 10px', textAlign:'center', color:'var(--text-muted)', fontWeight:'700', fontSize:'11px' }}>الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stmtData.entries.map((row, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #f8fafc', background: i % 2 === 0 ? 'transparent' : '#fafbfc' }}>
                        <td style={{ padding:'10px', color:'var(--text-muted)', fontSize:'12px', whiteSpace:'nowrap' }}>
                          {row.date ? new Date(row.date).toLocaleDateString('ar-SA') : '—'}
                        </td>
                        <td style={{ padding:'10px', color:'var(--text-main)', fontWeight:'600' }}>
                          {row.type === 'payment' ? (
                            <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              <span style={{ background:'#ecfdf5', color:'#10b981', borderRadius:'6px', padding:'2px 8px', fontSize:'10px', fontWeight:'800' }}>دفعة</span>
                              {row.note || 'تحصيل دفعة'}
                            </span>
                          ) : (
                            <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              <span style={{ background:'#fef2f2', color:'#dc2626', borderRadius:'6px', padding:'2px 8px', fontSize:'10px', fontWeight:'800' }}>فاتورة</span>
                              {row.invoice_number || row.reference || `#${row.id}`}
                            </span>
                          )}
                        </td>
                        <td style={{ padding:'10px', textAlign:'center', fontWeight:'700', color:'#dc2626', fontFamily:"'Inter',sans-serif" }}>
                          {row.debit > 0 ? parseFloat(row.debit).toFixed(2) : '—'}
                        </td>
                        <td style={{ padding:'10px', textAlign:'center', fontWeight:'700', color:'#10b981', fontFamily:"'Inter',sans-serif" }}>
                          {row.credit > 0 ? parseFloat(row.credit).toFixed(2) : '—'}
                        </td>
                        <td style={{ padding:'10px', textAlign:'center', fontWeight:'800', color: parseFloat(row.running_balance||0) > 0.005 ? '#dc2626' : '#10b981', fontFamily:"'Inter',sans-serif" }}>
                          {parseFloat(row.running_balance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Receive Payment form */}
            <div style={{ padding:'14px 28px 18px', borderTop:'1px solid #f1f5f9', background:'#f8fafc' }}>
              <div style={{ fontSize:'13px', fontWeight:'800', color:'#8b5cf6', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
                <PlusCircle size={15} /> تحصيل دفعة
              </div>
              {stmtPayError && (
                <div style={{ padding:'8px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', color:'#dc2626', fontSize:'12px', fontWeight:'700', marginBottom:'8px' }}>
                  ⚠️ {stmtPayError}
                </div>
              )}
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
                <div style={{ flex:'0 0 130px' }}>
                  <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', marginBottom:'4px' }}>المبلغ (ر.س)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={stmtPayAmt}
                    onChange={e => setStmtPayAmt(e.target.value)}
                    placeholder="0.00"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'15px', fontWeight:'700', fontFamily:"'Inter',sans-serif", outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', marginBottom:'4px' }}>ملاحظة (اختياري)</label>
                  <input
                    type="text"
                    value={stmtPayNote}
                    onChange={e => setStmtPayNote(e.target.value)}
                    placeholder="مثل: دفعة نقدية، تحويل بنكي..."
                    style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <button
                  onClick={handleRecordPayment}
                  disabled={stmtPayLoading || !stmtPayAmt}
                  style={{ padding:'10px 20px', flexShrink:0, background: stmtPayLoading || !stmtPayAmt ? '#e2e8f0' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: stmtPayLoading || !stmtPayAmt ? '#94a3b8' : 'white', border:'none', borderRadius:'10px', fontWeight:'800', fontSize:'13px', cursor: stmtPayLoading || !stmtPayAmt ? 'not-allowed' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'6px' }}>
                  <Save size={14} /> {stmtPayLoading ? '...' : 'تسجيل'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ─────────────────────── */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', maxWidth:'560px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9', flexShrink: 0 }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', margin:0 }}>{editingId ? t('customers.modal.edit_title') : t('customers.modal.add_title')}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', overflow:'hidden', flex: 1 }}>
              <div style={{ padding:'24px 32px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap:'16px' }}>
                {formError && (
                  <div style={{ padding:'12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', color:'#dc2626', fontSize:'13px', fontWeight:'700' }}>
                    ⚠️ {formError}
                  </div>
                )}
                <CField label={t('customers.modal.name_label')} value={form.name} onChange={v => setForm({...form, name: v})} placeholder={t('customers.modal.name_placeholder')} required />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <CField label={t('customers.modal.phone_label')} value={form.phone} onChange={v => setForm({...form, phone: v})} placeholder="05XXXXXXXX" />
                  <CField label={t('customers.modal.tax_id_label')} value={form.tax_id} onChange={v => setForm({...form, tax_id: v})} placeholder={t('customers.modal.tax_id_placeholder')} />
                </div>
                
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div>
                    <label style={cLabel}>{t('customers.modal.other_id_label')}</label>
                    <select value={form.id_type} onChange={e => setForm({...form, id_type: e.target.value})} style={cInput}>
                      {ID_TYPE_KEYS.map(k => <option key={k} value={k}>{t(`customers.id_types.${k}`)}</option>)}
                    </select>
                  </div>
                  <CField label={t('customers.modal.id_value_label')} value={form.id_value} onChange={v => setForm({...form, id_value: v})} placeholder={t('customers.modal.id_value_placeholder')} />
                </div>
                
                <CField label={t('customers.modal.email_label')} type="email" value={form.email} onChange={v => setForm({...form, email: v})} placeholder="example@email.com" />
                <div>
                  <label style={cLabel}>{t('customers.modal.address_label')}</label>
                  <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    style={{ ...cInput, minHeight:'70px', resize:'vertical' }} placeholder={t('customers.modal.address_placeholder')} />
                </div>
                
                <CField label="Tags (e.g. VIP, Wholesale)" value={form.tags} onChange={v => setForm({...form, tags: v})} placeholder="Comma separated tags" />
                <div>
                  <label style={cLabel}>Notes (Preferences, allergies, etc.)</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    style={{ ...cInput, minHeight:'70px', resize:'vertical' }} placeholder="Customer preferences..." />
                </div>

                {/* National Address section */}
                <div style={{ borderTop:'1px dashed #e2e8f0', paddingTop:'16px', marginTop:'4px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'800', color:'#3b82f6', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    {t('customers.modal.na_title')}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <CField label={t('customers.modal.na_short')} value={form.na_short} onChange={v => setForm({...form, na_short: v})} placeholder="TTPA8255" />
                    <CField label={t('customers.modal.na_building')} value={form.na_building} onChange={v => setForm({...form, na_building: v})} placeholder="8255" />
                    <CField label={t('customers.modal.na_street')} value={form.na_street} onChange={v => setForm({...form, na_street: v})} placeholder="الحارث بن عمير" />
                    <CField label={t('customers.modal.na_secondary')} value={form.na_secondary} onChange={v => setForm({...form, na_secondary: v})} placeholder="2660" />
                    <CField label={t('customers.modal.na_district')} value={form.na_district} onChange={v => setForm({...form, na_district: v})} placeholder="حي الحمراء" />
                    <CField label={t('customers.modal.na_postal')} value={form.na_postal} onChange={v => setForm({...form, na_postal: v})} placeholder="29763" />
                    <CField label={t('customers.modal.na_city')} value={form.na_city} onChange={v => setForm({...form, na_city: v})} placeholder="الرياض" />
                    <CField label={t('customers.modal.na_country')} value={form.na_country} onChange={v => setForm({...form, na_country: v})} placeholder="المملكة العربية السعودية" />
                  </div>
                </div>

              </div>
              <div style={{ padding:'16px 32px', borderTop:'1px solid #f1f5f9', background:'var(--bg-card)', flexShrink: 0 }}>
                <button type="submit" style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'14px', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Save size={17} /> {editingId ? t('customers.modal.update_btn') : t('customers.modal.save_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PURCHASE HISTORY MODAL ───────────────── */}
      {historyCustomer && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setHistoryCustomer(null)}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', maxWidth:'620px', width:'95%', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-card)' }}>
              <div>
                <h3 style={{ fontWeight:'800', fontSize:'18px' }}>{t('customers.history.title', { name: historyCustomer.name })}</h3>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{t('customers.history.subtitle', { spent: (historyCustomer.total_spent||0).toFixed(2), points: historyCustomer.loyalty_points })}</div>
              </div>
              <button onClick={() => setHistoryCustomer(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {historyLoading ? (
                <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>{t('customers.history.loading')}</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.4 }}>🛒</div>
                  {t('customers.history.no_purchases')}
                </div>
              ) : history.map((sale, i) => (
                <div key={i} style={{ border:'1px solid #f1f5f9', borderRadius:'14px', marginBottom:'12px', overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px', background:'var(--bg-card)', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                    onClick={() => setExpandedCard(expandedCard === i ? null : i)}>
                    <div>
                      <div style={{ fontWeight:'700', fontSize:'14px', color:'#3b82f6', fontFamily:'monospace' }}>#{sale.invoice}</div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>
                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('ar-SA') : '—'} • {sale.payment}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <span style={{ fontWeight:'800', color:'#10b981' , fontFamily: "'Inter', sans-serif"}}>SAR {parseFloat(sale.total||0).toFixed(2)}</span>
                      <span style={{ background: sale.status==='void' ? '#fef2f2' : '#ecfdf5', color: sale.status==='void' ? '#ef4444' : '#10b981', padding:'3px 8px', borderRadius:'99px', fontSize:'11px', fontWeight:'700' }}>
                        {sale.status==='void' ? t('customers.history.void') : t('customers.history.completed')}
                      </span>
                      {expandedCard === i ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                  </div>
                  {expandedCard === i && (
                    <div style={{ padding:'12px 16px' }}>
                      {(sale.items || []).map((it, j) => (
                        <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed #f1f5f9', fontSize:'13px' }}>
                          <span style={{ color:'var(--text-muted)' }}>{it.Name} × {it.Qty}</span>
                          <span style={{ fontWeight:'700' , fontFamily: "'Inter', sans-serif"}}>SAR {(it.Price * it.Qty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── CAMPAIGN MODAL ─────────────────────── */}
      {showCampaign && (
        <div style={overlayStyle}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', maxWidth:'600px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9', flexShrink: 0 }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', margin:0 }}>🚀 حملة واتساب الترويجية</h2>
              <button onClick={() => setShowCampaign(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>
            <div style={{ padding:'24px 32px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={cLabel}>قالب الرسالة</label>
                <textarea
                  value={campaignMessage}
                  onChange={e => setCampaignMessage(e.target.value)}
                  style={{ ...cInput, minHeight:'100px', resize:'vertical' }}
                  placeholder="أدخل رسالتك الترويجية هنا..."
                />
              </div>
              <div style={{ fontWeight:'700', color:'var(--text-muted)' }}>العملاء المستهدفين ({customers.filter(c => c.phone).length})</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {customers.filter(c => c.phone).map(c => (
                  <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', background:'#f8fafc', borderRadius:'12px', border:'1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight:'700' }}>{c.name}</div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{c.phone}</div>
                    </div>
                    <button
                      onClick={() => openWhatsApp(c.phone, campaignMessage)}
                      style={{ background:'#10b981', color:'white', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontWeight:'700', fontSize:'12px' }}
                    >
                      إرسال رسالة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergePrimary && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
          <div style={{ background:'var(--bg-card)', padding:'30px', borderRadius:'20px', width:'100%', maxWidth:'600px', boxShadow:'0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', margin:0, color:'var(--text-main)' }}>دمج ملف العميل</h2>
              <button onClick={() => setMergePrimary(null)} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={24} /></button>
            </div>
            
            <p style={{ color:'var(--text-muted)' }}>اختر العميل المكرر لدمجه في الملف الأساسي: <strong>{mergePrimary.name} ({mergePrimary.phone})</strong></p>
            <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
              <input type="text" value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال..." style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1px solid var(--border-subtle)', background:'var(--bg-app)', color:'var(--text-main)' }} />
              <button onClick={handleMergeSearch} style={{ padding:'12px 20px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:'10px', cursor:'pointer' }}>بحث</button>
            </div>
            
            <div style={{ maxHeight:'200px', overflowY:'auto', marginBottom:'20px' }}>
              {mergeCandidates.map(c => (
                <div key={c.id} onClick={() => setMergeDuplicate(c)} style={{ padding:'12px', border:'1px solid', borderColor: mergeDuplicate?.id === c.id ? '#10b981' : 'var(--border-subtle)', borderRadius:'10px', marginBottom:'10px', cursor:'pointer', background: mergeDuplicate?.id === c.id ? '#ecfdf5' : 'var(--bg-app)' }}>
                  <div style={{ fontWeight:'bold', color:'var(--text-main)' }}>{c.name}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{c.phone} | طلبات: {c.total_spent > 0 ? 'يوجد' : 'لا يوجد'}</div>
                </div>
              ))}
            </div>

            {mergeDuplicate && (
              <div style={{ padding:'15px', background:'#fee2e2', color:'#ef4444', borderRadius:'10px', marginBottom:'20px', fontSize:'14px' }}>
                <strong>تحذير:</strong> سيتم دمج جميع طلبات ومقاسات "{mergeDuplicate.name}" إلى "{mergePrimary.name}". وسيتم حذف الملف المكرر نهائياً.
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:'12px' }}>
              <button onClick={() => setMergePrimary(null)} style={{ padding:'12px 24px', borderRadius:'12px', background:'var(--bg-app)', color:'var(--text-main)', border:'1px solid var(--border-subtle)', cursor:'pointer', fontWeight:700 }}>إلغاء</button>
              <button onClick={executeMerge} disabled={!mergeDuplicate || merging} style={{ padding:'12px 24px', borderRadius:'12px', background: !mergeDuplicate ? '#999' : '#ef4444', color:'white', border:'none', cursor: !mergeDuplicate ? 'not-allowed' : 'pointer', fontWeight:900 }}>
                {merging ? 'جاري الدمج...' : 'تأكيد الدمج'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function CField({ label, value, onChange, type='text', placeholder='', required=false }) {
  return (
    <div>
      <label style={cLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} style={cInput} />
    </div>
  );
}

const tdStyle = { padding:'16px 20px', fontSize:'13px', color:'var(--text-main)' };
const primaryBtnStyle = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'11px 22px', borderRadius:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'14px', fontFamily:'inherit' };
const overlayStyle = { position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const iconBtn = (color, bg) => ({ padding:'7px', background: bg, border:'none', color, borderRadius:'9px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' });
const cLabel = { display:'block', fontSize:'13px', fontWeight:'700', color:'var(--text-muted)', marginBottom:'6px' };
const cInput = { width:'100%', padding:'16px 20px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', outline:'none', fontFamily:'inherit', background:'var(--bg-card)', boxSizing:'border-box' };
