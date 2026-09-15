const db = require('./electron/database.cjs');
db.initDatabase('C:\\Users\\bin-g\\AppData\\Roaming\\smart-touch-pos');
try {
    const dev = db.getZatcaDevice();
    console.log("Device:", dev);
    const schema = db.__db ? db.__db.prepare('PRAGMA table_info(zatca_device)').all() : db.db.prepare('PRAGMA table_info(zatca_device)').all();
    console.log("Schema:", schema.map(s => s.name).join(', '));
} catch (e) {
    console.error(e);
}
