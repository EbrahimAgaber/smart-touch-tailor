import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function WhatsAppSettings() {
    const [status, setStatus] = useState({ connected: false, qr: null });
    const [loading, setLoading] = useState(true);

    const fetchStatus = () => {
        if (window.api && window.api.whatsapp) {
            window.api.whatsapp.getStatus().then(res => {
                setStatus(res || { connected: false, qr: null });
                setLoading(false);
            }).catch(err => {
                console.error('Failed to get WhatsApp status:', err);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();

        if (!window.api || !window.api.whatsapp) return;

        const unStatus = window.api.whatsapp.onStatus((data) => {
            setStatus(prev => ({ ...prev, ...data }));
        });
        const unQr = window.api.whatsapp.onQr((qr) => {
            setStatus({ connected: false, qr });
        });

        return () => {
            if (typeof unStatus === 'function') unStatus();
            if (typeof unQr === 'function') unQr();
        };
    }, []);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await window.api.whatsapp.logout();
            const s = await window.api.whatsapp.getStatus();
            setStatus(s || { connected: false, qr: null });
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4">ربط واتساب (WhatsApp)</h2>
            <p className="text-gray-600 mb-6">
                قم بربط حساب واتساب الخاص بك لإرسال الفواتير والإشعارات للعملاء تلقائياً في الخلفية.
            </p>

            {loading ? (
                <div className="flex justify-center py-8">
                    <span className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></span>
                </div>
            ) : status.connected ? (
                <div className="flex flex-col items-center p-6 border rounded-lg bg-green-50 border-green-200">
                    <div className="text-green-600 mb-2">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h3 className="text-lg font-bold text-green-800">متصل بنجاح</h3>
                    <p className="text-green-600 mb-6">الواتساب جاهز لإرسال الرسائل والفواتير تلقائياً.</p>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                        تسجيل الخروج (إلغاء الربط)
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center p-6 border rounded-lg">
                    <h3 className="text-lg font-bold mb-4">امسح الكود لربط حسابك</h3>
                    {status.qr ? (
                        <div className="p-4 bg-white border rounded-lg mb-4 shadow-sm">
                            <QRCodeRenderer value={status.qr} />
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
                            <span className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></span>
                            <span>جاري إنشاء رمز QR... برجاء الانتظار</span>
                        </div>
                    )}
                    <p className="text-sm text-gray-500 mt-2 max-w-sm text-center">
                        افتح تطبيق واتساب على هاتفك، اذهب إلى <strong>الأجهزة المرتبطة</strong>، واضغط على <strong>ربط جهاز</strong> ثم وجّه الكاميرا إلى الرمز أعلاه.
                    </p>
                    <button
                        onClick={handleLogout}
                        className="mt-4 text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
                    >
                        إعادة توليد رمز الاستجابة السريعة (تحديث الجلسة)
                    </button>
                </div>
            )}
        </div>
    );
}

function QRCodeRenderer({ value }) {
    const [imgSrc, setImgSrc] = useState('');

    useEffect(() => {
        if (!value) return;
        QRCode.toDataURL(value, { margin: 2, scale: 5 })
            .then(url => setImgSrc(url))
            .catch(err => console.error('QR Generate Error', err));
    }, [value]);

    if (!imgSrc) return null;
    return <img src={imgSrc} alt="WhatsApp QR Code" className="w-64 h-64 select-none" />;
}
