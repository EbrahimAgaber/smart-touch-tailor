const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);

const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const zatcaPhase2 = require('../electron/zatca_phase2.cjs');

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
    uuid: require('crypto').randomUUID(),
    prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    icv: 1,
});

const token = compCsid.binarySecurityToken || '';
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

const { envelope, invoiceHashBase64 } = zatcaPhase2.signInvoiceXML(
    xml, device.private_key_pem, compCertPem, baseInvoice.timestamp
);

const signedXml = xml.replace(
    /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/,
    envelope
);

require('fs').writeFileSync('scratch/signed_dump.xml', signedXml);
console.log("Wrote signed XML to scratch/signed_dump.xml");
