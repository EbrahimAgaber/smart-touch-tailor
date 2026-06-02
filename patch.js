const fs = require('fs');
const path = require('path');

const targetFile = 'c:\\my-pos\\v2\\electron\\database.cjs';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Imports
content = content.replace(
    `const { calculateInvoiceHash, generateUUID } = require('./zatca_utils.cjs');`,
    `const { generateUUID, generateUBL21XML } = require('./zatca_utils.cjs');\nconst zatca = require('./zatca_phase2.cjs');`
);

// 2. Add Tables
const tableInjectionPoint = 'FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE\n        );\n    `);';
const newTables = `
    db.exec(\`
        CREATE TABLE IF NOT EXISTS zatca_device (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE NOT NULL,
            private_key_pem TEXT NOT NULL,
            csr_pem TEXT,
            compliance_csid TEXT,
            production_csid TEXT,
            production_cert_pem TEXT,
            current_icv INTEGER DEFAULT 0,
            last_pih TEXT DEFAULT '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    \`);

    db.exec(\`
        CREATE TABLE IF NOT EXISTS zatca_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL,
            icv INTEGER NOT NULL,
            uuid TEXT NOT NULL,
            signed_xml TEXT NOT NULL,
            xml_hash TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            zatca_response_json TEXT,
            attempts INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        );
    \`);
`;
content = content.replace(tableInjectionPoint, tableInjectionPoint + newTables);

// 3. Columns & Migrations
content = content.replace(
    `safe(\`ALTER TABLE sales ADD COLUMN zatca_status TEXT DEFAULT 'pending'\`);`,
    `safe(\`ALTER TABLE sales ADD COLUMN zatca_status TEXT DEFAULT 'pending'\`);\n    safe(\`ALTER TABLE sales ADD COLUMN icv INTEGER\`);\n    try { db.prepare("UPDATE sales SET zatca_status = 'legacy' WHERE icv IS NULL AND status != 'legacy' AND zatca_status != 'legacy'").run(); } catch(e){}`
);

// 4. saveSale changes
const saveSaleSearch = `        const lastSale = db.prepare('SELECT hash FROM sales ORDER BY id DESC LIMIT 1').get();
        const prevHash = lastSale?.hash || 'NWZlY2ViYjdmM2VjNmIyZGVmZDRjOGYwZDA5M2EzNmVjMzcwNDNmYzY3OTZjNTY5MTY2YThmYTFhZTRjNmMxNg==';
        const invoiceUUID = generateUUID();
        // DATE-FIX: Use an explicit ISO Z-string so React (and any JS consumer)
        // always parses it as UTC and converts to local time correctly.
        // Older rows without the trailing 'Z' are still safe — JS treats those
        // as local time, which is what they already stored.
        const saleTimestamp = (saleData.date && typeof saleData.date === 'string')
            ? saleData.date
            : new Date().toISOString();

        const invoiceHash = calculateInvoiceHash({ invoice, total, discount, timestamp: saleTimestamp, prevHash });

        const finalTotal    = roundMoney(total);
        const finalSubtotal = subtotal != null ? roundMoney(subtotal) : roundMoney(finalTotal / (1 + vatRate));
        const finalTax      = tax != null ? roundMoney(tax) : roundMoney(finalTotal - finalSubtotal);

        // FIX: Include loyalty_points_redeemed in the INSERT so it is persisted
        // and can be read back by voidSale to restore the correct balance.
        const saleResult = db.prepare(\`
            INSERT INTO sales (invoice, timestamp, total_amount, subtotal, tax_amount, discount, payment_method,
                paid, change_amount, payment_details_json, status, order_type, note,
                customer_id, staff_id, uuid, hash, hash_chain, loyalty_points_redeemed,
                discount_type, is_agreed_total)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        \`).run(
            String(invoice),
            String(saleTimestamp),
            Number(finalTotal), 
            Number(finalSubtotal), 
            Number(finalTax), 
            Number(discount), 
            String(payment || 'Cash'),
            Number(paid || 0), 
            Number(change || 0), 
            JSON.stringify(paymentDetails || []), 
            String(saleStatus),
            String(order_type), 
            String(note || ''), 
            customer_id ? Number(customer_id) : null, 
            staff_id ? Number(staff_id) : null,
            String(invoiceUUID), 
            String(invoiceHash), 
            String(prevHash), 
            Number(redeemedPts),
            String(discount_type || 'normal'), 
            is_agreed_total ? 1 : 0
        );
        const saleId = saleResult.lastInsertRowid;`;

