const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const zatcaPhase2 = require('../electron/zatca_phase2.cjs');
const db = require('../electron/database.cjs');
const crypto = require('crypto');

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

const { envelope, invoiceHashBase64 } = zatcaPhase2.signInvoiceXML(
    xml, device.private_key_pem, compCertPem, '2026-01-01T00:00:00Z'
);

const signedXml = xml.replace(
    /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/,
    envelope
);

const canonical1 = zatcaPhase2.canonicalizeInvoiceXML(xml);
const hash1 = crypto.createHash('sha256').update(Buffer.from(canonical1, 'utf8')).digest('base64');

const canonical2 = zatcaPhase2.canonicalizeInvoiceXML(signedXml);
const hash2 = crypto.createHash('sha256').update(Buffer.from(canonical2, 'utf8')).digest('base64');

console.log("hashXML inside signInvoiceXML:", invoiceHashBase64);
console.log("hash of xml:", hash1);
console.log("hash of signedXml:", hash2);
console.log("Match?", invoiceHashBase64 === hash2);
