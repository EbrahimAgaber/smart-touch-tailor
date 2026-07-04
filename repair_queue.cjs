const { app } = require('electron');
app.whenReady().then(() => {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
    const db = new Database(dbPath);
    
    // Archive rejected and pending items
    db.prepare(`UPDATE zatca_queue SET status = 'archived_chain_reset_v3' WHERE status IN ('rejected', 'pending', 'processing')`).run();
    
    // Reset ICV sequence
    db.prepare(`UPDATE zatca_device SET current_icv = 0, last_pih = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjZTllZGFhZDVjN2UyOTliYmU5N2I1MzdiYjM3YmRiYjliYg=='`).run();
    
    // Resume queue
    db.prepare(`UPDATE system_settings SET setting_value = 'false' WHERE setting_key = 'zatca_queue_halted'`).run();
    
    console.log('Successfully repaired ZATCA queue and chain.');
    db.close();
    app.quit();
});
