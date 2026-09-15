const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { app } = require('electron');

app.whenReady().then(() => {
    const appDataStr = 'البصمة الذكية';
    const dbPath = path.join(process.env.APPDATA, appDataStr, 'pos_data.db');
    const db = new Database(dbPath);
    const res = db.prepare('SELECT * FROM business_settings WHERE key = ?').get('zatca_env');
    console.log('zatca_env is:', res ? res.value : 'MISSING');
    app.quit();
});
