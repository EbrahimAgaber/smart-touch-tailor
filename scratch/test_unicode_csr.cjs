const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function escapeUnicode(str) {
    return str.split('').map(char => {
        const code = char.charCodeAt(0);
        return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : char;
    }).join('');
}

async function runTest() {
    const orgName = "مؤسسة ابراهيم سالم بن عوده البلوي للمقاولات العامة";
    const address = "العلا,شارع الملك فهد, بجوار صيدلية البلسم 2";
    
    const propContent = [
        `csr.common.name=POS-9013`, // Clean CN without pipes
        `csr.serial.number=1-SmartTouch|2-POS-9013|3-311167090900003`,
        `csr.organization.identifier=311167090900003`,
        `csr.organization.unit.name=Head Office`,
        `csr.organization.name=${escapeUnicode(orgName)}`, // Escaped org name
        `csr.country.name=SA`,
        `csr.invoice.type=1100`,
        `csr.location.address=${escapeUnicode(address)}`, // Escaped address
        `csr.industry.business.category=Retail`
    ].join('\n');

    const tempDir = require('os').tmpdir();
    const propPath = path.join(tempDir, 'temp_test_unicode_csr.properties');
    fs.writeFileSync(propPath, propContent, 'utf8');

    const outKeyPath = path.join(tempDir, 'temp_test_unicode_privkey.key');
    const outCsrPath = path.join(tempDir, 'temp_test_unicode_csr.csr');

    if (fs.existsSync(outKeyPath)) fs.unlinkSync(outKeyPath);
    if (fs.existsSync(outCsrPath)) fs.unlinkSync(outCsrPath);

    const sdkPath = path.join(__dirname, '..', 'zatca-einvoicing-sdk-Java-238-R3.4.8');
    const sdkAppsPath = path.join(sdkPath, 'Apps');
    const fatooraBat = path.join(sdkAppsPath, 'fatoora.bat');

    // Run in production mode (no -nonprod)
    const cmd = `"${fatooraBat}" -csr -csrConfig "${propPath}" -privateKey "${outKeyPath}" -generatedCsr "${outCsrPath}" -pem`;
    console.log("Running command:", cmd);
    
    execSync(cmd, { cwd: sdkAppsPath, env: { ...process.env, FATOORA_HOME: sdkAppsPath } });

    console.log("CSR generated successfully. Now verifying...");
    
    // Let's copy the file to scratch/test_unicode.csr so we can inspect it with OpenSSL
    const csrPem = fs.readFileSync(outCsrPath, 'utf8');
    fs.writeFileSync('scratch/test_unicode.csr', csrPem, 'utf8');
}

runTest().catch(console.error);
