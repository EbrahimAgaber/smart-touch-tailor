const { app } = require('electron');
app.whenReady().then(async () => {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');

    const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT signed_xml FROM zatca_queue WHERE invoice_number = ?').get('INV-1782939125664');

    if (row) {
        fs.writeFileSync('failed_invoice.xml', row.signed_xml, 'utf8');
        console.log('Saved to failed_invoice.xml');
    } else {
        console.log('Invoice not found in zatca_queue');
    }

    const all = db.prepare('SELECT id, invoice_number, icv, status FROM zatca_queue ORDER BY id DESC LIMIT 5').all();
    console.log('Recent queue items:', JSON.stringify(all));

    db.close();
    app.quit();
});
