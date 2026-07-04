const db = require('./electron/database.cjs');
const path = require('path');
const os = require('os');
db.initDatabase(path.join(process.env.APPDATA, 'البصمة الذكية'));
const database = db.getDbInstance();

console.log('Cleaning up stuck invoices...');

// Mark stuck failed invoices as 'retry_exhausted' so they stop blocking the queue
const info = database.prepare("UPDATE zatca_queue SET status = 'retry_exhausted' WHERE status IN ('pending', 'failed')").run();
console.log(`Cleared ${info.changes} stuck invoices from ZATCA queue.`);

// Un-halt the queue
try {
    database.prepare("UPDATE business_settings SET zatca_queue_halted = 0").run();
    console.log('Queue un-halted.');
} catch (e) {
    console.log('Queue was not halted or column does not exist.');
}

console.log('Done! You can now safely restart the app and make a new sale.');
