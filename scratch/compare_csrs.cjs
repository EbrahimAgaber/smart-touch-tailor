const fs = require('fs');
const forge = require('node-forge');

function parseAndDump(filePath) {
    console.log(`\nDumping structure of ${filePath}:`);
    const csrPem = fs.readFileSync(filePath, 'utf8');
    
    // Decode base64 to bytes
    const cleanBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n]/g, '')
        .trim();
    const bytes = Buffer.from(cleanBase64, 'base64');
    
    const asn1 = forge.asn1.fromDer(bytes.toString('binary'));
    console.log(JSON.stringify(asn1, null, 2).substring(0, 1500));
}

try {
    parseAndDump('scratch/sdk_csr.csr');
    parseAndDump('scratch/csr.pem');
} catch (err) {
    console.error(err);
}
