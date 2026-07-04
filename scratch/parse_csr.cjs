const forge = require('node-forge');
const fs = require('fs');

try {
    // We can read the CSR from the DB or write a small script that exports the CSR to a file,
    // but we can also just run Python to write the CSR to a file first.
    // Let's assume scratch/csr.pem contains the CSR. We will write a python script to export the CSR from DB to scratch/csr.pem.
    const csrPem = fs.readFileSync('scratch/csr.pem', 'utf8');
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    
    console.log('Subject DN:');
    csr.subject.attributes.forEach(attr => {
        console.log(`  ${attr.name} (${attr.type}): ${attr.value}`);
    });
    
    console.log('\nExtensions:');
    csr.getAttribute({name: 'extensionRequest'}).extensions.forEach(ext => {
        console.log(`  ${ext.name} (OID: ${ext.id})`);
        if (ext.value) {
            console.log(`    Value:`, ext.value);
        }
    });
} catch (err) {
    console.error('Error parsing CSR:', err);
}
