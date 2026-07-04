const db = require('../electron/database.cjs');
const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const cryptoMod = require('crypto');

const baseInvoice = {
    invoice: `COMPLY-${Date.now()}`,
    timestamp: new Date().toISOString(),
    total: '115.00',
    items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    seller: 'Company',
    vatNo: '300000000000003',
    vatRate: 0.15,
    address: {
        street: 'شارع',
        building: '1111',
        district: 'حي',
        city: 'الرياض',
        postal: '12345',
        additional_street: '',
        country: 'SA'
    }
};

const xml = generateUBL21XML({
    ...baseInvoice,
    uuid: cryptoMod.randomUUID(),
    prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    icv: 1,
});

const fs = require('fs');
fs.writeFileSync('scratch/dumped.xml', xml);
console.log("Wrote scratch/dumped.xml");
