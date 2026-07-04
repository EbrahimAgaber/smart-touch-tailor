const { app } = require('electron');
app.whenReady().then(() => {
    const Database = require('better-sqlite3');
    const path = require('path');
    const crypto = require('crypto');
    const forge = require('node-forge');

    const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
    const db = new Database(dbPath, { readonly: true });
    const device = db.prepare('SELECT private_key_pem, production_cert_pem FROM zatca_device LIMIT 1').get();
    db.close();

    try {
        // Extract public key from private key
        const privateKey = forge.pki.privateKeyFromPem(device.private_key_pem);
        const publicKeyFromPrivate = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e); // wait, it's ECDSA!
    } catch(e) {} // forge ECDSA handling is tricky, use crypto instead

    const verify = crypto.createVerify('SHA256');
    verify.update('test data');
    const signature = crypto.createSign('SHA256').update('test data').sign(device.private_key_pem);

    let cleanB64 = device.production_cert_pem
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/[\r\n\s]/g, '');
    const derBuf = Buffer.from(cleanB64, 'base64');
    if (derBuf[0] !== 0x30) {
        cleanB64 = derBuf.toString('utf8').trim()
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/[\r\n\s]/g, '');
    }
    const certPem = `-----BEGIN CERTIFICATE-----\n${cleanB64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;

    const isMatch = crypto.createVerify('SHA256').update('test data').verify(certPem, signature);
    console.log('Does the DB Private Key match the DB Certificate (CSID)?', isMatch);
    
    app.quit();
});
