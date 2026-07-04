const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Standard Node has full crypto support for secp256k1
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'البصمة الذكية');
const dbPath = path.join(userDataPath, 'pos_data.db');
console.log('Connecting to database at:', dbPath);

try {
    const db = new Database(dbPath);
    const row = db.prepare('SELECT private_key_pem FROM zatca_device WHERE id=1').get();
    db.close();

    if (!row || !row.private_key_pem) {
        console.error('No private key found!');
        process.exit(1);
    }

    const pkey = row.private_key_pem;
    console.log('Loaded PEM from DB. Checking if it is valid secp256k1 private key...');

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
