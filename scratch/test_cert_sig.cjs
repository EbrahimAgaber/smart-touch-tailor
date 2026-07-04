const { extractCertDetails } = require('../electron/zatca_phase2.cjs');
const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
const certPem = '-----BEGIN CERTIFICATE-----\n' + (innerBase64.match(/.{1,64}/g) || []).join('\n') + '\n-----END CERTIFICATE-----';

const { certSignature } = extractCertDetails(certPem);
console.log("certSignature (base64):", certSignature);
console.log("Is valid base64?", Buffer.from(certSignature, 'base64').toString('base64') === certSignature);
