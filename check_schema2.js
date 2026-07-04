const db = require('./electron/database.cjs');
db.initDatabase(__dirname);
try {
    const dev = db.getZatcaDevice();
    console.log("Device has current_icv?", dev && 'current_icv' in dev);
    console.log(dev);
} catch (e) {
    console.error(e);
}
