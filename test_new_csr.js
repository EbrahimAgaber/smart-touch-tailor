const db = require('./electron/database.cjs');
db.initDatabase(__dirname);

const crypto = require('crypto');
const zatcaPhase2 = require('./electron/zatca_phase2_impl.cjs');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
});

const finalInfo = {
    UID: '300000000000003',
    EGS_SN: 'POS-01',
    ORG: 'مؤسسة اختبار', // Arabic test
    title: '1100',
    address: 'الرياض', // Arabic test
    IND: 'Retail',
    env: 'sandbox'
};

const result = zatcaPhase2.generateCSR(privateKey, publicKey, finalInfo);
console.log('CSR base64 length:', result.csrBase64.length);
console.log('CSR Base64:\n', result.csrBase64);
