const path = require('path');
const os = require('os');
// Dynamic require matching Electron's actual bundled module injection
try {
    const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'البصمة الذكية', 'pos_data.db');
    const Database = require(path.join(process.cwd(), 'node_modules', 'better-sqlite3'));
    const db = new Database(dbPath);
    
    db.prepare(\"UPDATE settings SET value = '0' WHERE key = 'zatca_queue_halted'\").run();
    db.prepare(\"DELETE FROM invoices WHERE invoice_number = 'INV-1782661735569'\").run();
    db.prepare(\"UPDATE settings SET value = '0' WHERE key = 'zatca_last_icv'\").run();
    db.prepare(\"UPDATE settings SET value = 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==' WHERE key = 'zatca_last_pih'\").run();
    
    console.log('=== [✓] ALL ZATCA SEQUENCE LOCKS REMOVED AND RESET SUCCESSFULLY ===');
    db.close();
} catch (err) {
    console.error('Execution Failed:', err.message);
}
process.exit(0);