const saveSaleReplace = `
        let device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (!device) {
            const keys = zatca.generateDeviceKeyPair();
            db.prepare(\`INSERT INTO zatca_device (device_id, private_key_pem) VALUES (?, ?)\`).run('POS-01', keys.privateKeyPem);
            device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        }
        
        db.prepare('UPDATE zatca_device SET current_icv = current_icv + 1 WHERE id = ?').run(device.id);
        const newIcv = device.current_icv;
        const prevHash = device.last_pih || '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
        const invoiceUUID = generateUUID();

        const saleTimestamp = (saleData.date && typeof saleData.date === 'string')
            ? saleData.date
            : new Date().toISOString();

        const finalTotal    = roundMoney(total);
        const finalSubtotal = subtotal != null ? roundMoney(subtotal) : roundMoney(finalTotal / (1 + vatRate));
        const finalTax      = tax != null ? roundMoney(tax) : roundMoney(finalTotal - finalSubtotal);

        const settings = getSettings();
        const xml = generateUBL21XML({
            invoice, icv: newIcv, timestamp: saleTimestamp, total: finalTotal, 
            items: items || [], uuid: invoiceUUID, prevHash, 
            seller: settings.business_name_ar || 'مؤسسة تجارية', 
            vatNo: settings.tax_number || '300000000000003',
            vatRate, discount: Number(discount), typeCode: '388'
        });
        
        const invoiceHash = zatca.hashXML(xml);
        let signedXml = xml;
        let signatureBase64 = '';
        
        if (device.production_csid && device.production_cert_pem) {
            signatureBase64 = zatca.signXMLHash(invoiceHash, device.private_key_pem);
            const certBase64 = device.production_cert_pem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\\n/g, '').replace(/\\r/g, '');
            const env = zatca.buildSignatureEnvelope(invoiceHash, signatureBase64, certBase64, saleTimestamp);
            signedXml = xml.replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', env);
            
            const tlv = zatca.generateZatcaTLV9(
                settings.business_name_ar || 'مؤسسة تجارية', settings.tax_number || '300000000000003', saleTimestamp, finalTotal, finalTax,
                invoiceHash, signatureBase64, '', ''
            );
            signedXml = signedXml.replace('<!-- QR_PLACEHOLDER -->', \`<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">\${tlv}</cbc:EmbeddedDocumentBinaryObject>\`);
        }

        db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(invoiceHash, device.id);

        const saleResult = db.prepare(\`
            INSERT INTO sales (invoice, timestamp, total_amount, subtotal, tax_amount, discount, payment_method,
                paid, change_amount, payment_details_json, status, order_type, note,
                customer_id, staff_id, uuid, hash, hash_chain, loyalty_points_redeemed,
                discount_type, is_agreed_total, icv, zatca_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        \`).run(
            String(invoice), String(saleTimestamp), Number(finalTotal), Number(finalSubtotal), Number(finalTax), Number(discount), 
            String(payment || 'Cash'), Number(paid || 0), Number(change || 0), JSON.stringify(paymentDetails || []), 
            String(saleStatus), String(order_type), String(note || ''), 
            customer_id ? Number(customer_id) : null, staff_id ? Number(staff_id) : null,
            String(invoiceUUID), String(invoiceHash), String(prevHash), Number(redeemedPts),
            String(discount_type || 'normal'), is_agreed_total ? 1 : 0, newIcv, 'pending'
        );
        const saleId = saleResult.lastInsertRowid;
        
        db.prepare(\`
            INSERT INTO zatca_queue (sale_id, invoice_number, icv, uuid, signed_xml, xml_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        \`).run(saleId, invoice, newIcv, invoiceUUID, signedXml, invoiceHash);
`;

