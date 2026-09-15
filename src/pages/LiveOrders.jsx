import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { CheckCircle, XCircle, Clock, ChefHat, Receipt, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LiveOrders() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rejectModal, setRejectModal] = useState({ show: false, orderId: null });
    const [rejectReason, setRejectReason] = useState('غير متوفر');
    const prevOrdersRef = useRef([]);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 10000);
        
        let cleanup = () => {};
        if (window.api && window.api.onIncomingWebOrder) {
            cleanup = window.api.onIncomingWebOrder((newOrder) => {
                playChime();
                fetchOrders();
            });
        }
        
        return () => {
            clearInterval(interval);
            cleanup();
        };
    }, []);

    const fetchOrders = async () => {
        if (!window.api) return;
        try {
            const data = await window.api.getPendingWebOrders();
            
            // Check for new pending orders to play chime
            if (prevOrdersRef.current.length > 0) {
                const prevPending = prevOrdersRef.current.filter(o => o.status === 'pending').map(o => o.id);
                const newPending = data.filter(o => o.status === 'pending');
                const hasNew = newPending.some(o => !prevPending.includes(o.id));
                if (hasNew) playChime();
            }
            
            setOrders(data);
            prevOrdersRef.current = data;
        } catch (e) {
            console.error('Failed to fetch web orders', e);
        } finally {
            setLoading(false);
        }
    };

    const playChime = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error('Audio chime failed', e);
        }
    };

    const handleAccept = async (id) => {
        try {
            await window.api.acceptWebOrder(id);
            fetchOrders();
        } catch (e) {
            console.error(e);
        }
    };

    const handleReject = async () => {
        try {
            await window.api.rejectWebOrder(rejectModal.orderId, rejectReason);
            setRejectModal({ show: false, orderId: null });
            fetchOrders();
        } catch (e) {
            console.error(e);
        }
    };

    const handleMarkReady = async (id) => {
        try {
            await window.api.markWebOrderReady(id);
            fetchOrders();
        } catch (e) {
            console.error(e);
        }
    };

    const handleComplete = async (order) => {
        try {
            await window.api.markWebOrderServed(order.id);
            // Navigate to POS with items
            navigate('/pos', { state: { webOrderItems: order.items, tableId: order.table_id, webOrderId: order.id } });
        } catch (e) {
            console.error(e);
        }
    };

    const getWaitTime = (createdAt) => {
        const start = new Date(createdAt);
        const now = new Date();
        const diff = Math.floor((now - start) / 60000);
        return diff;
    };

    const getWaitColor = (minutes) => {
        if (minutes > 20) return '#ef4444';
        if (minutes > 10) return '#f59e0b';
        return '#10b981';
    };

    // Group by table
    const groupedOrders = orders.reduce((acc, order) => {
        if (!acc[order.table_id]) acc[order.table_id] = [];
        acc[order.table_id].push(order);
        return acc;
    }, {});

    return (
        <AppLayout title={t('live_orders', 'طلبات QR')}>
            <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:'20px', overflowY: 'auto', paddingBottom: '40px' }}>
                
                {loading ? (
                    <div style={{ textAlign:'center', padding:'60px' }}>جاري التحميل...</div>
                ) : orders.length === 0 ? (
                    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>
                        <ChefHat size={80} style={{ opacity: 0.2, marginBottom:'16px' }} />
                        <h3 style={{ fontWeight:'800' }}>لا توجد طلبات جديدة حالياً</h3>
                    </div>
                ) : (
                    Object.keys(groupedOrders).map(tableId => (
                        <div key={tableId} style={{ background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                                <div style={{ background: '#eff6ff', color: '#3b82f6', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px' }}>
                                    {tableId}
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a' }}>طاولة رقم {tableId}</h2>
                                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                                    {groupedOrders[tableId].length} طلبات
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                                {groupedOrders[tableId].map(order => {
                                    const minutes = getWaitTime(order.created_at);
                                    const timerColor = getWaitColor(minutes);
                                    
                                    let borderColor = '#f1f5f9';
                                    let headerBg = '#f8fafc';
                                    if (order.status === 'pending') {
                                        borderColor = '#f59e0b';
                                        headerBg = '#fffbeb';
                                    } else if (order.status === 'accepted' || order.status === 'preparing') {
                                        borderColor = '#3b82f6';
                                        headerBg = '#eff6ff';
                                    } else if (order.status === 'ready') {
                                        borderColor = '#10b981';
                                        headerBg = '#ecfdf5';
                                    } else if (order.status === 'rejected') {
                                        borderColor = '#ef4444';
                                        headerBg = '#fef2f2';
                                    }

                                    return (
                                        <div key={order.id} style={{ 
                                            borderRadius: '16px', 
                                            border: `2px solid ${borderColor}`,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            overflow: 'hidden',
                                            opacity: order.status === 'rejected' ? 0.6 : 1
                                        }}>
                                            {/* Header */}
                                            <div style={{ padding: '16px', background: headerBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: '800', fontSize: '16px', color: '#1e293b' }}>{order.id}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginTop: '4px' }}>
                                                        {new Date(order.created_at).toLocaleTimeString('ar-SA')}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: timerColor, fontWeight: '800', fontSize: '14px', background: 'white', padding: '6px 12px', borderRadius: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                    <Clock size={16} /> {minutes} د
                                                </div>
                                            </div>

                                            {/* Items */}
                                            <div style={{ flex: 1, padding: '16px', maxHeight: '250px', overflowY: 'auto' }}>
                                                {(order.items || []).map((item, idx) => (
                                                    <div key={idx} style={{ marginBottom: '12px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#0f172a' }}>
                                                            <span>{item.name}</span>
                                                            <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>×{item.qty}</span>
                                                        </div>
                                                        {item.note && <div style={{ fontSize: '12px', color: '#ef4444', fontStyle: 'italic', marginTop: '4px' }}>⚠️ {item.note}</div>}
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '900', fontSize: '18px', color: '#3b82f6' }}>
                                                    <span>الإجمالي:</span>
                                                    <span>SAR {order.server_total?.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {order.status !== 'rejected' && order.status !== 'served' && (
                                                <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
                                                    {order.status === 'pending' && (
                                                        <>
                                                            <button onClick={() => handleAccept(order.id)} style={{ ...btnBase, background: '#10b981', color: 'white' }}>
                                                                <CheckCircle size={18} /> قبول
                                                            </button>
                                                            <button onClick={() => setRejectModal({ show: true, orderId: order.id })} style={{ ...btnBase, background: 'white', color: '#ef4444', border: '1px solid #ef4444' }}>
                                                                <XCircle size={18} /> رفض
                                                            </button>
                                                        </>
                                                    )}
                                                    {(order.status === 'accepted' || order.status === 'preparing') && (
                                                        <button onClick={() => handleMarkReady(order.id)} style={{ ...btnBase, background: '#10b981', color: 'white' }}>
                                                            <ChefHat size={18} /> تحديد كجاهز
                                                        </button>
                                                    )}
                                                    {order.status === 'ready' && (
                                                        <button onClick={() => handleComplete(order)} style={{ ...btnBase, background: '#3b82f6', color: 'white' }}>
                                                            <Receipt size={18} /> دفع الفاتورة
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {order.status === 'rejected' && (
                                                <div style={{ padding: '16px', background: '#fef2f2', color: '#ef4444', textAlign: 'center', fontWeight: '700', fontSize: '14px' }}>
                                                    تم الرفض: {order.reject_reason}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Reject Modal */}
            {rejectModal.show && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '24px', width: '400px', maxWidth: '90%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: '#ef4444' }}>
                            <AlertTriangle size={24} />
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>رفض الطلب</h3>
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', color: '#64748b' }}>سبب الرفض:</label>
                            <select 
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '14px' }}
                            >
                                <option value="غير متوفر">بعض الأصناف غير متوفرة</option>
                                <option value="المطبخ مغلق">المطبخ مغلق حالياً</option>
                                <option value="أخرى">أخرى</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleReject} style={{ ...btnBase, background: '#ef4444', color: 'white' }}>تأكيد الرفض</button>
                            <button onClick={() => setRejectModal({ show: false, orderId: null })} style={{ ...btnBase, background: '#f1f5f9', color: '#64748b' }}>إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

const btnBase = { 
    flex: 1, 
    padding: '12px', 
    border: 'none', 
    borderRadius: '12px', 
    fontWeight: '800', 
    fontSize: '14px', 
    cursor: 'pointer', 
    fontFamily: 'inherit',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px'
};
