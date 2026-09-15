import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, CheckCircle, Clock, Trash2, Plus, Minus, Check } from 'lucide-react';

export default function CustomerMenu() {
    const { tableId } = useParams();
    const [menuData, setMenuData] = useState({ categories: [] });
    const [settings, setSettings] = useState({ businessName: 'مطعم / كافيه' });
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [activeCategory, setActiveCategory] = useState(0);
    const [showCart, setShowCart] = useState(false);
    const [orderStatus, setOrderStatus] = useState(null); // null, 'pending', 'preparing', 'ready', 'served'
    const [orderId, setOrderId] = useState(localStorage.getItem(`webOrder_${tableId}`) || null);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());

    useEffect(() => {
        if (orderId) {
            pollOrderStatus();
            const interval = setInterval(pollOrderStatus, 5000);
            return () => clearInterval(interval);
        } else {
            fetchMenu();
        }
    }, [orderId]);

    const fetchMenu = async () => {
        try {
            const res = await fetch('/api/menu');
            const data = await res.json();
            if (data.success) {
                setMenuData(data.data);
                setSettings(data.settings);
            }
        } catch (e) {
            setError('تعذر تحميل القائمة. الرجاء التحقق من الاتصال.');
        } finally {
            setLoading(false);
        }
    };

    const pollOrderStatus = async () => {
        try {
            const res = await fetch(`/api/order/${orderId}`);
            const data = await res.json();
            if (data.success) {
                setOrderStatus(data.order.status);
            }
        } catch (e) {
            console.error('Failed to poll order status');
        }
    };

    const addToCart = (item) => {
        setCart([...cart, { ...item, cartId: crypto.randomUUID(), qty: 1 }]);
    };

    const updateQty = (cartId, delta) => {
        setCart(cart.map(c => {
            if (c.cartId === cartId) {
                const newQty = Math.max(1, c.qty + delta);
                return { ...c, qty: newQty };
            }
            return c;
        }));
    };

    const removeFromCart = (cartId) => {
        setCart(cart.filter(c => c.cartId !== cartId));
    };

    const submitOrder = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableId: parseInt(tableId),
                    items: cart.map(c => ({ id: c.id, qty: c.qty })),
                    idempotencyKey
                })
            });
            const data = await res.json();
            if (data.success) {
                setOrderId(data.order.id);
                setOrderStatus(data.order.status);
                localStorage.setItem(`webOrder_${tableId}`, data.order.id);
                setCart([]);
                setShowCart(false);
            } else {
                setError(data.error || 'فشل إرسال الطلب');
            }
        } catch (e) {
            setError('تعذر إرسال الطلب. الرجاء التحقق من الاتصال.');
        } finally {
            setSubmitting(false);
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] text-[#111827] flex items-center justify-center" dir="rtl">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-[#E55B13] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-[#6B7280]">جاري تحميل القائمة...</p>
                </div>
            </div>
        );
    }

    if (orderId) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] text-[#111827] p-4 flex flex-col items-center" dir="rtl">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-6 text-center mt-10">
                    <CheckCircle className="w-16 h-16 text-[#10B981] mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">تم استلام طلبك</h2>
                    <p className="text-[#6B7280] mb-6">طلب رقم #{orderId}</p>

                    <div className="space-y-4 mb-8">
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${orderStatus === 'pending' || orderStatus === 'accepted' ? 'bg-orange-50 border border-orange-100 text-[#E55B13]' : 'bg-gray-50 text-gray-400'}`}>
                            <Clock className="w-6 h-6" />
                            <span className="font-bold">قيد الانتظار</span>
                        </div>
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${orderStatus === 'preparing' ? 'bg-blue-50 border border-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                            <ChefHatIcon className="w-6 h-6" />
                            <span className="font-bold">جاري التحضير</span>
                        </div>
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${orderStatus === 'ready' || orderStatus === 'served' ? 'bg-green-50 border border-green-100 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                            <Check className="w-6 h-6" />
                            <span className="font-bold">جاهز للتسليم</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => {
                            localStorage.removeItem(`webOrder_${tableId}`);
                            setOrderId(null);
                            setOrderStatus(null);
                            setIdempotencyKey(crypto.randomUUID());
                        }}
                        className="w-full py-3 rounded-xl font-bold text-[#6B7280] bg-gray-100 hover:bg-gray-200"
                    >
                        طلب إضافي من نفس الطاولة
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-[#111827] pb-24" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {/* Header */}
            <header className="sticky top-0 bg-white shadow-sm border-b border-[#E5E7EB] z-10 p-4 text-center">
                <h1 className="text-xl font-bold text-[#E55B13]">{settings.businessName}</h1>
                <p className="text-sm text-[#6B7280]">طاولة رقم {tableId}</p>
            </header>

            {/* Categories */}
            <div className="sticky top-[69px] bg-[#FAFAFA] z-10 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-[#E5E7EB]">
                {menuData.categories.map((cat, idx) => (
                    <button
                        key={idx}
                        onClick={() => setActiveCategory(idx)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-colors ${activeCategory === idx ? 'bg-[#E55B13] text-white' : 'bg-white text-[#6B7280] border border-[#E5E7EB]'}`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Error Toast */}
            {error && (
                <div className="m-4 p-3 bg-red-50 text-[#EF4444] border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Menu Items */}
            <div className="p-4 space-y-4">
                {menuData.categories[activeCategory]?.items.map(item => (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-4 flex gap-4">
                        <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                            {item.description && <p className="text-sm text-[#6B7280] mb-2">{item.description}</p>}
                            <div className="font-bold text-[#E55B13]">SAR {item.price.toFixed(2)}</div>
                        </div>
                        <div className="flex flex-col justify-end">
                            <button
                                onClick={() => addToCart(item)}
                                className="w-10 h-10 rounded-xl bg-orange-50 text-[#E55B13] flex items-center justify-center hover:bg-[#E55B13] hover:text-white transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
                {menuData.categories.length === 0 && (
                    <div className="text-center py-12 text-[#6B7280]">لا توجد أطباق متاحة حالياً</div>
                )}
            </div>

            {/* Cart Bottom Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                    <button
                        onClick={() => setShowCart(true)}
                        className="w-full bg-[#E55B13] hover:bg-[#CC4D0E] text-white py-4 rounded-xl font-bold flex justify-between items-center px-6"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 px-2 py-1 rounded-lg text-sm">{cart.length}</div>
                            <span>عرض السلة</span>
                        </div>
                        <span>SAR {cartTotal.toFixed(2)}</span>
                    </button>
                </div>
            )}

            {/* Cart Sheet */}
            {showCart && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)}></div>
                    <div className="bg-white rounded-t-3xl p-6 relative max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">سلة الطلبات</h2>
                            <button onClick={() => setShowCart(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-6">
                            {cart.map(c => (
                                <div key={c.cartId} className="flex gap-4 items-center border-b border-gray-100 pb-4">
                                    <div className="flex-1">
                                        <div className="font-bold">{c.name}</div>
                                        <div className="text-[#6B7280] text-sm">SAR {(c.price * c.qty).toFixed(2)}</div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                                        <button onClick={() => updateQty(c.cartId, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600"><Minus className="w-4 h-4"/></button>
                                        <span className="font-bold w-4 text-center">{c.qty}</span>
                                        <button onClick={() => updateQty(c.cartId, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600"><Plus className="w-4 h-4"/></button>
                                    </div>
                                    <button onClick={() => removeFromCart(c.cartId)} className="p-2 text-red-500 bg-red-50 rounded-xl">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 pt-4 mb-4">
                            <div className="flex justify-between items-center text-xl font-bold">
                                <span>المجموع:</span>
                                <span>SAR {cartTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={submitOrder}
                            disabled={submitting || cart.length === 0}
                            className="w-full bg-[#E55B13] hover:bg-[#CC4D0E] disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2"
                        >
                            {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                            {!submitting && <ShoppingCart className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ChefHatIcon(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>;
}

function AlertTriangleIcon(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

function XIcon(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
