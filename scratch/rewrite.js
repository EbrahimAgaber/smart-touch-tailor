const fs = require('fs');
let content = fs.readFileSync('src/pages/TailorPOS.jsx', 'utf8');

// 1. Phone auto-search
content = content.replace(/const handlePhoneBlur = async \(\) => \{[\s\S]*?\n    \};/, `
    const handlePhoneSearch = async (searchPhone) => {
        if (searchPhone.length >= 10) {
            try {
                const res = await window.api?.getCustomers?.({ search: searchPhone });
                if (res && res.length > 0) {
                    const c = res[0];
                    setCustomer(c);
                    setName(c.name);
                    const profiles = await window.api?.tailor?.getMeasurements?.({ customer_id: c.id });
                    if (profiles && profiles.length > 0) {
                        const sorted = profiles.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                        setLatestProfile(sorted[0]);
                        setProfileLoaded(false);
                        // showToast({ type: 'info', message: 'تم العثور على مقاسات سابقة للعميل' });
                    } else {
                        setLatestProfile(null);
                    }
                } else {
                    setCustomer(null);
                    setLatestProfile(null);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            setCustomer(null);
            setLatestProfile(null);
        }
    };

    useEffect(() => {
        handlePhoneSearch(phone);
    }, [phone]);
`);

// 2. Clone Piece logic
content = content.replace(/const addItem = \(\) => \{/, `
    const cloneItem = () => {
        const newItem = JSON.parse(JSON.stringify(items[activeItemIndex]));
        newItem.id = items.length + 1;
        setItems([...items, newItem]);
        setActiveItemIndex(items.length);
    };

    const addItem = () => {`);

// 3. Remove onBlur
content = content.replace(/onBlur=\{handlePhoneBlur\}/g, '');

// 4. Change Add piece button to include Clone Piece
content = content.replace(/<button className="btn-add-item" onClick=\{addItem\}>\+ إضافة قطعة<\/button>/, `
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button className="btn-add-item" onClick={addItem}>+ إضافة قطعة</button>
                            <button className="btn-add-item" onClick={cloneItem} style={{background: 'var(--primary)', color: '#fff', border: '1px solid var(--border-color)'}}>⧉ تكرار القطعة</button>
                        </div>
`);

// 5. Add Split Payment state
content = content.replace(/const \[paymentMethod, setPaymentMethod\] = useState\('Cash'\);/, `const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [splitCash, setSplitCash] = useState('');
    const [splitCard, setSplitCard] = useState('');

    useEffect(() => {
        if (paymentMethod === 'Split') {
            const c = parseFloat(splitCash) || 0;
            const r = Math.max(0, (parseFloat(paid) || 0) - c);
            setSplitCard(r.toFixed(2));
        }
    }, [splitCash, paid, paymentMethod]);

    const setDeliveryDays = (days) => {
        const dDate = new Date();
        dDate.setDate(dDate.getDate() + days);
        setDeliveryDate(dDate.toISOString().split('T')[0]);
    };
`);

// 6. Fix grid layout DOM structure (Customer first, then Measurements, then Checkout)
// I will extract the sections.
const rightColRegex = /<section className="pos-col preview-col print:block">([\s\S]*?)<\/section>/;
const middleColRegex = /<section className="pos-col print:hidden">[\s]*<div className="section-title">\s*<div style=\{\{ display: 'flex', alignItems: 'center', gap: '0.5rem' \}\}>[\s\S]*?<\/textarea>\n                    <\/div>\n                <\/section>/;
const leftColRegex = /<section className="pos-col print:hidden">\s*<div className="section-title">\s*<span>بيانات العميل<\/span>[\s\S]*?<\/section>/;

const rightColMatch = content.match(rightColRegex);
const middleColMatch = content.match(middleColRegex);
const leftColMatch = content.match(leftColRegex);

if (!rightColMatch || !middleColMatch || !leftColMatch) {
    console.error("Could not find sections");
    console.log("R", !!rightColMatch);
    console.log("M", !!middleColMatch);
    console.log("L", !!leftColMatch);
} else {
    const previewHtml = rightColMatch[1];
    let measurementsHtml = middleColMatch[0];
    let customerCheckoutHtml = leftColMatch[0];

    // split customer and checkout
    const customerCheckoutSplit = customerCheckoutHtml.split(/<div className="section-title" style=\{\{ marginTop: '0.5rem' \}\}>\s*<span>الحساب والدفع<\/span>\s*<\/div>/);
    let customerHtml = customerCheckoutSplit[0].replace(/<section className="pos-col print:hidden">/, '<section className="pos-col print:hidden" style={{ order: 3 }}>');
    // Actually, in RTL, standard DOM order:
    // element 1: right
    // element 2: middle
    // element 3: left
    
    // We want element 1 to be Customer Info.
    customerHtml = customerHtml.replace('<section className="pos-col print:hidden" style={{ order: 3 }}>', '<section className="pos-col print:hidden">');
    // Also inject delivery quick buttons
    customerHtml = customerHtml.replace(/<input type="date" value=\{deliveryDate\} onChange=\{e => setDeliveryDate\(e\.target\.value\)\} \/>/, \`
                        <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button type="button" onClick={() => setDeliveryDays(3)} className="btn-pay" style={{flex: 1, padding: '0.25rem'}}>3 أيام</button>
                            <button type="button" onClick={() => setDeliveryDays(7)} className="btn-pay" style={{flex: 1, padding: '0.25rem'}}>7 أيام</button>
                            <button type="button" onClick={() => setDeliveryDays(10)} className="btn-pay" style={{flex: 1, padding: '0.25rem'}}>10 أيام</button>
                        </div>
\`);

    let checkoutHtml = '<div className="section-title" style={{ marginTop: "0.5rem" }}><span>الحساب والدفع</span></div>' + customerCheckoutSplit[1];
    
    // add split payment inputs
    checkoutHtml = checkoutHtml.replace(/<\/div>\n\s*<button className="btn-save"/, \`
                        </div>
                        {paymentMethod === 'Split' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div>
                                    <label>نقدي (Cash)</label>
                                    <input type="number" value={splitCash} onChange={e => setSplitCash(e.target.value)} dir="ltr" />
                                </div>
                                <div>
                                    <label>شبكة (Card)</label>
                                    <input type="number" value={splitCard} readOnly dir="ltr" style={{background: '#f8fafc'}} />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button className="btn-save"\`);

    // combine checkout and preview into one column
    let leftColHtml = \`
                {/* Left Column: Checkout & Preview (Renders Left in RTL) */}
                <section className="pos-col">
                    \${checkoutHtml.replace('</section>', '')}
                    <div className="section-title" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>معاينة مباشرة لشكل ورقة الطباعة</span>
                        <button onClick={() => window.print()} style={{ background: 'var(--border-focus)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            طباعة المسودة
                        </button>
                    </div>
                    \${previewHtml.replace(/<div className="section-title"[\s\S]*?<\/div>/, '')}
                </section>
\`;

    let customerColHtml = \`
                {/* Right Column: Customer & Meta (Renders Right in RTL) */}
                \${customerHtml}
                </section>
\`;

    let middleColHtml = \`
                {/* Middle Column: Measurements */}
                \${measurementsHtml}
\`;

    const oldMainRegex = /<main className="pos-container">[\s\S]*?<\/main>/;
    
    content = content.replace(oldMainRegex, \`
            <main className="pos-container">
\${customerColHtml}
\${middleColHtml}
\${leftColHtml}
            </main>
\`);

    fs.writeFileSync('src/pages/TailorPOS.jsx', content);
    console.log("Successfully rewrote TailorPOS.jsx layout");
}
