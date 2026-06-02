import { useState, useRef, useEffect } from 'react';
import { useCartStore } from '../../../store/useCartStore';
import { 
  Search, Trash2, Plus, Calculator, Save, 
  X, Pause, Printer, FileText, User, 
  Package, Database, Layout, UserPlus, Search as SearchIcon,
  CreditCard, ScrollText
} from 'lucide-react';

export default function TabularView({ 
  menu = [], 
  settings = {}, 
  onOpenPayment,
  onHoldOrder,
  onPrint,
  onReset,
  onQuote,
  customers = [],
  selectedCustomer = null,
  setSelectedCustomer,
  setShowQuickCust,
  onItemSelect,
  onFinalizeQuickly
}) {
  const { 
    order, addItem, removeItem, updateQuantity, updatePrice, updateItemField,
    subtotal, tax, total, clearCart 
  } = useCartStore();

  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [showCustList, setShowCustList] = useState(false);

  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const entryInputRef = useRef(null);
  const custRef = useRef(null);

  // Hotkeys Implementation
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'F1':
          entryInputRef.current?.focus();
          break;
        case 'F2':
          if (order.length > 0) onFinalizeQuickly?.(true);
          break;
        case 'F3':
          if (order.length > 0) onHoldOrder();
          break;
        case 'F4':
          if (order.length > 0 && window.confirm('هل تريد حذف جميع الأصناف في السلة؟')) {
            onReset();
          }
          break;
        case 'F5':
          if (order.length > 0) onFinalizeQuickly?.(false);
          break;
        case 'Escape':
          setShowResults(false);
          setShowCustList(false);
          break;
        case 'n':
          if (e.ctrlKey) {
            e.preventDefault();
            onReset();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [order, onFinalizeQuickly, onHoldOrder, onReset]);

  // Close results on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target) && 
          resultsRef.current && !resultsRef.current.contains(e.target)) {
        setShowResults(false);
      }
      if (custRef.current && !custRef.current.contains(e.target)) {
        setShowCustList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = menu.filter(m => 
    m.Name.toLowerCase().includes(search.toLowerCase()) || 
    (m.Barcode && m.Barcode.includes(search))
  ).slice(0, 10);

  const handleSelectItem = (item) => {
    if (onItemSelect) {
      onItemSelect(item);
    } else {
      addItem(item);
    }
    setSearch('');
    setShowResults(false);
    // Use timeout to ensure store update doesn't block focus
    setTimeout(() => entryInputRef.current?.focus(), 10);
  };

  const handleBarcodeSubmit = (e) => {
    if (e.key === 'Enter' && search) {
      const exact = menu.find(i => i.Barcode === search);
      if (exact) {
        handleSelectItem(exact);
      } else if (filteredItems.length === 1) {
        handleSelectItem(filteredItems[0]);
      }
    }
  };

  const vatRate = parseFloat(settings.vat_rate || '0.15');

  return (
    <div style={containerStyle}>
      {/* ── TOP SETTINGS BAR ──────────────── */}
      <div style={topBarStyle}>
        <div style={topGroupStyle}>
          <div style={topItemStyle}>
            <label style={topLabelStyle}>المستودع:</label>
            <select style={topSelectStyle}><option>المستودع الرئيسي</option></select>
          </div>
          
          <div style={topItemStyle}>
            <label style={topLabelStyle}>العميل:</label>
            <div style={{ position:'relative', display:'flex', gap:'4px' }} ref={custRef}>
              <div style={{ position:'relative' }}>
                <input 
                  style={topInputStyle} 
                  placeholder="البحث عن عميل..." 
                  value={selectedCustomer ? selectedCustomer.name : custSearch}
                  onChange={(e) => { setCustSearch(e.target.value); setShowCustList(true); }}
                  onFocus={() => setShowCustList(true)}
                  readOnly={!!selectedCustomer}
                />
                {showCustList && !selectedCustomer && (
                  <div style={custDropdownStyle}>
                    {customers.filter(c => c.name.includes(custSearch) || c.phone?.includes(custSearch)).map(c => (
                      <div key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustList(false); }} style={resultItemStyle}>
                        {c.name} ({c.phone})
                      </div>
                    ))}
                    <button onClick={() => setShowQuickCust(true)} style={addCustBtn}>+ إضافة عميل جديد</button>
                  </div>
                )}
              </div>
              {selectedCustomer ? (
                <button onClick={() => { setSelectedCustomer(null); setCustSearch(''); }} style={topIconBtnStyle}><X size={14}/></button>
              ) : (
                <button onClick={() => setShowQuickCust(true)} style={topIconBtnStyle}><UserPlus size={14}/></button>
              )}
            </div>
          </div>

          <div style={topItemStyle}>
            <label style={topLabelStyle}>طريقة الدفع:</label>
            <select style={topSelectStyle}><option>نقدي</option><option>شبكة</option></select>
          </div>
        </div>

        <div style={topGroupStyle}>
          <div style={topItemStyle}>
            <label style={topLabelStyle}>رقم الفاتورة:</label>
            <input style={{ ...topInputStyle, color:'#ef4444', fontWeight:'900', width:'80px' }} value="AUTO" readOnly />
          </div>
        </div>
      </div>

      {/* ── MAIN TABLE AREA ──────────────── */}
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead style={stickyTheadStyle}>
            <tr>
              <th style={{ ...thStyle, width: '40px' }}>#</th>
              <th style={{ ...thStyle, width: '180px' }}>رقم الصنف / الباركود</th>
              <th style={thStyle}>اسم الصنف</th>
              <th style={{ ...thStyle, width: '80px' }}>الوحدة</th>
              <th style={{ ...thStyle, width: '80px' }}>الكمية</th>
              <th style={{ ...thStyle, width: '120px' }}>سعر الوحدة</th>
              <th style={{ ...thStyle, width: '120px' }}>سعر الكمية</th>
              <th style={{ ...thStyle, width: '100px' }}>الضريبة</th>
              <th style={{ ...thStyle, width: '140px' }}>السعر شامل الضريبة</th>
              <th style={{ ...thStyle, width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {/* ── ENTRY ROW ──────────────── */}
            <tr style={entryTrStyle}>
              <td style={tdStyle}><span style={newBadgeStyle}>*</span></td>
              <td style={{ ...tdStyle, position: 'relative' }} colSpan="2">
                <div ref={searchRef} style={{ position:'relative' }}>
                  <input 
                    ref={entryInputRef}
                    type="text" 
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    onKeyDown={handleBarcodeSubmit}
                    placeholder="امسح الباركود أو ابحث عن صنف... (F1)"
                    style={entryInputStyle}
                  />
                  {showResults && search.length > 0 && (
                    <div style={resultsDropdownStyle} ref={resultsRef}>
                      {filteredItems.length === 0 ? (
                        <div style={noResultStyle}>لا توجد نتائج</div>
                      ) : (
                        filteredItems.map(item => (
                          <div key={item.ID} onClick={() => handleSelectItem(item)} style={resultItemStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={itemIconStyle}>{item.Category?.charAt(0) || '📦'}</div>
                              <div>
                                <div style={{ fontWeight: '700', fontSize: '12px' }}>{item.Name}</div>
                                <div style={{ fontSize: '10px', color: '#64748b' }}>{item.Barcode}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: '800', color: '#1e40af' }}>{item.Price.toFixed(2)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </td>
              <td style={tdStyle}><input style={readOnlyInputStyle} value="—" readOnly /></td>
              <td style={tdStyle}><input style={readOnlyInputStyle} value="1" readOnly /></td>
              <td style={tdStyle}><input style={readOnlyInputStyle} value="0.00" readOnly /></td>
              <td style={tdStyle}><input style={readOnlyInputStyle} value="0.00" readOnly /></td>
              <td style={tdStyle}><input style={readOnlyInputStyle} value="0.00" readOnly /></td>
              <td style={tdStyle}><input style={readOnlyInputStyle} value="0.00" readOnly /></td>
              <td style={tdStyle}></td>
            </tr>

            {/* ── CART ROWS (EDITABLE) ──────────────── */}
            {order.map((item, idx) => {
              const itemTotal = item.Price * item.Qty;
              const itemTax = itemTotal * vatRate / (1 + vatRate);
              const itemSub = itemTotal - itemTax;
              return (
                <tr key={`${item.ID}-${idx}`} style={trStyle}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={tdStyle}>
                    <input 
                      value={item.Barcode || ''} 
                      onChange={(e) => updateItemField(idx, 'Barcode', e.target.value)}
                      style={tableInputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input 
                      value={item.Name} 
                      onChange={(e) => updateItemField(idx, 'Name', e.target.value)}
                      style={{ ...tableInputStyle, textAlign:'right', fontWeight:'700' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input 
                      value={item.Unit || 'حبة'} 
                      onChange={(e) => updateItemField(idx, 'Unit', e.target.value)}
                      style={tableInputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input 
                      type="number" 
                      min="0"
                      value={item.Qty} 
                      onChange={(e) => updateQuantity(idx, parseFloat(e.target.value) || 0)}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val <= 0) updateQuantity(idx, 1);
                      }}
                      onFocus={(e) => e.target.select()}
                      style={{ ...tableInputStyle, background:'#fffbea', border:'1px solid #e2e8f0', borderRadius:'2px' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input 
                      type="number" 
                      min="0"
                      value={item.Price} 
                      onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val < 0) updatePrice(idx, 0);
                      }}
                      onFocus={(e) => e.target.select()}
                      style={{ ...tableInputStyle, background:'#f0f9ff', border:'1px solid #e2e8f0', borderRadius:'2px' }}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', background:'#f8fafc' }}>{itemSub.toFixed(2)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', background:'#f8fafc' }}>{itemTax.toFixed(2)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '900', color: '#1e40af', background:'#f0f9ff' }}>
                    {itemTotal.toFixed(2)}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => removeItem(idx)} style={deleteBtnStyle}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
            
            {/* Removed empty rows to prevent endless scrolling */}
          </tbody>
        </table>
      </div>

      {/* ── BOTTOM AREA ──────────────── */}
      <div style={bottomAreaStyle}>
        <div style={actionsGridStyle}>
          <button onClick={() => { if (order.length > 0) onFinalizeQuickly?.(true); }} style={{ ...actionBtnStyle, background:'#1e40af' }}>
            <Save size={20} />
            <span style={btnLabelStyle}>حفظ وطباعة (F2)</span>
          </button>
          <button onClick={() => { if (order.length > 0) onFinalizeQuickly?.(true, 'A4'); }} style={{ ...actionBtnStyle, background:'#0f172a' }}>
            <Printer size={20} />
            <span style={btnLabelStyle}>حفظ وطباعة A4</span>
          </button>
          <button onClick={onHoldOrder} style={{ ...actionBtnStyle, background:'#059669' }}>
            <Pause size={20} />
            <span style={btnLabelStyle}>تعليق الفاتورة (F3)</span>
          </button>
          <button onClick={() => { if(order.length > 0 && window.confirm('هل تريد مسح الفاتورة؟')) onReset(); }} style={{ ...actionBtnStyle, background:'#dc2626' }}>
            <Trash2 size={20} />
            <span style={btnLabelStyle}>حذف الفاتورة (F4)</span>
          </button>
          <button onClick={() => { if (order.length > 0) onFinalizeQuickly?.(false); }} style={{ ...actionBtnStyle, background:'#475569' }}>
            <Printer size={20} />
            <span style={btnLabelStyle}>حفظ بدون طباعة (F5)</span>
          </button>
          <button onClick={onReset} style={{ ...actionBtnStyle, background:'#334155' }}>
            <FileText size={20} />
            <span style={btnLabelStyle}>جديد (Ctrl+N)</span>
          </button>
          <button onClick={onQuote} style={{ ...actionBtnStyle, background:'#111827' }}>
            <ScrollText size={20} />
            <span style={btnLabelStyle}>سعر عرض</span>
          </button>
        </div>

        <div style={summaryAreaStyle}>
          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>الإجمالي:</span>
            <span style={summaryValueStyle}>{total.toFixed(2)}</span>
          </div>
          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>الضريبة:</span>
            <span style={summaryValueStyle}>{tax.toFixed(2)}</span>
          </div>
          <div style={{ ...summaryRowStyle, borderTop:'1px solid #94a3b8', paddingTop:'8px', marginTop:'8px' }}>
            <span style={{ ...summaryLabelStyle, fontSize:'18px', color:'#ef4444' }}>الصافي:</span>
            <span style={{ ...summaryValueStyle, fontSize:'28px', color:'#ef4444', fontWeight:'900' }}>{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STYLES ────────────────

const containerStyle = {
  height: '100%', display: 'flex', flexDirection: 'column',
  background: '#f1f5f9', direction: 'rtl',
  fontFamily: "'Segoe UI', 'Tajawal', sans-serif",
  padding: '8px', gap: '8px', overflow:'hidden'
};

const topBarStyle = {
  background: '#cbd5e1', padding: '10px 15px', borderRadius: '4px',
  display: 'flex', justifyContent: 'space-between', border: '1px solid #94a3b8',
  flexWrap: 'wrap', gap:'10px'
};

const topGroupStyle = { display: 'flex', gap: '15px', alignItems: 'center', flexWrap:'wrap' };
const topItemStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const topLabelStyle = { fontSize: '11px', fontWeight: '800', color: '#334155', whiteSpace:'nowrap' };
const topSelectStyle = { padding: '4px 8px', borderRadius: '2px', border: '1px solid #94a3b8', fontSize: '12px', background: '#fff' };
const topInputStyle = { padding: '4px 8px', borderRadius: '2px', border: '1px solid #94a3b8', fontSize: '12px', background: '#fff', width: '150px' };
const topIconBtnStyle = { padding: '4px', background: '#fff', border: '1px solid #94a3b8', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' };

const custDropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, 
  background: '#fff', border: '1px solid #94a3b8', zIndex: 100,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight:'200px', overflowY:'auto'
};

const addCustBtn = { width:'100%', padding:'10px', background:'#f8fafc', border:'none', borderTop:'1px solid #e2e8f0', cursor:'pointer', fontWeight:'700', fontSize:'12px', color:'#3b82f6' };

const tableWrapperStyle = { 
  flex: 1, background: '#fff', border: '1px solid #94a3b8', 
  overflow: 'auto', borderRadius: '2px'
};

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth:'900px' };
const stickyTheadStyle = { position: 'sticky', top: 0, zIndex: 10 };
const thStyle = { 
  padding: '10px 8px', background: '#3b82f6', color: '#fff', 
  border: '1px solid #1d4ed8', fontWeight: '700', textAlign: 'center' 
};

const tdStyle = { padding: '0', border: '1px solid #e2e8f0', color: '#1e293b' };
const trStyle = { background: '#fff' };
const entryTrStyle = { background: '#f0f9ff' };
const emptyTrStyle = { background: '#f8fafc', height:'32px' };

const entryInputStyle = { 
  width: '100%', padding: '10px', border: 'none', 
  fontSize: '13px', outline: 'none', background: 'transparent', textAlign: 'right' 
};

const tableInputStyle = {
  width: '100%', padding: '8px 8px', border: 'none', 
  textAlign: 'center', fontSize: '12px', outline: 'none', background: 'transparent', fontFamily:'inherit'
};

const readOnlyInputStyle = { ...tableInputStyle, color:'#64748b' };

const newBadgeStyle = { color: '#3b82f6', fontWeight: '900', fontSize: '18px', padding:'0 10px' };
const deleteBtnStyle = { background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' };

const resultsDropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, 
  background: '#fff', border: '1px solid #3b82f6', zIndex: 100,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
};

const resultItemStyle = { 
  padding: '8px', borderBottom: '1px solid #f1f5f9', 
  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
};
const itemIconStyle = { width:'24px', height:'24px', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'4px' };
const noResultStyle = { padding:'10px', textAlign:'center', color:'#94a3b8' };

const bottomAreaStyle = { 
  display: 'flex', gap: '10px', padding: '5px 0', 
  alignItems: 'stretch', justifyContent: 'space-between', flexWrap:'wrap'
};

const summaryAreaStyle = { 
  background: '#cbd5e1', padding: '15px', borderRadius: '4px', 
  border: '1px solid #94a3b8', width: '300px', minWidth:'250px'
};

const summaryRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:'4px' };
const summaryLabelStyle = { fontSize: '14px', fontWeight: '900', color: '#334155' };
const summaryValueStyle = { fontSize: '20px', fontWeight: '800', color: '#1e293b' };

const actionsGridStyle = { 
  flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' 
};

const actionBtnStyle = { 
  display: 'flex', flexDirection: 'column', alignItems: 'center', 
  justifyContent: 'center', gap: '6px', color: '#fff', border: 'none', 
  borderRadius: '4px', padding: '12px', cursor: 'pointer', transition: 'all 0.2s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const btnLabelStyle = { fontSize:'11px', fontWeight:'800' };
