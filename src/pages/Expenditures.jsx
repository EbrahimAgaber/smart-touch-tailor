import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { 
  Plus, Search, Filter, Trash2, Calendar, 
  DollarSign, Receipt, Tag, Building2, 
  ArrowLeft, Download, X, PieChart
} from 'lucide-react';
import ExportButton from '../components/ExportButton';

const CATEGORIES = ['الكل', 'مواد غذائية', 'خامات', 'معدات', 'خدمات', 'إيجار', 'رواتب', 'تسويق', 'أخرى'];

export default function Expenditures() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null); // 1-E: Edit state
  const [filters, setFilters] = useState({ startDate: '', endDate: '', category: 'الكل' });
  
  // 2-B: Pagination state
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Supplier suggestions for combobox
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);

  const [form, setForm] = useState({
    supplier_name: '', invoice_ref: '', category: 'أخرى', 
    amount: '', vat_eligible: false, 
    date: new Date().toISOString().split('T')[0], 
    description: ''
  });

  // Load supplier suggestions when modal opens
  useEffect(() => {
    if (showModal && window.api?.getExpenseSupplierSuggestions) {
      window.api.getExpenseSupplierSuggestions()
        .then(list => setSupplierSuggestions(list || []))
        .catch(() => setSupplierSuggestions([]));
    }
  }, [showModal]);

  useEffect(() => {
    loadExpenses();
  }, [page]);

  const loadExpenses = async (f = filters) => {
    setLoading(true);
    try {
      const data = await window.api.getExpenditures({ ...f, limit, offset: page * limit });
      setExpenses(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error("Failed to load expenses:", e);
    }
    setLoading(false);
  };

  const handleApplyFilters = () => {
    setPage(0);
    loadExpenses();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount) return alert("يرجى إدخال المبلغ");

    const amountNum = parseFloat(form.amount);
    const net = form.vat_eligible ? Math.round((amountNum / 1.15) * 100) / 100 : amountNum;
    const vat = form.vat_eligible ? Math.round((amountNum - net) * 100) / 100 : 0;

    const data = {
      ...form,
      id: editItem?.id,
      net_amount: net,
      vat_amount: vat,
      amount: amountNum
    };

    try {
      let res;
      if (editItem) {
        res = await window.api.editExpenditure(data);
      } else {
        res = await window.api.addExpenditure(data);
      }
      
      if (!res.success && res.error) {
        alert(res.error);
        return;
      }

      setShowModal(false);
      setEditItem(null);
      setForm({
        supplier_name: '', invoice_ref: '', category: 'أخرى', 
        amount: '', vat_eligible: false, 
        date: new Date().toISOString().split('T')[0], 
        description: ''
      });
      loadExpenses();
    } catch (err) {
      alert("خطأ في الحفظ: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا المصروف؟")) return;
    const res = await window.api.deleteExpenditure(id);
    if (!res.success) alert(res.error || "فشل الحذف");
    loadExpenses();
  };

  const handleOpenEdit = (item) => {
    setEditItem(item);
    setForm({
      supplier_name: item.supplier_name || '',
      invoice_ref: item.invoice_ref || '',
      category: item.category || 'أخرى',
      amount: String(item.amount),
      vat_eligible: item.vat_eligible === 1 || item.vat_eligible === true,
      date: item.expense_date || item.timestamp?.split('T')[0],
      description: item.description || ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm({
      supplier_name: '', invoice_ref: '', category: 'أخرى', 
      amount: '', vat_eligible: false, 
      date: new Date().toISOString().split('T')[0], 
      description: ''
    });
  };

  const totals = {
    gross: expenses.reduce((s, e) => s + (e.amount || 0), 0),
    vat: expenses.reduce((s, e) => s + (e.vat_amount || 0), 0),
    net: expenses.reduce((s, e) => s + (e.net_amount || 0), 0)
  };

  return (
    <AppLayout title="المصروفات والمشتريات التشغيلية">
      <div style={containerStyle}>
        
        {/* STATS */}
        <div style={statsGridStyle}>
          <SummaryCard label="إجمالي المصروفات" value={`SAR ${totals.gross.toLocaleString()}`} icon={<DollarSign color="#ef4444"/>} color="#ef4444" />
          <SummaryCard label="ضريبة المدخلات (المستردة)" value={`SAR ${totals.vat.toLocaleString()}`} icon={<Receipt color="#f59e0b"/>} color="#f59e0b" />
          <SummaryCard label="صافي التكاليف" value={`SAR ${totals.net.toLocaleString()}`} icon={<PieChart color="#3b82f6"/>} color="#3b82f6" />
        </div>

        {/* CONTROLS */}
        <div style={controlsRowStyle}>
          <div style={filterGroupStyle}>
             <Filter size={18} color="#94a3b8" />
             <select value={filters.category} onChange={e => setFilters({...filters, category:e.target.value})} style={selectStyle}>
               {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate:e.target.value})} style={dateInputStyle} />
             <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate:e.target.value})} style={dateInputStyle} />
             <button onClick={handleApplyFilters} style={filterBtnStyle}>تطبيق</button>
          </div>
          <button onClick={() => setShowModal(true)} style={addBtnStyle}><Plus size={18}/> إضافة مصروف جديد</button>
          <ExportButton
            format="pdf"
            label="PDF تصدير"
            title="تقرير المصروفات"
            subtitle={filters.startDate && filters.endDate ? `${filters.startDate} — ${filters.endDate}` : ''}
            headers={['التاريخ','المورد / البيان','الفئة','صافي (ريال)','ضريبة (ريال)','إجمالي (ريال)']}
            rows={expenses.map(e => [
              e.expense_date || '',
              e.supplier_name || 'مصروف عام',
              e.category || '',
              parseFloat(e.net_amount||0).toFixed(2),
              parseFloat(e.vat_amount||0).toFixed(2),
              parseFloat(e.amount||0).toFixed(2),
            ])}
            summaryRows={[
              {label:'إجمالي المصروفات (ريال)', value: totals.gross.toFixed(2)},
              {label:'إجمالي ضريبة المدخلات', value: totals.vat.toFixed(2)},
            ]}
          />
          <ExportButton
            format="excel"
            label="Excel تصدير"
            title="تقرير المصروفات"
            headers={['التاريخ','المورد','الفئة','صافي','ضريبة','إجمالي']}
            rows={expenses.map(e => [
              e.expense_date || '',
              e.supplier_name || '',
              e.category || '',
              parseFloat(e.net_amount||0).toFixed(2),
              parseFloat(e.vat_amount||0).toFixed(2),
              parseFloat(e.amount||0).toFixed(2),
            ])}
            filename="مصروفات.xlsx"
          />
        </div>

        {/* LIST */}
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>المورد / الوصف</th>
                <th style={thStyle}>الفئة</th>
                <th style={thStyle}>الإجمالي (شامل الضريبة)</th>
                <th style={thStyle}>الضريبة</th>
                <th style={thStyle}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={trStyle}>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', fontWeight:'600' }}>
                      <Calendar size={14} color="#94a3b8" /> {e.expense_date}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight:'700', color:'var(--text-main)' }}>{e.supplier_name || 'مصروف عام'}</div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{e.description || 'بدون وصف'}</div>
                  </td>
                  <td style={tdStyle}><span style={badgeStyle}>{e.category}</span></td>
                  <td style={tdStyle}><span style={{ fontWeight:'800', fontSize:'15px' , fontFamily: "'Inter', sans-serif"}}>SAR {e.amount.toFixed(2)}</span></td>
                  <td style={tdStyle}><span style={{ color:'var(--text-muted)', fontSize:'12px' }}>{e.vat_amount > 0 ? `SAR ${e.vat_amount.toFixed(2)}` : '0.00'}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => handleOpenEdit(e)} style={{ ...deleteBtnStyle, color:'#3b82f6', opacity:1 }} title="تعديل"><Search size={16}/></button>
                      <button onClick={() => handleDelete(e.id)} style={deleteBtnStyle} title="حذف"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && !loading && (
            <div style={{ padding:'60px', textAlign:'center', color:'var(--text-muted)' }}>لا توجد سجلات مصروفات مطابقة للبحث</div>
          )}
          {loading && (
            <div style={{ padding:'40px', textAlign:'center', color:'var(--text-muted)' }}>جاري التحميل...</div>
          )}
        </div>

        {/* 2-B: PAGINATION */}
        {total > limit && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'20px', marginTop:'20px' }}>
             <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={paginationBtnStyle}>السابق</button>
             <span style={{ fontSize:'14px', fontWeight:'700', color:'var(--text-muted)' }}>صفحة {page + 1} من {Math.ceil(total / limit)}</span>
             <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total} style={paginationBtnStyle}>التالي</button>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
               <h2 style={{ fontSize:'20px', fontWeight:'900' }}>{editItem ? 'تعديل مصروف' : 'تسجيل مصروف جديد'}</h2>
               <button onClick={handleCloseModal} style={closeBtnStyle}><X /></button>
            </div>
            
            <form onSubmit={handleAdd} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <SupplierCombobox
                  label="اسم المورد / الجهة"
                  value={form.supplier_name}
                  onChange={v => setForm({...form, supplier_name:v})}
                  suggestions={supplierSuggestions}
                  placeholder="ابحث عن مورد أو أدخل اسماً جديداً..."
                />
              </div>

              <Input label="رقم الفاتورة" value={form.invoice_ref} onChange={v => setForm({...form, invoice_ref:v})} placeholder="مثال: INV-2024-001" />

              <div style={inputGroupStyle}>
                <label style={labelStyle}>الفئة</label>
                <select value={form.category} onChange={e => setForm({...form, category:e.target.value})} style={selectStyleFull}>
                  {CATEGORIES.filter(c => c !== 'الكل').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <Input label="التاريخ" type="date" value={form.date} onChange={v => setForm({...form, date:v})} />
              <Input label="المبلغ الإجمالي (SAR)" type="number" value={form.amount} onChange={v => setForm({...form, amount:v})} required placeholder="0.00" />
              
              <div style={{
                display:'flex', alignItems:'center', gap:'12px',
                background: form.vat_eligible ? '#eff6ff' : '#f8fafc',
                padding:'14px 18px', borderRadius:'14px',
                border:`1.5px solid ${form.vat_eligible ? '#93c5fd' : '#e2e8f0'}`,
                gridColumn:'span 2', cursor:'pointer', transition:'all 0.2s'
              }} onClick={() => setForm({...form, vat_eligible: !form.vat_eligible})}>
                <input
                  type="checkbox"
                  checked={form.vat_eligible}
                  onChange={e => setForm({...form, vat_eligible: e.target.checked})}
                  style={{ width:'20px', height:'20px', cursor:'pointer' }}
                />
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'800', color: form.vat_eligible ? '#1e40af' : '#374151' }}>فاتورة ضريبية (15%)</div>
                  <div style={{ fontSize:'11px', color:'#64748b' }}>حساب ضريبة المدخلات تلقائياً (تخصم في الإقرار الضريبي)</div>
                </div>
              </div>

              <div style={{ gridColumn:'span 2' }}>
                <Input label="ملاحظات إضافية" value={form.description} onChange={v => setForm({...form, description:v})} placeholder="اختياري..." />
              </div>

              <div style={{ gridColumn:'span 2', marginTop:'10px' }}>
                <button type="submit" style={submitBtnStyle}>{editItem ? 'تحديث المصروف' : 'حفظ المصروف وتحديث القيود'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// COMPONENTS
function SummaryCard({ label, value, icon, color }) {
  return (
    <div style={{ background:'var(--bg-card)', padding:'24px', borderRadius:'24px', border:`1px solid ${color}15`, display:'flex', alignItems:'center', gap:'16px', boxShadow:'0 1px 2px rgba(0,0,0,0.02)' }}>
      <div style={{ width:'48px', height:'48px', background:`${color}08`, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize:'13px', color:'var(--text-muted)', fontWeight:'700', marginBottom:'4px' }}>{label}</div>
        <div style={{ fontSize:'22px', fontWeight:'900', color:'var(--text-main)' }}>{value}</div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type='text', required=false }) {
  return (
    <div style={inputGroupStyle}>
      <label style={labelStyle}>{label}</label>
      <input 
        type={type} value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} required={required}
        style={inputStyle}
      />
    </div>
  );
}

