const fs = require('fs');

const dbPath = 'c:\\my-pos\\v2\\electron\\database.cjs';
let content = fs.readFileSync(dbPath, 'utf8');

const oldTableDeviceStr = `    db.exec(\`
        CREATE TABLE IF NOT EXISTS zatca_device (
            id INTEGER PRIMARY KEY DEFAULT 1,
            private_key TEXT NOT NULL,
            csr TEXT NOT NULL,
            compliance_csid TEXT,
            compliance_rid TEXT,
            production_csid TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    \`);`;

const oldTableQueueStr = `    db.exec(\`
        CREATE TABLE IF NOT EXISTS zatca_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL,
            icv INTEGER NOT NULL,
            uuid TEXT NOT NULL,
            signed_xml TEXT NOT NULL,
            xml_hash TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            zatca_response_json TEXT,
            attempts INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        );
    \`);`;

const newTablesStr = `    db.exec(\`
        CREATE TABLE IF NOT EXISTS zatca_device (
            id INTEGER PRIMARY KEY DEFAULT 1,
            private_key TEXT NOT NULL,
            csr TEXT NOT NULL,
            compliance_csid TEXT,
            compliance_rid TEXT,
            production_csid TEXT,
            environment TEXT NOT NULL DEFAULT 'sandbox',
            onboarding_complete INTEGER NOT NULL DEFAULT 0
        );
    \`);

    db.exec(\`
        CREATE TABLE IF NOT EXISTS zatca_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icv INTEGER NOT NULL UNIQUE,
            invoice_hash TEXT NOT NULL,
            pih TEXT NOT NULL,
            invoice_uuid TEXT NOT NULL UNIQUE,
            invoice_type TEXT NOT NULL,
            submission_status TEXT NOT NULL DEFAULT 'pending',
            zatca_response TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    \`);`;

content = content.replace(oldTableDeviceStr, '');
content = content.replace(oldTableQueueStr, newTablesStr);
// Need to handle both \n and \r\n
const oldTableDeviceRegex = /db\.exec\(`[\s\n\r]*CREATE TABLE IF NOT EXISTS zatca_device[\s\S]*?\);[\s\n\r]*`\);/m;
const oldTableQueueRegex = /db\.exec\(`[\s\n\r]*CREATE TABLE IF NOT EXISTS zatca_queue[\s\S]*?\);[\s\n\r]*`\);/m;

content = content.replace(oldTableDeviceRegex, '');
content = content.replace(oldTableQueueRegex, newTablesStr);


fs.writeFileSync(dbPath, content, 'utf8');
console.log("Replaced tables in database.cjs");
