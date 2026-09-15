import re

file_path = r'c:\my-pos\V4\src\pages\TailorPos.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '<div className="grid grid-cols-12 gap-4">'
end_marker = '{/* Dedicated Print View */}'

new_grid = '''<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Right Column (Measurements) */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex justify-between items-center border-b pb-3">
                                <h2 className="text-sm font-bold text-slate-900">المقاسات والنوع</h2>
                                {latestProfile && !profileLoaded && (
                                    <button onClick={handleLoadProfile} className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded text-xs flex items-center gap-1">
                                        <History size={12} /> استرجاع مقاس سابق
                                    </button>
                                )}
                            </div>

                            {/* Items Tabs */}
                            <div className="flex gap-1 overflow-x-auto">
                                {items.map((item, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setActiveItemIndex(idx)}
                                        className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${activeItemIndex === idx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                    >
                                        قطعة {idx + 1}
                                        {items.length > 1 && activeItemIndex === idx && (
                                            <Trash2 size={12} className="text-red-200 hover:text-red-100" onClick={(e) => { e.stopPropagation(); removeItem(idx); }} />
                                        )}
                                    </button>
                                ))}
                                <button onClick={addItem} className="px-3 py-1 rounded text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1">
                                    <Plus size={14} /> إضافة
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex gap-1 bg-slate-50 p-1 rounded border">
                                    {['thobe', 'sirwal', 'shirt', 'bisht'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setGarmentType(t)}
                                            className={`flex-1 py-1 rounded text-xs font-bold transition ${activeItem.garment_type === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-700 hover:bg-slate-200'}`}
                                        >
                                            {t === 'thobe' ? 'ثوب' : t === 'sirwal' ? 'سروال' : t === 'shirt' ? 'قميص' : 'بشت'}
                                        </button>
                                    ))}
                                </div>
                                <div>
                                    <select 
                                        className="w-full border rounded p-1.5 text-xs font-bold bg-slate-50 h-full"
                                        value={activeItem.fabric_code}
                                        onChange={(e) => {
                                            const copy = [...items];
                                            copy[activeItemIndex].fabric_code = e.target.value;
                                            if (e.target.value === 'BYOF') {
                                                copy[activeItemIndex].price = 150;
                                            } else {
                                                const sel = fabrics.find(f => f.ID == e.target.value);
                                                if (sel) copy[activeItemIndex].price = parseFloat(sel.Price || 150);
                                            }
                                            setItems(copy);
                                        }}
                                    >
                                        <option value="BYOF">✂️ قماش خارجي (تفصيل فقط)</option>
                                        {fabrics.map(f => <option key={f.ID} value={f.ID}>{f.Name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {Object.keys(activeItem.measurements).map(k => (
                                    <div key={k} className="bg-slate-50 p-2 rounded border border-slate-200">
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                            {k === 'length' ? 'الطول' : k === 'shoulder' ? 'الكتف' : k === 'neck' ? 'الرقبة' : k === 'chest' ? 'الصدر' : k === 'waist' ? 'الوسط' : k === 'sleeve' ? 'الكم' : k === 'wrist' ? 'الزند' : 'وسع الكم'}
                                        </label>
                                        <input
                                            type="number"
                                            value={activeItem.measurements[k]}
                                            onChange={(e) => updateMeasurement(k, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-center outline-none focus:border-indigo-400"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">الياقة</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => updateConfig('collar', 'classic')} className={`flex-1 py-1.5 border rounded text-xs font-bold ${activeItem.config.collar === 'classic' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white'}`}>كلاسيك</button>
                                        <button onClick={() => updateConfig('collar', 'mandarin')} className={`flex-1 py-1.5 border rounded text-xs font-bold ${activeItem.config.collar === 'mandarin' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white'}`}>ماندرين</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">الكبك</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => updateConfig('cuff', 'single')} className={`flex-1 py-1.5 border rounded text-xs font-bold ${activeItem.config.cuff === 'single' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white'}`}>مفرد</button>
                                        <button onClick={() => updateConfig('cuff', 'double')} className={`flex-1 py-1.5 border rounded text-xs font-bold ${activeItem.config.cuff === 'double' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white'}`}>مزدوج</button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t">
                                <label className="text-[10px] font-bold text-slate-700 block mb-1">ملاحظة المعلم</label>
                                <input
                                    type="text"
                                    value={activeItem.notes}
                                    onChange={(e) => {
                                        const copy = [...items];
                                        copy[activeItemIndex].notes = e.target.value;
                                        setItems(copy);
                                    }}
                                    className="w-full border rounded-lg px-3 py-2 text-xs"
                                    placeholder="إضافة ملاحظات خاصة لهذه القطعة..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Middle Column (Live Preview) */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full">
                            <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">معاينة مباشرة لشكل ورقة الطباعة</h3>
                            <div className="scale-[0.85] origin-top">
                                <TailorWorkOrder orderDetails={orderPayload} />
                            </div>
                        </div>
                    </div>

                    {/* Left Column (Customer & Pay) */}
                    <div className="lg:col-span-3 flex flex-col gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                            <h3 className="text-xs font-bold border-b pb-2">بيانات العميل</h3>
                            <div>
                                <label className="text-[10px] text-slate-500 block">الاسم</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border rounded p-2 text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block">رقم الجوال</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => { setPhone(e.target.value); if(customer){ setCustomer(null); setLatestProfile(null); } }}
                                    onBlur={handlePhoneBlur}
                                    dir="ltr"
                                    className="w-full border rounded p-2 text-xs font-mono font-bold"
                                    placeholder="05XXXXXXXX"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 block">تاريخ التسليم</label>
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    className="w-full border rounded p-2 text-xs font-bold"
                                />
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                            <h3 className="text-xs font-bold border-b pb-2">الحساب والدفع</h3>
                            
                            {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs items-center">
                                    <span>قطعة {idx + 1} ({item.garment_type === 'thobe' ? 'ثوب' : 'أخرى'})</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" value={item.price} onChange={e => { const copy=[...items]; copy[idx].price=e.target.value; setItems(copy); }} className="w-16 border rounded p-1 text-center text-xs font-bold" dir="ltr" />
                                        <span>ر.س</span>
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-between items-center text-xs pt-2 border-t">
                                <span className="text-slate-500 font-bold">الخصم الإضافي:</span>
                                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-20 border rounded p-1 text-center font-bold" dir="ltr" />
                            </div>
                            
                            <div className="flex justify-between text-xs text-slate-500 font-bold">
                                <span>الضريبة (15%):</span>
                                <span dir="ltr">{vat.toFixed(2)} SAR</span>
                            </div>

                            <div className="flex justify-between text-xs font-bold pt-2 border-t">
                                <span>الإجمالي:</span>
                                <span className="font-bold">{total.toFixed(2)} ر.س</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-xs">
                                <span>المدفوع:</span>
                                <input
                                    type="number"
                                    value={paid}
                                    onChange={(e) => setPaid(e.target.value)}
                                    className="w-20 border rounded p-1 text-left font-bold"
                                    dir="ltr"
                                />
                            </div>
                            <div className="flex justify-between text-xs border-t pt-2 font-bold">
                                <span>المتبقي:</span>
                                <span className={balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>{balance.toFixed(2)} ر.س</span>
                            </div>

                            <div className="flex gap-2 py-1">
                                {[{ id: 'Cash', label: 'نقداً', icon: Banknote }, { id: 'Card', label: 'شبكة', icon: CreditCard }, { id: 'Split', label: 'مقسم', icon: AlertCircle }].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setPaymentMethod(m.id)}
                                        className={`flex-1 py-1.5 flex flex-col items-center gap-1 text-[10px] font-bold rounded-lg border ${paymentMethod === m.id ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <m.icon size={12} /> {m.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={saving}
                                className={`w-full text-white text-xs font-bold py-2 rounded mt-2 transition shadow ${saving ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                {saving ? 'جاري التنفيذ...' : 'حفظ وإنشاء الطلب'}
                            </button>
                        </div>
                    </div>
                </div>

                '''

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_grid + content[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Markers not found!")