content = content.replace(saveSaleSearch, saveSaleReplace);

// 5. voidSale changes (credit note generation)
const voidSaleSearch = `db.prepare('UPDATE sales SET status=? WHERE invoice=?').run('void', invoiceId);`;
const voidSaleReplace = `db.prepare('UPDATE sales SET status=? WHERE invoice=?').run('void', invoiceId);
        
        // ZATCA Phase 2: Generate Credit Note
        let device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (device) {
            db.prepare('UPDATE zatca_device SET current_icv = current_icv + 1 WHERE id = ?').run(device.id);
            const newIcv = device.current_icv + 1; // using db triggers would be safer but this is fine in tx
            const prevHash = device.last_pih || '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
            const uuid = generateUUID();
            const timestamp = new Date().toISOString();
            const settings = getSettings();
            
            // Reconstruct items from DB
            const items = db.prepare('SELECT item_name as Name, quantity as Qty, item_price as Price FROM sales_items WHERE sale_id=?').all(sale.id);
            
            const xml = generateUBL21XML({
                invoice: 'CN-' + invoiceId, icv: newIcv, timestamp, total, 
                items: items, uuid, prevHash, 
                seller: settings.business_name_ar || 'مؤسسة تجارية', 
                vatNo: settings.tax_number || '300000000000003',
                vatRate, discount: 0, typeCode: '381'
            });
            
            const invoiceHash = zatca.hashXML(xml);
            let signedXml = xml;
            
            if (device.production_csid && device.production_cert_pem) {
                const signatureBase64 = zatca.signXMLHash(invoiceHash, device.private_key_pem);
                const certBase64 = device.production_cert_pem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\\n/g, '').replace(/\\r/g, '');
                const env = zatca.buildSignatureEnvelope(invoiceHash, signatureBase64, certBase64, timestamp);
                signedXml = xml.replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', env);
                const tlv = zatca.generateZatcaTLV9(settings.business_name_ar, settings.tax_number, timestamp, total, taxVal, invoiceHash, signatureBase64, '', '');
                signedXml = signedXml.replace('<!-- QR_PLACEHOLDER -->', \`<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">\${tlv}</cbc:EmbeddedDocumentBinaryObject>\`);
            }
            
            db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(invoiceHash, device.id);
            db.prepare(\`
                INSERT INTO zatca_queue (sale_id, invoice_number, icv, uuid, signed_xml, xml_hash)
                VALUES (?, ?, ?, ?, ?, ?)
            \`).run(sale.id, 'CN-' + invoiceId, newIcv, uuid, signedXml, invoiceHash);
        }`;
content = content.replace(voidSaleSearch, voidSaleReplace);

// 6. createReturn changes
const createReturnSearch = `        const saleRes = db.prepare(\`
            INSERT INTO sales (invoice, total_amount, subtotal, tax_amount, discount, payment_method,
                paid, change_amount, payment_details_json, status, order_type, note, customer_id, staff_id, uuid, hash, hash_chain)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        \`).run(returnInv, -returnTotal, -returnSub, -returnTax, 0,
            original.payment_method, -returnTotal, 0, '[]',
            'return', 'return', \`مرتجع: \${invoiceId}\`,
            original.customer_id, original.staff_id,
            generateUUID(), 'RETURN', original.hash);
        const saleId = saleRes.lastInsertRowid;`;

