const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');

const certPem = fs.readFileSync('zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/cert.pem', 'utf8').trim();

try {
    const x509 = new crypto.X509Certificate(`-----BEGIN CERTIFICATE-----\n${certPem}\n-----END CERTIFICATE-----`);
    console.log("X509 loaded natively!");
    const pubKeyPem = x509.publicKey.export({ type: 'spki', format: 'pem' });
    console.log("PubKey:\n", pubKeyPem.substring(0, 80));
    
    // Parse using forge ASN1
    const certDer = x509.raw;
    const obj = forge.asn1.fromDer(forge.util.createBuffer(certDer.toString('binary')));
    const signatureValueAsn1 = obj.value[2];
    const sigRaw = signatureValueAsn1.value;

    if (Array.isArray(sigRaw) && sigRaw.length > 0) {
        // node-forge parsed the BIT STRING payload as ASN.1
        const sigBytes = forge.asn1.toDer(sigRaw[0]).getBytes();
        console.log("Sig Base64:", Buffer.from(sigBytes, 'binary').toString('base64'));
    } else if (typeof sigRaw === 'string') {
        // not parsed
        const sigBytes = sigRaw.substring(1);
        console.log("Sig Base64:", Buffer.from(sigBytes, 'binary').toString('base64'));
    }

} catch(e) {
    console.error(e);
}
