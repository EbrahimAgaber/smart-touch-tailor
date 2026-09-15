import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../components/ToastManager';

const VAT_RATE = window.__vatRate__ || 0.15;

export function estimateFabricConsumption(garmentType, measurements, fabricWidth = 58) {
    const len = parseFloat(measurements?.length || 58);
    const sleeve = parseFloat(measurements?.sleeve || 24);
    const widthFactor = fabricWidth >= 54 ? 1.0 : 1.45;

    if (garmentType === 'sirwal' || garmentType === 'سروال') {
        return parseFloat(((len + 15) / 39.37 * 1.1).toFixed(2));
    }
    if (garmentType === 'shirt' || garmentType === 'قميص') {
        return parseFloat(((len + sleeve + 10) / 39.37 * 1.0).toFixed(2));
    }
    if (garmentType === 'suit' || garmentType === 'بدلة') {
        return 3.25;
    }
    if (garmentType === 'bisht' || garmentType === 'بشت') {
        return 5.5;
    }
    // Standard Thobe: (Length + Sleeve + 6 inch hem allowance)
    const totalInches = len + sleeve + 6;
    const meters = (totalInches * 0.0254) * widthFactor;
    return parseFloat(Math.max(1.8, Math.min(6.0, meters)).toFixed(2));
}

