const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'pos_data.db');
console.log('Using DB at:', dbPath);
try {
    const db = new Database(dbPath);
    db.prepare('DELETE FROM zatca_queue').run();
    console.log('Cleared zatca_queue');
    db.prepare("UPDATE sales SET zatca_status = 'pending' WHERE zatca_status != 'pending'").run();
    console.log('Reset sales zatca_status to pending');
} catch (e) {
    console.error('Error clearing DB:', e);
}
