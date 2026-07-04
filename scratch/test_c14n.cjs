const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const { canonicalizeInvoiceXML } = require('../electron/zatca_phase2.cjs');
const fs = require('fs');

const xml = generateUBL21XML({
    invoice: '123', timestamp: '2026-01-01T00:00:00Z', total: 100, items: [], seller: 'S', vatNo: '300000000000003', vatRate: 0.15,
    address: { street: 's', building: '1', district: 'd', city: 'c', postal: '1', country: 'SA' },
    uuid: '123', prevHash: '123', icv: 1
});

try {
    const canonical = canonicalizeInvoiceXML(xml);
    fs.writeFileSync('scratch/c14n_out.xml', canonical);
    console.log("Wrote canonical XML to scratch/c14n_out.xml");
} catch(e) {
    console.error(e);
}