// Searchable Supplier Combobox — allows free-text entry + dropdown suggestions (RTL optimized)
function SupplierCombobox({ label, value, onChange, suggestions = [], placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const query = (value || '').trim().toLowerCase();
  const filtered = query
    ? suggestions.filter(s => s.toLowerCase().includes(query))
    : suggestions;
  const displayList = filtered.slice(0, 8); // show max 8 items
  const isNew = query && !suggestions.some(s => s.toLowerCase() === query);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && highlightIdx >= 0) {
      const el = listRef.current.children[highlightIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      setHighlightIdx(0);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, displayList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && displayList[highlightIdx]) {
      e.preventDefault();
      onChange(displayList[highlightIdx]);
      setOpen(false);
      setHighlightIdx(-1);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIdx(-1);
    }
  };

  const selectItem = (name) => {
    onChange(name);
    setOpen(false);
    setHighlightIdx(-1);
  };

  return (
    <div style={inputGroupStyle} ref={wrapperRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={labelStyle}>{label}</label>
        {isNew && (
          <span style={{
            fontSize: '11px', fontWeight: '800',
            background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
            padding: '2px 10px', borderRadius: '8px', letterSpacing: '0.02em'
          }}>مورد جديد ✦</span>
        )}
      </div>
      <div style={{ position: 'relative', width: '100%' }}>
        <Building2
          size={18}
          color={open ? '#3b82f6' : '#94a3b8'}
          style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}
        />
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlightIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            ...inputStyle,
            paddingRight: '42px',
            paddingLeft: value ? '36px' : '16px',
            borderColor: open ? '#3b82f6' : '#e2e8f0',
            boxShadow: open ? '0 0 0 3.5px rgba(59,130,246,0.12)' : 'none',
            fontSize: '14px',
            height: '46px',
            transition: 'all 0.2s',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(true); }}
            style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
              fontSize: '14px', padding: '4px', display: 'flex', alignItems: 'center'
            }}
          >
            ✕
          </button>
        )}
        {open && displayList.length > 0 && (
          <div ref={listRef} style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, left: 0, zIndex: 1000,
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: '16px', maxHeight: '220px', overflowY: 'auto',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            direction: 'rtl'
          }}>
            {displayList.map((name, i) => (
              <div
                key={name}
                onMouseDown={() => selectItem(name)}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  padding: '11px 16px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: highlightIdx === i ? '#eff6ff' : 'transparent',
                  color: highlightIdx === i ? '#2563eb' : '#1e293b',
                  borderBottom: i < displayList.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                <Building2 size={15} color={highlightIdx === i ? '#3b82f6' : '#cbd5e1'} />
                {name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// STYLES
const containerStyle = { display:'flex', flexDirection:'column', gap:'32px', direction:'rtl' };
const statsGridStyle = { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'20px' };
const controlsRowStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'20px' };
const filterGroupStyle = { display:'flex', alignItems:'center', gap:'12px', background:'var(--bg-card)', padding:'10px 20px', borderRadius:'16px', border:'1px solid #f1f5f9' };
const panelStyle = { background:'var(--bg-card)', borderRadius:'28px', border:'1px solid #f1f5f9', overflow:'hidden' };

const tableStyle = { width:'100%', borderCollapse:'collapse', textAlign:'right' };
const theadRowStyle = { background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' };
const thStyle = { padding:'16px 24px', fontSize:'12px', fontWeight:'800', color:'var(--text-muted)' };
const trStyle = { borderBottom:'1px solid #f8fafc' };
const tdStyle = { padding:'20px 24px' };

const badgeStyle = { background:'#f1f5f9', color:'var(--text-muted)', padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:'700' };
const deleteBtnStyle = { background:'transparent', border:'none', color:'#ef4444', opacity:0.3, cursor:'pointer', transition:'opacity 0.2s', hover:{opacity:1} };

const addBtnStyle = { 
  background:'linear-gradient(135deg, #3b82f6, #2563eb)', color:'white', border:'none', 
  padding:'12px 24px', borderRadius:'14px', fontWeight:'800', cursor:'pointer',
  display:'flex', alignItems:'center', gap:'10px', fontSize:'14px'
};

const selectStyle = { border:'none', background:'transparent', fontSize:'14px', fontWeight:'700', outline:'none', cursor:'pointer', color:'var(--text-muted)' };
const selectStyleFull = { width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px' };
const dateInputStyle = { border:'1px solid #e2e8f0', borderRadius:'10px', padding:'6px 10px', fontSize:'13px', color:'var(--text-muted)', outline:'none' };
const filterBtnStyle = { background:'#f1f5f9', border:'none', padding:'8px 16px', borderRadius:'10px', color:'#3b82f6', fontWeight:'800', fontSize:'13px', cursor:'pointer' };

const modalOverlayStyle = { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(15,23,42,0.4)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modalStyle = { background:'var(--bg-card)', width:'100%', maxWidth:'640px', borderRadius:'32px', padding:'40px', direction:'rtl' };
const modalHeaderStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'32px' };
const closeBtnStyle = { border:'none', background:'transparent', color:'var(--text-muted)', cursor:'pointer' };

const inputGroupStyle = { display:'flex', flexDirection:'column', gap:'10px' };
const labelStyle = { fontSize:'14px', fontWeight:'800', color:'var(--text-muted)' };
const inputStyle = { padding:'14px', borderRadius:'14px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px' };
const paginationBtnStyle = { background:'var(--bg-card)', border:'1px solid #e2e8f0', padding:'8px 20px', borderRadius:'10px', color:'#3b82f6', fontWeight:'800', cursor:'pointer', fontSize:'13px', opacity:0.8 };
const submitBtnStyle = { width:'100%', padding:'16px', borderRadius:'16px', border:'none', background:'linear-gradient(135deg, #3b82f6, #2563eb)', color:'white', fontWeight:'800', fontSize:'16px', cursor:'pointer', boxShadow:'0 10px 15px -3px rgba(37,99,235,0.3)' };

