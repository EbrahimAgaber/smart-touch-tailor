const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const zatcaPhase2 = require('../electron/zatca_phase2.cjs');
const db = require('../electron/database.cjs');
const fs = require('fs');

db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);

const xml = generateUBL21XML({
    invoice: '123', timestamp: '2026-01-01T00:00:00Z', total: 100, items: [], seller: 'S', vatNo: '300000000000003', vatRate: 0.15,
    address: { street: 's', building: '1', district: 'd', city: 'c', postal: '1', country: 'SA' },
    uuid: '123', prevHash: '123', icv: 1
});

const token = compCsid.binarySecurityToken || '';
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

const { envelope } = zatcaPhase2.signInvoiceXML(
    xml, device.private_key_pem, compCertPem, '2026-01-01T00:00:00Z'
);

const signedXml = xml.replace(
    /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/,
    envelope
);

const canonical1 = zatcaPhase2.canonicalizeInvoiceXML(xml);
const canonical2 = zatcaPhase2.canonicalizeInvoiceXML(signedXml);

fs.writeFileSync('scratch/c14n1.xml', canonical1);
fs.writeFileSync('scratch/c14n2.xml', canonical2);
console.log("Wrote c14n1.xml and c14n2.xml");
