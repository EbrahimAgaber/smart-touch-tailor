const { app } = require('electron');
app.whenReady().then(() => {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
    const db = new Database(dbPath, { readonly: true });
    const device = db.prepare('SELECT private_key_pem FROM zatca_device LIMIT 1').get();
    db.close();
    
    fs.writeFileSync('db_key.pem', device.private_key_pem, 'utf8');
    app.quit();
});