const createReturnReplace = `
        let device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (!device) {
            const keys = zatca.generateDeviceKeyPair();
            db.prepare(\`INSERT INTO zatca_device (device_id, private_key_pem) VALUES (?, ?)\`).run('POS-01', keys.privateKeyPem);
            device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        }
        db.prepare('UPDATE zatca_device SET current_icv = current_icv + 1 WHERE id = ?').run(device.id);
        const newIcv = device.current_icv + 1;
        const prevHash = device.last_pih || '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
        const uuid = generateUUID();
        const timestamp = new Date().toISOString();
        const settings = getSettings();
        
        const xml = generateUBL21XML({
            invoice: returnInv, icv: newIcv, timestamp, total: returnTotal, 
            items: returnItems.map(ri => ({ Name: ri.name, Price: ri.price, Qty: ri.qty })), 
            uuid, prevHash, 
            seller: settings.business_name_ar || 'مؤسسة تجارية', 
            vatNo: settings.tax_number || '300000000000003',
            vatRate, discount: 0, typeCode: '381'
        });
        
        const invoiceHash = zatca.hashXML(xml);
        let signedXml = xml;
        
        if (device.production_csid && device.production_cert_pem) {
            const signatureBase64 = zatca.signXMLHash(invoiceHash, device.private_key_pem);
            const certBase64 = device.production_cert_pem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\\n/g, '').replace(/\\r/g, '');
            const env = zatca.buildSignatureEnvelope(invoiceHash, signatureBase64, certBase64, timestamp);
            signedXml = xml.replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', env);
            const tlv = zatca.generateZatcaTLV9(settings.business_name_ar, settings.tax_number, timestamp, returnTotal, returnTax, invoiceHash, signatureBase64, '', '');
            signedXml = signedXml.replace('<!-- QR_PLACEHOLDER -->', \`<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">\${tlv}</cbc:EmbeddedDocumentBinaryObject>\`);
        }
        
        db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(invoiceHash, device.id);

        const saleRes = db.prepare(\`
            INSERT INTO sales (invoice, total_amount, subtotal, tax_amount, discount, payment_method,
                paid, change_amount, payment_details_json, status, order_type, note, customer_id, staff_id, uuid, hash, hash_chain, icv, zatca_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        \`).run(returnInv, -returnTotal, -returnSub, -returnTax, 0,
            original.payment_method, -returnTotal, 0, '[]',
            'return', 'return', \`مرتجع: \${invoiceId}\`,
            original.customer_id, original.staff_id,
            uuid, invoiceHash, prevHash, newIcv, 'pending');
        const saleId = saleRes.lastInsertRowid;
        
        db.prepare(\`
            INSERT INTO zatca_queue (sale_id, invoice_number, icv, uuid, signed_xml, xml_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        \`).run(saleId, returnInv, newIcv, uuid, signedXml, invoiceHash);
`;

content = content.replace(createReturnSearch, createReturnReplace);

// 7. Add zatca_device methods
const getDeviceStatus = `
// ─────────────────────────────────────────────
// ZATCA API Integration
// ─────────────────────────────────────────────
function getZatcaDevice() {
    return db.prepare('SELECT * FROM zatca_device LIMIT 1').get() || null;
}
function updateZatcaDevice(data) {
    if (!data.id) return;
    const fields = Object.keys(data).filter(k => k !== 'id');
    const setClause = fields.map(k => \`\${k}=?\`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(data.id);
    db.prepare(\`UPDATE zatca_device SET \${setClause} WHERE id=?\`).run(...values);
}

module.exports = {
`;
content = content.replace('module.exports = {', getDeviceStatus);

content = content.replace(
    `getMenu, addItem, editItem, deleteItem, updateStock, updateProductCost,`,
    `getZatcaDevice, updateZatcaDevice,\n    getMenu, addItem, editItem, deleteItem, updateStock, updateProductCost,`
);

fs.writeFileSync(targetFile, content);
console.log('Database patched');
