const fs = require('fs');

const dbPath = 'electron/database.cjs';
let dbContent = fs.readFileSync(dbPath, 'utf8');
dbContent = dbContent.replace(/const\s+zatca\s*=\s*require\(['"]\.\/zatca_phase2\.cjs['"]\);/g, '');
fs.writeFileSync(dbPath, dbContent, 'utf8');

const utilsPath = 'electron/zatca_utils.cjs';
let utilsContent = fs.readFileSync(utilsPath, 'utf8');
utilsContent = utilsContent.replace(/const\s+\{\s*signInvoiceXML.*?\}\s*=\s*require\(['"]\.\/zatca_phase2\.cjs['"]\);/g, '');
utilsContent = utilsContent.replace(/const\s+zatca_phase2\s*=\s*require\(['"]\.\/zatca_phase2\.cjs['"]\);/g, '');
fs.writeFileSync(utilsPath, utilsContent, 'utf8');
console.log('Removed remnants');
