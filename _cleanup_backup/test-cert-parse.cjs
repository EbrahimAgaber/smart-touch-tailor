const { app } = require('electron');
const crypto = require('crypto');

app.whenReady().then(() => {
    console.log('--- TEST RSA CERT ---');
    try {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        // wait, I need a certificate, not a key pair. 
        // I can use node-forge to quickly make a self-signed RSA cert.
        const forge = require('node-forge');
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
        const attrs = [{ name: 'commonName', value: 'test' }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.sign(keys.privateKey, forge.md.sha256.create());
        const rsaPem = forge.pki.certificateToPem(cert);
        
        const x509Rsa = new crypto.X509Certificate(rsaPem);
        console.log('RSA Cert parsed successfully! Serial:', x509Rsa.serialNumber);
    } catch (e) {
        console.error('RSA Cert parse failed:', e.message);
    }

    console.log('\n--- TEST SECP256K1 CERT (ZATCA) ---');
    try {
        const token = "TUlJQ0VEQ0NBYmVnQXdJQkFnSUdBWjhxSlZnWk1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nall3TnpBek1qSTBNVFV6V2hjTk16RXdOekF6TWpFd01EQXdXakJmTVFzd0NRWURWUVFHRXdKVFFURVVNQklHQTFVRUN3d0xTR1ZoWkNCUFptWnBZMlV4SmpBa0JnTlZCQW9NSFUxaGVHbHRkVzBnVTNCbFpXUWdWR1ZqYUNCVGRYQndiSGtnVEZSRU1SSXdFQVlEVlFRRERBbGFRVlJEUVMxRlIxTXdWakFRQmdjcWhrak9QUUlCQmdVcmdRUUFDZ05DQUFTN3lxVC9hTjdnNXgzY0ZuSndTQXdidk5yZ3JiSVFFWXhsZXF0YzlYMzZOTGljMVMyWVB0QjF2S21GRFNxVlAyUHM2alhUUWFXM2I3eHAxdjJydVZFU280R3JNSUdvTUF3R0ExVWRFd0VCL3dRQ01BQXdnWmNHQTFVZEVRU0JqekNCaktTQmlUQ0JoakVrTUNJR0ExVUVCQXdiTVMxVGJXRnlkRlJ2ZFdOb2ZESXRVRTlUZkRNdFVFOVRMVEF4TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXprNU9UazVPVGs1T1RBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SMHdHd1lEVlFRYURCVERtTUtudzVuQ2hNT1l3cm5EbWNLRXc1akNwekVQTUEwR0ExVUVEd3dHVW1WMFlXbHNNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJQlVZMjl5dUJvY2lVUHY3QVB1K1Zhc2lleCtjZ1RkTHh4Uitic0xKb0FxWkFpQXF6MldlSzRzMnJ2bysyTklOenFpb1NBWk1ZWGNEZjlsQnpoNEc0QXV4U2c9PQ==";
        const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
        const secpPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
        
        const x509Secp = new crypto.X509Certificate(secpPem);
        console.log('Secp256k1 Cert parsed successfully! Serial:', x509Secp.serialNumber);
    } catch (e) {
        console.error('Secp256k1 Cert parse failed:', e.message);
    }

    app.quit();
});
