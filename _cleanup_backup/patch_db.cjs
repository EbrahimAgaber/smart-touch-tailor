const fs = require('fs');
let c = fs.readFileSync('electron/database.cjs', 'utf8');
c = c.replace(
    /CREATE TABLE IF NOT EXISTS zatca_invoices[\s\S]*?\);[\r\n\s]*`\);/,
    match => match + "\n\n    try { db.exec(\"UPDATE sales SET zatca_status = 'legacy' WHERE zatca_status != 'legacy' AND uuid NOT IN (SELECT invoice_uuid FROM zatca_invoices);\"); } catch(e) {}"
);
fs.writeFileSync('electron/database.cjs', c, 'utf8');
console.log('Patched');
