import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Shield, Search, Calendar, User, Activity,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ArrowRight, Database, Tag, Hash, Clock, Filter, X,
  FileText, RefreshCw
} from 'lucide-react';

// ─── Action colour map ────────────────────────────────────────────────────────
const getActionMeta = (action) => {
  const a = (action || '').toUpperCase();
  if (a.includes('VOID') || a.includes('DELETE'))
    return { bg: '#fef2f2', text: '#ef4444', border: '#fecaca', icon: '🗑️' };
  if (a.includes('LOGIN'))
    return { bg: '#ecfdf5', text: '#10b981', border: '#a7f3d0', icon: '🔐' };
  if (a.includes('LOGOUT'))
    return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', icon: '👋' };
  if (a.includes('UPDATE') || a.includes('EDIT'))
    return { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe', icon: '✏️' };
  if (a.includes('ADD') || a.includes('CREATE'))
    return { bg: '#f5f3ff', text: '#8b5cf6', border: '#ddd6fe', icon: '➕' };
  if (a.includes('SALE'))
    return { bg: '#fff7ed', text: '#f97316', border: '#fed7aa', icon: '🧾' };
  if (a.includes('RETURN'))
    return { bg: '#fdf4ff', text: '#a855f7', border: '#e9d5ff', icon: '↩️' };
  if (a.includes('SHIFT'))
    return { bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0', icon: '🔄' };
  return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', icon: '📋' };
};

// ─── Diff View Component ──────────────────────────────────────────────────────
function DiffView({ oldValue, newValue, fieldName }) {
  if (oldValue == null && newValue == null) return null;

  // Try to parse JSON for richer display
  const tryParse = (v) => {
    if (v == null) return null;
    try { return JSON.parse(v); } catch { return v; }
  };

  const oldParsed = tryParse(oldValue);
  const newParsed = tryParse(newValue);

  const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // If both are objects, show field-level diff
  if (isObject(oldParsed) && isObject(newParsed)) {
    const allKeys = new Set([...Object.keys(oldParsed), ...Object.keys(newParsed)]);
    const changedKeys = [...allKeys].filter(k =>
      JSON.stringify(oldParsed[k]) !== JSON.stringify(newParsed[k])
    );
    if (changedKeys.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {changedKeys.map(key => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 28px 1fr', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textAlign: 'left' }}>{key}</span>
            <ValueBadge value={String(oldParsed[key] ?? '')} type="old" />
            <ArrowRight size={12} color="#94a3b8" style={{ justifySelf: 'center' }} />
            <ValueBadge value={String(newParsed[key] ?? '')} type="new" />
          </div>
        ))}
      </div>
    );
  }

  // Simple before/after
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: '8px', alignItems: 'center' }}>
      <ValueBadge value={oldValue != null ? String(oldValue) : '—'} type="old" label={fieldName ? `${fieldName} (قبل)` : 'قبل'} />
      <ArrowRight size={14} color="#94a3b8" style={{ justifySelf: 'center' }} />
      <ValueBadge value={newValue != null ? String(newValue) : '—'} type="new" label={fieldName ? `${fieldName} (بعد)` : 'بعد'} />
    </div>
  );
}