export function useTailorPos() {
    const location = useLocation();
    const { showToast } = useToast?.() ?? { showToast: (m) => console.log(m) };

    const [loading, setLoading] = useState(true);
    const [businessName, setBusinessName] = useState('Maximum Speed Tech Supply LTD');
    const [defaultDeliveryDays, setDefaultDeliveryDays] = useState(7);
    const [fabrics, setFabrics] = useState([]);
    
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [customer, setCustomer] = useState(null);
    const [latestProfile, setLatestProfile] = useState(null);
    const [customerProfiles, setCustomerProfiles] = useState([]);
    const [profileLoaded, setProfileLoaded] = useState(false);
    
    const [invoiceNumber, setInvoiceNumber] = useState(() => Math.floor(1000 + Math.random() * 90000));
    const [deliveryDate, setDeliveryDate] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [urgentFee, setUrgentFee] = useState(0);
    const [isGift, setIsGift] = useState(false);
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    
    const [items, setItems] = useState([
        {
            id: 1,
            garment_type: 'thobe',
            fabric_code: 'BYOF',
            price: 150,
            notes: '',
            config: { collar: 'classic', cuff: 'single' },
            measurements: { length: '', shoulder: '', neck: '', chest: '', waist: '', sleeve: '', wrist: '', hand_opening: '', bottom_flare: '', khaban: '', collar_height: '', jabzor: '' },
            is_temp_adjustment: false
        }
    ]);

    const [activeItemIndex, setActiveItemIndex] = useState(0);
    const [paid, setPaid] = useState('');
    const [discount, setDiscount] = useState('0');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [splitCash, setSplitCash] = useState('');
    const [splitCard, setSplitCard] = useState('');
    const [saving, setSaving] = useState(false);
    const [staff, setStaff] = useState([]);
    const [tailorId, setTailorId] = useState('');
    const [cutterId, setCutterId] = useState('');

    useEffect(() => {
        if (paymentMethod === 'Split') {
            const cash = parseFloat(splitCash) || 0;
            const remainingForCard = Math.max(0, (parseFloat(paid) || 0) - cash);
            setSplitCard(remainingForCard.toFixed(2));
        }
    }, [splitCash, paid, paymentMethod]);

    const setDeliveryDays = (days) => {
        const dDate = new Date();
        dDate.setDate(dDate.getDate() + days);
        setDeliveryDate(dDate.toISOString().split('T')[0]);
    };

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (phone || name || items.some(i => i.measurements.length)) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [phone, name, items]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const s = await window.api?.getSettings?.();
                let days = 7;
                if (s?.tailor_default_delivery_days) {
                    days = parseInt(s.tailor_default_delivery_days) || 7;
                }
                setDefaultDeliveryDays(days);
                if(s?.business_name_ar) setBusinessName(s.business_name_ar);

                const dDate = new Date();
                dDate.setDate(dDate.getDate() + days);
                setDeliveryDate(dDate.toISOString().split('T')[0]);

                const menuItems = await window.api?.getMenu?.() ?? [];
                const fabricItems = (menuItems || []).filter(p => p.IsFabric && p.IsActive);
                setFabrics(fabricItems);

                if (fabricItems.length > 0) {
                    const copy = [...items];
                    copy[0].fabric_code = fabricItems[0].ID;
                    copy[0].price = parseFloat(fabricItems[0].Price || 150);
                    setItems(copy);
                }
                
                const st = await window.api?.getStaff?.() ?? [];
                setStaff(st);

                // Check URL params and router state (e.g. from Customer or Measurement page)
                try {
                    // Check navigation state first
                    if (location.state?.preloadedMeasurements) {
                        const pm = location.state.preloadedMeasurements;
                        setItems(prevItems => {
                            const copy = [...prevItems];
                            copy[0] = {
                                ...copy[0],
                                garment_type: pm.garment_type || copy[0].garment_type,
                                measurements: {
                                    length: pm.length || '',
                                    shoulder: pm.shoulder || '',
                                    neck: pm.neck || '',
                                    chest: pm.chest || '',
                                    waist: pm.waist || '',
                                    sleeve: pm.sleeve || '',
                                    wrist: pm.wrist || '',
                                    hand_opening: pm.hand_opening || ''
                                },
                                config: {
                                    collar: pm.collar || copy[0].config.collar,
                                    cuff: pm.cuff || copy[0].config.cuff
                                },
                                notes: pm.notes || copy[0].notes || ''
                            };
                            return copy;
                        });
                        setProfileLoaded(true);
                    }
                    if (location.state?.customer) {
                        setCustomer(location.state.customer);
                        if (location.state.customer.name) setName(location.state.customer.name);
                        if (location.state.customer.phone) setPhone(location.state.customer.phone);
                    }

                    const hash = window.location.hash || '';
                    const qIdx = hash.indexOf('?');
                    if (qIdx !== -1) {
                        const searchStr = hash.substring(qIdx);
                        const params = new URLSearchParams(searchStr);
                        const pPhone = params.get('phone');
                        const pName = params.get('name');
                        const pCustId = params.get('customerId') || params.get('customer_id');
                        const pProfileId = params.get('profileId') || params.get('profile_id');

                        if (pPhone) setPhone(pPhone);
                        if (pName) setName(decodeURIComponent(pName));
                        if (pCustId) {
                            const cId = Number(pCustId);
                            const custs = await window.api?.getCustomers?.({ id: cId });
                            if (Array.isArray(custs) && custs.length > 0) {
                                const found = custs.find(x => x.id === cId) || custs[0];
                                setCustomer(found);
                                setName(found.name || '');
                                if (found.phone) setPhone(found.phone);

                                const profs = await window.api?.tailor?.getMeasurements?.({ customer_id: cId });
                                if (profs && profs.length > 0) {
                                    const sorted = profs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                                    const chosen = pProfileId ? (profs.find(p => String(p.id) === String(pProfileId)) || sorted[0]) : sorted[0];
                                    setLatestProfile(chosen);

                                    // If measurements not loaded via router state, preload chosen profile measurements into items[0]
                                    if (!location.state?.preloadedMeasurements && chosen?.measurements) {
                                        const m = chosen.measurements;
                                        setItems(prevItems => {
                                            const copy = [...prevItems];
                                            copy[0] = {
                                                ...copy[0],
                                                measurements: {
                                                    length: m.length || '',
                                                    shoulder: m.shoulder || '',
                                                    neck: m.neck || '',
                                                    chest: m.chest || '',
                                                    waist: m.waist || '',
                                                    sleeve: m.sleeve || '',
                                                    wrist: m.wrist || m.cuff || m.cuffs || '',
                                                    hand_opening: m.hand_opening || m.bottom || '',
                                                    bottom_flare: m.bottom_flare || '',
                                                    khaban: m.khaban || '',
                                                    collar_height: m.collar_height || '',
                                                    jabzor: m.jabzor || ''
                                                },
                                                config: {
                                                    collar: m.collar || copy[0].config.collar,
                                                    cuff: m.cuff || m.cuffs || copy[0].config.cuff
                                                },
                                                notes: m.notes || copy[0].notes || ''
                                            };
                                            if (chosen.garment_type) {
                                                const gt = chosen.garment_type;
                                                copy[0].garment_type = gt === 'ثوب' ? 'thobe' : gt === 'سروال' ? 'sirwal' : gt === 'قميص' ? 'shirt' : gt === 'بشت' ? 'bisht' : gt;
                                            }
                                            return copy;
                                        });
                                        setProfileLoaded(true);
                                    }
                                }
                            }
                        }
                    }
                } catch (paramErr) {
                    console.error('Error parsing tailor POS URL params/state:', paramErr);
                }

                const tailors = st.filter(s => {
                    const role = (s.role || '').toLowerCase();
                    return !['admin', 'cashier'].includes(role);
                });
                if (tailors.length > 0) setTailorId(tailors[0].id);
                else setTailorId('');

            } catch (err) {
                console.error('Failed to load configs:', err);
                const dDate = new Date();
                dDate.setDate(dDate.getDate() + 7);
                setDeliveryDate(dDate.toISOString().split('T')[0]);
            }
            setLoading(false);
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePhoneSearch = useCallback(async (searchPhone) => {
        const clean = (searchPhone || '').replace(/\D/g, '');
        if (clean.length >= 7) {
            try {
                const res = await window.api?.getCustomers?.({ search: clean });
                if (res && res.length > 0) {
                    const c = res[0];
                    setCustomer(c);
                    setName(c.name);
                    const profiles = await window.api?.tailor?.getMeasurements?.({ customer_id: c.id });
                    if (profiles && profiles.length > 0) {
                        const sorted = profiles.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                        setCustomerProfiles(sorted);
                        setLatestProfile(sorted[0]);
                        setProfileLoaded(false);
                        showToast({ type: 'info', message: 'تم العثور على مقاسات سابقة للعميل' });
                    } else {
                        setCustomerProfiles([]);
                        setLatestProfile(null);
                    }
                } else {
                    setCustomer(null);
                    setCustomerProfiles([]);
                    setLatestProfile(null);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            setCustomer(null);
            setCustomerProfiles([]);
            setLatestProfile(null);
        }
    }, [showToast]);

    useEffect(() => {
        handlePhoneSearch(phone);
    }, [phone, handlePhoneSearch]);

    const loadProfile = useCallback((profileToLoad) => {
        const target = profileToLoad || latestProfile;
        if (target?.measurements) {
            const m = target.measurements;
            const copy = [...items];
            copy[activeItemIndex].measurements = {
                length: m.length || '',
                shoulder: m.shoulder || '',
                chest: m.chest || '',
                waist: m.waist || '',
                neck: m.neck || '',
                sleeve: m.sleeve || '',
                wrist: m.wrist || m.cuff || m.cuffs || '',
                hand_opening: m.hand_opening || m.bottom || '',
                bottom_flare: m.bottom_flare || '',
                khaban: m.khaban || '',
                collar_height: m.collar_height || '',
                jabzor: m.jabzor || ''
            };
            if (m.collar || m.cuff) {
                copy[activeItemIndex].config = {
                    collar: m.collar || copy[activeItemIndex].config.collar,
                    cuff: m.cuff || copy[activeItemIndex].config.cuff
                };
            }
            copy[activeItemIndex].notes = m.notes || copy[activeItemIndex].notes || '';
            if (target.garment_type) {
                const gt = target.garment_type;
                copy[activeItemIndex].garment_type = gt === 'ثوب' ? 'thobe' : gt === 'سروال' ? 'sirwal' : gt === 'قميص' ? 'shirt' : gt === 'بشت' ? 'bisht' : gt;
            }
            setItems(copy);
            setLatestProfile(target);
            setProfileLoaded(true);
            showToast?.({ type: 'success', message: 'تم تحميل المقاسات السابقة بنجاح' });
        }
    }, [latestProfile, activeItemIndex, items, showToast]);

    const handleLoadProfile = useCallback(() => {
        loadProfile(latestProfile);
    }, [loadProfile, latestProfile]);

    const activeItem = items[activeItemIndex] || items[0];

    const updateMeasurement = (key, val) => {
        const copy = [...items];
        copy[activeItemIndex].measurements[key] = val;
        setItems(copy);
    };

    const updateConfig = (key, val) => {
        const copy = [...items];
        copy[activeItemIndex].config[key] = val;
        setItems(copy);
    }

    const setGarmentType = (type) => {
        const copy = [...items];
        copy[activeItemIndex].garment_type = type;
        setItems(copy);
    };

    const cloneItem = () => {
        const newItem = JSON.parse(JSON.stringify(items[activeItemIndex]));
        newItem.id = items.length + 1;
        setItems([...items, newItem]);
        setActiveItemIndex(items.length);
    };

    const addItem = () => {
        const newItem = {
            id: items.length + 1,
            garment_type: 'thobe',
            fabric_code: fabrics.length > 0 ? fabrics[0].ID : 'BYOF',
            price: fabrics.length > 0 ? parseFloat(fabrics[0].Price || 150) : 150,
            notes: '',
            config: { collar: 'classic', cuff: 'single' },
            measurements: { length: '', shoulder: '', neck: '', chest: '', waist: '', sleeve: '', wrist: '', hand_opening: '', bottom_flare: '', khaban: '', collar_height: '', jabzor: '' }
        };
        setItems([...items, newItem]);
        setActiveItemIndex(items.length);
    };

    const removeItem = (idx) => {
        if (items.length <= 1) return;
        const newItems = items.filter((_, i) => i !== idx);
        setItems(newItems);
        setActiveItemIndex(Math.min(activeItemIndex, newItems.length - 1));
    };

    const subtotalBeforeDiscount = items.reduce((acc, item) => acc + (Number(item.price) || 0), 0) + (isUrgent ? Number(urgentFee) : 0);
    const finalSubtotal = Math.max(0, subtotalBeforeDiscount - parseFloat(discount || 0));
    const vat = finalSubtotal * VAT_RATE;
    const total = finalSubtotal + vat;
    const balance = Math.max(0, total - (parseFloat(paid) || 0));

    const orderPayload = { 
        invoiceNumber, 
        customer: { name, phone }, 
        date: new Date().toLocaleDateString('ar-SA'),
        deliveryDate: new Date(deliveryDate).toLocaleDateString('ar-SA'),
        isUrgent, urgentFee,
        isGift, recipientName, recipientPhone,
        notes: items[0]?.notes || '',
        subtotal: finalSubtotal,
        paid: parseFloat(paid) || 0,
        balance: balance,
        items 
    };

    const handleSaveProfile = async () => {
        if (!phone || !name) {
            showToast?.({ type: 'error', message: 'يرجى إدخال بيانات العميل (الجوال والاسم)' });
            return;
        }
        try {
            let customerId = customer?.id;
            if (!customerId) {
                const cRes = await window.api?.addCustomer?.({ name, phone });
                if (cRes?.id) customerId = cRes.id;
            }
            const currentItem = items[activeItemIndex];
            const garmentType = currentItem.garment_type === 'thobe' ? 'ثوب' : currentItem.garment_type === 'sirwal' ? 'سروال' : currentItem.garment_type === 'shirt' ? 'قميص' : 'بشت';
            await window.api?.tailor?.saveProfile?.({
                customer_id: customerId,
                garment_type: garmentType,
                measurements: { ...currentItem.measurements, ...currentItem.config }
            });
            showToast?.({ type: 'success', message: 'تم حفظ المقاسات في ملف العميل' });
        } catch (err) {
            showToast?.({ type: 'error', message: err.message || 'فشل حفظ المقاسات' });
        }
    };

    const resetForm = useCallback(() => {
        setPhone(''); 
        setName(''); 
        setCustomer(null);
        setLatestProfile(null);
        setCustomerProfiles([]);
        setProfileLoaded(false);
        setActiveItemIndex(0);
        setIsUrgent(false);
        setUrgentFee(0);
        setIsGift(false);
        setRecipientName('');
        setRecipientPhone('');
        setInvoiceNumber(Math.floor(1000 + Math.random() * 90000));
        setItems([{
            id: 1,
            garment_type: 'thobe',
            fabric_code: 'BYOF',
            price: fabrics.length > 0 ? parseFloat(fabrics[0].Price || 150) : 150,
            notes: '',
            config: { collar: 'classic', cuff: 'single' },
            measurements: { length: '', shoulder: '', neck: '', chest: '', waist: '', sleeve: '', wrist: '', hand_opening: '', bottom_flare: '', khaban: '', collar_height: '', jabzor: '' },
            is_temp_adjustment: false
        }]);
        setPaid(''); 
        setDiscount('0');
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + defaultDeliveryDays);
        setDeliveryDate(newDate.toISOString().split('T')[0]);
    }, [fabrics, defaultDeliveryDays]);

    // createTailorOrder: saves the tailor work order + garments to DB.
    // Does NOT create a sale invoice — POS.jsx handles payment.
    // Returns handoff data for Pos.jsx navigation, or null on failure.
    const createTailorOrder = async (mode = 'pending') => {
        if (saving) return null;
        if (!phone || !name) {
            showToast?.({ type: 'error', message: 'يرجى إدخال بيانات العميل (الجوال والاسم)' });
            return null;
        }

        const invalidItem = !isGift && items.find(i => !i.measurements.length || parseFloat(i.measurements.length) <= 0);
        if (invalidItem) {
            showToast?.({ type: 'error', message: 'يرجى إدخال الطول لكل القطع أو تحديد الطلب كهدية' });
            return null;
        }

        setSaving(true);
        try {
            let customerId = customer?.id;
            if (!customerId) {
                const cRes = await window.api?.addCustomer?.({ name, phone });
                if (cRes?.id) customerId = cRes.id;
            }

            const garmentsList = items.map(i => {
                const fab = fabrics.find(f => f.ID == i.fabric_code);
                return {
                    garment_type: i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'sirwal' ? 'سروال' : i.garment_type === 'shirt' ? 'قميص' : i.garment_type === 'suit' ? 'بدلة' : 'بشت',
                    fabric_id: i.fabric_code === 'BYOF' ? null : (fab?.ID || null),
                    assigned_tailor_id: tailorId || null,
                    assigned_cutter_id: cutterId || null,
                    measurements: { ...i.measurements, ...i.config },
                    special_instructions: i.notes,
                    fabric_length_used: i.fabric_code === 'BYOF' ? 0 : estimateFabricConsumption(i.garment_type, i.measurements),
                    is_temp_adjustment: !!i.is_temp_adjustment
                };
            });

            // Save the tailor work order. No sale_invoice_id yet — POS will provide it.
            const res = await window.api?.tailor?.createOrder?.({
                customer_id: customerId,
                staff_id: tailorId || undefined,
                total_amount: total,
                deposit_paid: 0,
                balance_due: total,
                target_delivery_date: deliveryDate,
                payment_method: paymentMethod === 'Split' ? 'Cash+Card' : paymentMethod,
                is_urgent: isUrgent, urgent_fee: urgentFee,
                is_gift: isGift, recipient_name: recipientName, recipient_phone: recipientPhone,
                status: mode,
                garments: garmentsList
            });

            if (!res?.success) {
                throw new Error(res?.error || 'فشل إنشاء طلب التفصيل');
            }

            // Auto-save measurements to profile (non-temp adjustments only)
            try {
                for (const item of items) {
                    if (item.is_temp_adjustment) continue;
                    const gType = item.garment_type === 'thobe' ? 'ثوب' : item.garment_type === 'sirwal' ? 'سروال' : item.garment_type === 'shirt' ? 'قميص' : item.garment_type === 'suit' ? 'بدلة' : 'بشت';
                    await window.api?.tailor?.saveProfile?.({
                        customer_id: customerId,
                        garment_type: gType,
                        measurements: { ...item.measurements, ...item.config }
                    });
                }
            } catch (err) {
                console.error("Failed to auto-save measurements:", err);
            }

            // Build the cart items to hand off to Pos.jsx
            const cartItems = items.map(i => {
                const fab = fabrics.find(f => f.ID == i.fabric_code);
                const fName = i.fabric_code === 'BYOF' ? 'قماش خارجي' : (fab?.Name || 'قماش المحل');
                const gType = i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'sirwal' ? 'سروال' : i.garment_type === 'shirt' ? 'قميص' : 'بشت';
                return {
                    id: `tailor_item_${i.id || Math.random()}`,
                    Name: `تفصيل ${gType} (${fName})`,
                    Price: parseFloat(i.price || 0),
                    Qty: 1,
                    Category: 'خياطة',
                };
            });

            return {
                orderId: res.order_id,
                customer: { id: customerId, name, phone },
                cartItems,
                total,
                depositSuggested: parseFloat(paid || 0),
                deliveryDate,
                orderNote: `طلب تفصيل #${res.order_id || ''}${isUrgent ? ' — مستعجل' : ''}${isGift ? ' — هدية' : ''}`,
            };
        } catch (err) {
            showToast?.({ type: 'error', message: err.message });
            return null;
        } finally {
            setSaving(false);
        }
    };

    // processOrder: draft-only path — saves to DB with a sale record and provides a receipt
    const processOrder = async (mode = 'draft') => {
        if (saving) return;
        if (!phone || !name) {
            showToast?.({ type: 'error', message: 'يرجى إدخال بيانات العميل (الجوال والاسم)' });
            return;
        }

        const invalidItem = !isGift && items.find(i => !i.measurements.length || parseFloat(i.measurements.length) <= 0);
        if (invalidItem) {
            showToast?.({ type: 'error', message: 'يرجى إدخال الطول لكل القطع أو تحديد الطلب كهدية' });
            return;
        }

        setSaving(true);
        try {
            let customerId = customer?.id;
            if (!customerId) {
                const cRes = await window.api?.addCustomer?.({ name, phone });
                if (cRes?.id) customerId = cRes.id;
            }

            let finalPaymentMethod = paymentMethod === 'Split' ? 'Cash+Card' : paymentMethod;
            
            const saleItems = items.map(i => {
                const fab = fabrics.find(f => f.ID == i.fabric_code);
                const fName = i.fabric_code === 'BYOF' ? 'قماش خارجي' : (fab?.Name || 'قماش المحل');
                const gType = i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'sirwal' ? 'سروال' : i.garment_type === 'shirt' ? 'قميص' : 'بشت';
                const itemPrice = parseFloat(i.price || 0);
                return {
                    item_name: `تفصيل ${gType} (${fName})`,
                    Name: `تفصيل ${gType} (${fName})`,
                    quantity: 1, Qty: 1,
                    item_price: itemPrice, Price: itemPrice
                };
            });

            const saleInvoiceStr = `INV-${Date.now()}`;
            const depositAmount = parseFloat(paid || 0);
            
            const saleRes = await window.api?.saveSale?.({
                invoice: saleInvoiceStr, total, subtotal: finalSubtotal, tax: vat,
                paid: depositAmount, payment: finalPaymentMethod,
                customer_id: customerId, staff_id: tailorId || undefined,
                order_type: 'tailor', items: saleItems
            });
            
            if (saleRes && !saleRes.success) throw new Error(saleRes.error || 'فشل حفظ الفاتورة');
            const finalTaxInvoiceNum = saleRes?.invoice || saleInvoiceStr;

            const garmentsList = items.map(i => {
                const fab = fabrics.find(f => f.ID == i.fabric_code);
                return {
                    garment_type: i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'sirwal' ? 'سروال' : i.garment_type === 'shirt' ? 'قميص' : i.garment_type === 'suit' ? 'بدلة' : 'بشت',
                    fabric_id: i.fabric_code === 'BYOF' ? null : (fab?.ID || null),
                    assigned_tailor_id: tailorId || null, assigned_cutter_id: cutterId || null,
                    measurements: { ...i.measurements, ...i.config }, special_instructions: i.notes,
                    fabric_length_used: i.fabric_code === 'BYOF' ? 0 : estimateFabricConsumption(i.garment_type, i.measurements),
                    is_temp_adjustment: !!i.is_temp_adjustment
                };
            });

            const res = await window.api?.tailor?.createOrder?.({
                sale_invoice_id: finalTaxInvoiceNum, customer_id: customerId,
                staff_id: tailorId || undefined, total_amount: total,
                deposit_paid: depositAmount, balance_due: balance,
                target_delivery_date: deliveryDate, payment_method: finalPaymentMethod,
                is_urgent: isUrgent, urgent_fee: urgentFee,
                is_gift: isGift, recipient_name: recipientName, recipient_phone: recipientPhone,
                status: mode, garments: garmentsList
            });

            if (!res?.success) {
                if (res && res.success === false) throw new Error(res?.error || 'فشل الحفظ');
            }

            try {
                for (const item of items) {
                    if (item.is_temp_adjustment) continue;
                    const gType = item.garment_type === 'thobe' ? 'ثوب' : item.garment_type === 'sirwal' ? 'سروال' : item.garment_type === 'shirt' ? 'قميص' : item.garment_type === 'suit' ? 'بدلة' : 'بشت';
                    await window.api?.tailor?.saveProfile?.({ customer_id: customerId, garment_type: gType, measurements: { ...item.measurements, ...item.config } });
                }
            } catch (err) { console.error("Failed to auto-save measurements:", err); }

            showToast?.({ type: 'success', message: 'تم حفظ الطلب كمسودة بنجاح' });
            resetForm();
        } catch (err) {
            showToast?.({ type: 'error', message: err.message });
        } finally {
            setSaving(false);
        }
    };


    const handleMeasurementKeyDown = (e, nextId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextElement = document.getElementById(nextId);
            if (nextElement) {
                nextElement.focus();
            }
        }
    };

    return {
        loading,
        businessName,
        fabrics,
        phone, setPhone,
        name, setName,
        customer, setCustomer,
        customerProfiles,
        latestProfile, setLatestProfile,
        profileLoaded, setProfileLoaded,
        invoiceNumber,
        deliveryDate, setDeliveryDate, setDeliveryDays,
        items, setItems,
        activeItemIndex, setActiveItemIndex,
        paid, setPaid,
        discount, setDiscount,
        paymentMethod, setPaymentMethod,
        splitCash, setSplitCash,
        splitCard, setSplitCard,
        saving, setSaving,
        staff,
        tailorId, setTailorId,
        cutterId, setCutterId,
        activeItem,
        handleLoadProfile,
        loadProfile,
        resetForm,
        updateMeasurement,
        updateConfig,
        setGarmentType,
        cloneItem,
        addItem,
        removeItem,
        handleSaveProfile,
        processOrder,
        createTailorOrder,
        handleMeasurementKeyDown,
        subtotalBeforeDiscount,
        vat,
        total,
        balance,
        orderPayload,
        isUrgent,
        setIsUrgent,
        urgentFee,
        setUrgentFee,
        isGift,
        setIsGift,
        recipientName,
        setRecipientName,
        recipientPhone,
        setRecipientPhone
    };
}
