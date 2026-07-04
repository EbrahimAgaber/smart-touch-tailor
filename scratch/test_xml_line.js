const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const fs = require('fs');

const address = {
    street:   'شارع الملك',
    building: '1234',
    district: 'الصحافة',
    city:     'الرياض',
    postal:   '12345',
    country:  'SA',
};

const baseInvoice = {
    invoice: `COMPLY-${Date.now()}`,
    timestamp: new Date().toISOString(),
    total: '115.00',
    items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    seller: 'Test Seller',
    vatNo: '399999999900003',
    vatRate: 0.15,
    address,
    icv: 1,
    uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    prevHash: 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==',
};

const xml = generateUBL21XML(baseInvoice);
const lines = xml.split('\n');
console.log("Total lines:", lines.length);
lines.forEach((line, idx) => {
    console.log(`${idx + 1}: ${line}`);
});