function ValueBadge({ value, type, label }) {
  const isEmpty = !value || value === '—' || value === 'null' || value === 'undefined';
  const colors = type === 'old'
    ? { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' }
    : { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };

  return (
    <div style={{
      background: isEmpty ? '#f8fafc' : colors.bg,
      border: `1px solid ${isEmpty ? '#e2e8f0' : colors.border}`,
      borderRadius: '8px',
      padding: '6px 10px',
      overflow: 'hidden'
    }}>
      {label && (
        <div style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '2px', textTransform: 'uppercase' }}>
          {label}
        </div>
      )}
      <div style={{
        fontSize: '12px',
        fontWeight: '700',
        color: isEmpty ? '#94a3b8' : colors.text,
        wordBreak: 'break-word',
        fontStyle: isEmpty ? 'italic' : 'normal',
        direction: 'ltr',
        textAlign: 'left'
      }}>
        {isEmpty ? 'فارغ' : value}
      </div>
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getActionMeta(log.action);
  const hasDiff = log.old_value != null || log.new_value != null;
  const hasDetails = log.details || hasDiff || log.entity_type || log.entity_id || log.field_name;

  return (
    <>
      <tr
        style={{
          borderBottom: expanded ? 'none' : '1px solid #f8fafc',
          cursor: hasDetails ? 'pointer' : 'default',
          background: expanded ? '#fafbff' : 'white',
          transition: 'background 0.15s'
        }}
        onClick={() => hasDetails && setExpanded(v => !v)}
      >
        {/* Timestamp */}
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} color="#94a3b8" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                {new Date(log.timestamp).toLocaleDateString('ar-SA')}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                {new Date(log.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </td>

        {/* Staff */}
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={13} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
                {log.user_name || log.user_name_from_staff || `#${log.user_id || '?'}`}
              </div>
              {log.entity_type && (
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{log.entity_type}</div>
              )}
            </div>
          </div>
        </td>

        {/* Action badge */}
        <td style={td}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: meta.bg, border: `1px solid ${meta.border}` }}>
            <span style={{ fontSize: '12px' }}>{meta.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: '800', color: meta.text }}>{log.action}</span>
          </div>
        </td>

        {/* Entity / Reference */}
        <td style={td}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {log.entity_reference && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Hash size={10} color="#94a3b8" />
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6' }}>{log.entity_reference}</span>
              </div>
            )}
            {log.field_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={10} color="#94a3b8" />
                <span style={{ fontSize: '11px', color: '#64748b' }}>{log.field_name}</span>
              </div>
            )}
            {!log.entity_reference && !log.field_name && log.details && (
              <span style={{ fontSize: '11px', color: '#64748b', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.details}
              </span>
            )}
          </div>
        </td>

        {/* Diff indicator / expand toggle */}
        <td style={{ ...td, width: 60, textAlign: 'center' }}>
          {hasDiff && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '10px', fontWeight: '800', color: '#3b82f6' }}>
              DIFF
            </span>
          )}
        </td>

        {/* Expand toggle */}
        <td style={{ ...td, width: 40, textAlign: 'center' }}>
          {hasDetails && (
            <div style={{ color: '#94a3b8' }}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </div>
          )}
        </td>
      </tr>

      {/* ── Expanded detail row ── */}
      {expanded && hasDetails && (
        <tr style={{ background: '#f8faff', borderBottom: '1px solid #e2e8f0' }}>
          <td colSpan={6} style={{ padding: '16px 24px 20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Meta info bar */}
              {(log.entity_type || log.entity_id || log.session_id || log.ip_address) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {log.entity_type && <MetaChip icon={<Database size={11} />} label="النوع" value={log.entity_type} />}
                  {log.entity_id && <MetaChip icon={<Hash size={11} />} label="المعرف" value={log.entity_id} />}
                  {log.session_id && <MetaChip icon={<Activity size={11} />} label="الجلسة" value={log.session_id} />}
                  {log.ip_address && <MetaChip icon={<FileText size={11} />} label="IP" value={log.ip_address} />}
                </div>
              )}

              {/* Details text */}
              {log.details && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.5px' }}>التفاصيل</div>
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', direction: 'ltr', textAlign: 'left', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {log.details}
                  </div>
                </div>
              )}

              {/* Before / After diff panel */}
              {hasDiff && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <div style={{ width: 4, height: 16, background: '#3b82f6', borderRadius: 2 }} />
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#334155', letterSpacing: '0.3px' }}>
                      قبل / بعد التغيير
                    </span>
                  </div>
                  <DiffView
                    oldValue={log.old_value}
                    newValue={log.new_value}
                    fieldName={log.field_name}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MetaChip({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <span style={{ color: '#94a3b8' }}>{icon}</span>
      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>{label}:</span>
      <span style={{ fontSize: '11px', color: '#334155', fontWeight: '800' }}>{value}</span>
    </div>
  );
}

// ─── Action type filter options ───────────────────────────────────────────────
const ACTION_GROUPS = [
  { label: 'الكل', value: '' },
  { label: 'المبيعات', value: 'SALE' },
  { label: 'الإلغاء', value: 'VOID' },
  { label: 'المنتجات', value: 'PRODUCT' },
  { label: 'الموظفون', value: 'STAFF' },
  { label: 'العملاء', value: 'CUSTOMER' },
  { label: 'المصروفات', value: 'EXPENDITURE' },
  { label: 'الوردية', value: 'SHIFT' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]               = useState(0);
  const [hasDiffOnly, setHasDiffOnly] = useState(false);
  const LIMIT = 100;

  const fetchLogs = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      // Prefer enhanced audit logs (P-016 schema with old_value / new_value)
      let data = [];
      if (window.api.p2?.getEnhancedAuditLogs) {
        data = await window.api.p2.getEnhancedAuditLogs({
          limit: LIMIT + page * LIMIT,   // fetch cumulative so paging works client-side
          startDate: dateFrom || undefined,
          endDate: dateTo || undefined,
          action: actionFilter || undefined,
        });
      } else {
        // Fallback: basic audit log
        data = await window.api.getAuditLogs(LIMIT);
      }
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
    setLoading(false);
  }, [page, dateFrom, dateTo, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Client-side search + diff filter
  const filtered = logs.filter(log => {
    if (hasDiffOnly && log.old_value == null && log.new_value == null) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.details?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.user_name_from_staff?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q) ||
      log.entity_reference?.toLowerCase().includes(q) ||
      log.field_name?.toLowerCase().includes(q) ||
      log.old_value?.toLowerCase().includes(q) ||
      log.new_value?.toLowerCase().includes(q)
    );
  });

  // Paginate filtered results
  const pageStart = page * LIMIT;
  const pageData  = filtered.slice(pageStart, pageStart + LIMIT);

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
    setHasDiffOnly(false);
    setPage(0);
  };

  const hasActiveFilters = searchTerm || actionFilter || dateFrom || dateTo || hasDiffOnly;

  return (
    <AppLayout title="سجل مراقبة النظام">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

        {/* ── Toolbar ── */}
        <div style={{
          background: 'white',
          padding: '16px 20px',
          borderRadius: '18px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Row 1: search + refresh */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                placeholder="بحث في الإجراءات، الموظفين، القيم..."
                style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', fontWeight: '600', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={fetchLogs} title="تحديث" style={{ ...iconBtn }}>
              <RefreshCw size={15} />
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ ...iconBtn, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#ef4444' }}>
                <X size={15} />
              </button>
            )}
          </div>

          {/* Row 2: filters */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Action type */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ACTION_GROUPS.map(g => (
                <button
                  key={g.value}
                  onClick={() => { setActionFilter(g.value); setPage(0); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: actionFilter === g.value ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                    background: actionFilter === g.value ? '#eff6ff' : 'white',
                    color: actionFilter === g.value ? '#3b82f6' : '#64748b',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s'
                  }}
                >{g.label}</button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Date range */}
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              style={dateInput} />
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
              style={dateInput} />

            {/* Diff-only toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => { setHasDiffOnly(v => !v); setPage(0); }}
                style={{
                  width: 32, height: 18, borderRadius: 9,
                  background: hasDiffOnly ? '#3b82f6' : '#e2e8f0',
                  position: 'relative', transition: 'background 0.2s', cursor: 'pointer'
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: hasDiffOnly ? 16 : 2,
                  width: 14, height: 14, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>DIFF فقط</span>
            </label>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: '16px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
            <StatBadge label="السجلات" value={filtered.length} color="#3b82f6" />
            <StatBadge label="مع تغيير" value={filtered.filter(l => l.old_value != null || l.new_value != null).length} color="#8b5cf6" />
            <StatBadge label="هذه الصفحة" value={pageData.length} color="#64748b" />
            <div style={{ flex: 1 }} />
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ ...pageBtn, opacity: page === 0 ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', minWidth: 60, textAlign: 'center' }}>
                صفحة {page + 1}
              </span>
              <button disabled={filtered.length <= (page + 1) * LIMIT} onClick={() => setPage(p => p + 1)} style={{ ...pageBtn, opacity: filtered.length <= (page + 1) * LIMIT ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
          border: '1px solid #f1f5f9',
          overflow: 'hidden',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>التاريخ والوقت</th>
                  <th style={th}>المستخدم</th>
                  <th style={th}>الإجراء</th>
                  <th style={th}>المرجع / الحقل</th>
                  <th style={{ ...th, textAlign: 'center' }}>تغيير</th>
                  <th style={{ ...th, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700' }}>جارٍ التحميل...</span>
                      </div>
                    </td>
                  </tr>
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Shield size={48} style={{ opacity: 0.1 }} />
                        <h3 style={{ fontWeight: '800', color: '#475569', margin: 0 }}>لا توجد سجلات مطابقة</h3>
                        {hasActiveFilters && (
                          <button onClick={clearFilters} style={{ ...pageBtn, background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#3b82f6' }}>
                            مسح الفلاتر
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageData.map(log => <LogRow key={log.id} log={log} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        tr:hover td { background: rgba(248,250,255,0.8); }
      `}</style>
    </AppLayout>
  );
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const th = {
  padding: '14px 20px',
  fontSize: '11px',
  fontWeight: '800',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap'
};

const td = {
  padding: '14px 20px',
  fontSize: '13px',
  verticalAlign: 'middle'
};

const pageBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
  padding: '6px 12px', background: 'white', border: '1.5px solid #e2e8f0',
  borderRadius: '8px', fontWeight: '700', fontSize: '12px', color: '#475569',
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s'
};

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, background: 'white', border: '1.5px solid #e2e8f0',
  borderRadius: '10px', color: '#475569', cursor: 'pointer', flexShrink: 0
};

const dateInput = {
  padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
  fontSize: '12px', fontWeight: '600', color: '#334155', background: '#f8fafc',
  outline: 'none', fontFamily: 'inherit'
};

function StatBadge({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{label}:</span>
      <span style={{ fontSize: '12px', color, fontWeight: '800' }}>{value}</span>
    </div>
  );
}
