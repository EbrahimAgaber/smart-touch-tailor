const forge = require('node-forge');
const crypto = require('crypto');
const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
const certPem = '-----BEGIN CERTIFICATE-----\n' + (innerBase64.match(/.{1,64}/g) || []).join('\n') + '\n-----END CERTIFICATE-----';

try {
    const x509 = new crypto.X509Certificate(certPem);
    const pubPem = x509.publicKey.export({ type: 'spki', format: 'pem' });
    console.log('crypto pubPem length:', pubPem.length);
} catch(e) { console.error('crypto error:', e.message); }

try {
    const cert = forge.pki.certificateFromPem(certPem);
    console.log('Forge pub key parsed!');
} catch(e) { console.error('forge error:', e.message); }
