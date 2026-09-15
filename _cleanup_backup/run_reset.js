const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
app.whenReady().then(() => {
    const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
    const db = new Database(dbPath);
    db.prepare('UPDATE zatca_device SET production_csid = NULL, compliance_csid = NULL, onboarding_complete = 0').run();
    console.log('RESET DONE.');
    app.quit();
});
