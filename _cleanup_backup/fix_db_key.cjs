const { app } = require('electron');
app.whenReady().then(() => {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
    const db = new Database(dbPath);
    
    const fatooraKeyPath = path.join(__dirname, 'zatca-einvoicing-sdk-Java-238-R3.4.8', 'Data', 'Certificates', 'ec-secp256k1-priv-key.pem');
    const fatooraKeyBase64 = fs.readFileSync(fatooraKeyPath, 'utf8').trim();
    
    // Convert to proper PEM format if it's just base64
    let properPem = fatooraKeyBase64;
    if (!fatooraKeyBase64.includes('BEGIN')) {
        properPem = `-----BEGIN EC PRIVATE KEY-----\n${fatooraKeyBase64.match(/.{1,64}/g).join('\n')}\n-----END EC PRIVATE KEY-----\n`;
    }
    
    db.prepare('UPDATE zatca_device SET private_key_pem = ?').run(properPem);
    db.close();
    
    console.log('Successfully updated private key in DB to match the Fatoora certificate.');
    app.quit();
});
