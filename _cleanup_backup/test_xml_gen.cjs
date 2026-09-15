const { generateUBL21XML } = require('./electron/zatca_utils.cjs');

try {
    const xml = generateUBL21XML({
        invoice: 'INV-001',
        icv: 1,
        timestamp: new Date().toISOString(),
        total: 115,
        items: [
            { id: 1, product_name_ar: "مادة تجريبية", quantity: 1, price: 100, tax_rate: 15, tax_amount: 15, total: 115 }
        ],
        uuid: '12345678-1234-1234-1234-123456789012',
        prevHash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
        seller: 'شركة اختبار',
        vatNo: '311111111101113',
        vatRate: 0.15,
        discount: 0,
        typeCode: '388', // 388 = Invoice
        buyer: null, // B2C
        paymentMethod: 'cash',
        crn: '1010010000',
        address: {
            street: 'شارع الملك',
            building: '1234',
            district: 'الرياض',
            city: 'الرياض',
            postal: '12345',
            crn: '1010010000'
        }
    });
    console.log("XML Generated successfully. Length:", xml.length);
    const fs = require('fs');
    fs.writeFileSync('unsigned_test.xml', xml);
} catch(e) {
    console.error("Error:", e);
}
