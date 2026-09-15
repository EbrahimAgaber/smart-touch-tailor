const path = require('path');

try {
    // Hardcode the absolute path directly using your actual Windows username 'bin-g'
    const dbPath = "C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db";
    console.log('Targeting Exact Absolute Path:', dbPath);

    const Database = require(path.join(process.cwd(), 'node_modules', 'better-sqlite3'));
    const db = new Database(dbPath, { fileMustExist: true });

    db.prepare("UPDATE settings SET value = '0' WHERE key = 'zatca_queue_halted'").run();
    db.prepare("DELETE FROM invoices WHERE invoice_number = 'INV-1782661735569'").run();
    db.prepare("UPDATE settings SET value = '0' WHERE key = 'zatca_last_icv'").run();
    db.prepare("UPDATE settings SET value = 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==' WHERE key = 'zatca_