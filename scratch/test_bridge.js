const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BRIDGE_IMPL_PATH = path.resolve('electron/zatca_bridge_impl.cjs');
const tempIn = path.resolve('scratch/test_bridge_in.json');
const tempOut = path.resolve('scratch/test_bridge_out.json');

const data = {
    privateKeyPem: '',
    publicKeyPem: null,
    info: {
        EGS_SN: '1-SmartTouch|2-POS-01|3-311167090900003',
        UID: '311167090900003',
        CN: '1-SmartTouch|2-POS-01|3-311167090900003',
        ORG: 'مؤسسة ابراهيم سالم بن عوده البلوي للمقاولات العامة',
        OU: 'Head Office',
        IND: 'Retail',
        title: '1100',
        address: 'Riyadh',
        isSandbox: false,
        environment: 'production'
    }
};

fs.writeFileSync(tempIn, JSON.stringify(data), 'utf8');

try {
    const output = execSync(`node "${BRIDGE_IMPL_PATH}" "generateCSR" "${tempIn}" "${tempOut}"`, { encoding: 'utf8' });
    console.log("Stdout:", output);
    if (fs.existsSync(tempOut)) {
        console.log("Result:", fs.readFileSync(tempOut, 'utf8'));
    } else {
        console.log("No output file generated!");
    }
} catch (err) {
    console.error("Exec failed!");
    console.error("Message:", err.message);
    console.error("Stderr:", err.stderr);
    console.error("Stdout:", err.stdout);
}
