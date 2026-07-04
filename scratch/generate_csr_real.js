const { generateCSR } = require('../electron/zatca_phase2_impl.cjs');
const fs = require('fs');

try {
    const finalInfo = {
        EGS_SN: '1-TST|2-TST|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
        UID: '399999999900003',
        title: '1100',
        address: 'RRRD2929',
        IND: 'Supply activities',
        CN: 'TST-886431145-399999999900003',
        OU: 'Riyadh Branch',
        ORG: 'Maximum Speed Tech Supply LTD',
        env: 'sandbox'
    };
    
    // Try with Arabic text
    const finalInfoArabic = {
        ...finalInfo,
        ORG: 'البصمة الذكية'
    };

    console.log("Generating CSR with English...");
    generateCSR('dummy', 'dummy', finalInfo);
    console.log("English OK");

    console.log("Generating CSR with Arabic...");
    generateCSR('dummy', 'dummy', finalInfoArabic);
    console.log("Arabic OK");

} catch(e) {
    console.log(e.stack || e);
}
