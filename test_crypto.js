const fs = require('fs');
const crypto = require('crypto');
const privPem = fs.readFileSync('tmp_key.pem', 'utf8');
let certPem = fs.readFileSync('tmp_cert.pem', 'utf8');

const b64 = certPem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s/g, '');
certPem = '-----BEGIN CERTIFICATE-----\n' + b64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';


try {
    const pubKey = crypto.createPublicKey(certPem);
    console.log("cert pubkey OK");
} catch(e) {
    console.error("cert pubkey error:", e.message);
}

try {
    const sign = crypto.createSign('SHA256');
    sign.update('hello');
    const sig = sign.sign(privPem);
    console.log("sign OK, sig length:", sig.length);
} catch(e) {
    console.error("sign error:", e.message);
}
