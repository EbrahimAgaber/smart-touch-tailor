const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const cryptoMod = require('crypto');

const settings = {
    business_name_ar: 'Test Business',
    vat_number: '300000000000003',
    address_street: 'شارع',
    address_building: '1111',
    address_district: 'حي',
    address_city: 'الرياض',
    address_postal: '12345',
    address_country: 'SA'
};

const ts = new Date().toISOString();
const baseInvoice = {
    invoice: `COMPLY-${Date.now()}`,
    timestamp: ts,
    total: '115.00',
    items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    seller: settings.business_name_ar,
    vatNo: settings.vat_number,
    vatRate: 0.15,
    address: {
        street: settings.address_street || settings.street || 'شارع',
        building: settings.address_building || settings.building || '1111',
        district: settings.address_district || settings.district || 'حي',
        city: settings.address_city || settings.city || 'الرياض',
        postal: settings.address_postal || settings.postal || '12345',
        additional_street: settings.address_additional_street || '',
        country: settings.address_country || settings.country || 'SA'
    }
};

const invoiceData = {
    ...baseInvoice,
    invoice: `COMPLY-B2B-${Date.now()}`,
    subtype: '0100000',
    buyer: { vatNo: '300000000000003', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
};

const uuid = cryptoMod.randomUUID();
const xml = generateUBL21XML({
    ...invoiceData,
    uuid,
    prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    icv: 1,
});

require('fs').writeFileSync('temp_b2b_checklist.xml', xml);
console.log('XML saved to temp_b2b_checklist.xml');
