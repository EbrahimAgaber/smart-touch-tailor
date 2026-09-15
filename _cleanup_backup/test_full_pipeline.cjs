const { generateUBL21XML } = require('./electron/zatca_utils.cjs');
const zatca = require('./electron/zatca_phase2_impl.cjs');
const fs = require('fs');

try {
    const keys = zatca.generateDeviceKeyPair();
    
    // Create a dummy certificate for testing (if the library allows)
    // Actually, signInvoiceXML needs a certificate. If the device doesn't have one, it fails.
    // Let's generate a CSR and maybe use a dummy cert, or use the dev certs in the folder.
    // We have sandbox-key.pem and sandbox-csr.pem, maybe compliance_invoice.pdf etc.
    // Let's see if there is a cert.pem
} catch(e) {
    console.error(e);
}
