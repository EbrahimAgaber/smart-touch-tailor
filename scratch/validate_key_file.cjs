const crypto = require('crypto');
const fs = require('fs');

try {
    const pkey = fs.readFileSync('scratch/privkey.pem', 'utf8');
    console.log('Loaded PEM. Checking if it is valid secp256k1 private key...');

    const privKey = crypto.createPrivateKey(pkey);
    const pubKey = crypto.createPublicKey(privKey);
    const pubPem = pubKey.export({ type: 'spki', format: 'pem' });
    console.log('Public key exported successfully:\n', pubPem);

    const sign = crypto.createSign('SHA256');
    sign.update('test data');
    const signature = sign.sign(privKey);
    console.log('Signature length:', signature.length);

    const verify = crypto.createVerify('SHA256');
    verify.update('test data');
    const verified = verify.verify(pubKey, signature);
    console.log('Signature verification result (should be true):', verified);

} catch (err) {
    console.error('Error:', err);
}
