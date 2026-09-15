const db = require('./electron/database.cjs');
db.initDatabase(__dirname);
try {
    const rows = db.__db.prepare('PRAGMA table_info(zatca_device)').all();
    console.log(rows.map(r => r.name).join(', '));
} catch (e) {
    try {
        const rows = db.db.prepare('PRAGMA table_info(zatca_device)').all();
        console.log(rows.map(r => r.name).join(', '));
    } catch (e2) {
        console.log("Could not access raw DB instance");
    }
}
