const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const tmpDir = path.join(process.cwd(), '_zatca_test');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

// Generate CSR using exact ZATCA-blessed openssl method
const conf = [
    'oid_section = OIDs', '[OIDs]', 'certificateTemplateName = 1.3.6.1.4.1.311.20.2',
    '', '[req]', 'default_bits = 2048', 'req_extensions = v3_req', 'distinguished_name = dn', 'prompt = no',
    '', '[dn]', 'C = SA', 'OU = 3100000000', 'O = Test Org', 'CN = ZATCA-EGS',
    '', '[v3_req]', 'certificateTemplateName = ASN1:PRINTABLESTRING:TSTZATCA-Code-Signing', 'subjectAltName = dirName:alt_names',
    '', '[alt_names]', 'SN = 1-SmartTouch|2-POS|3-001', 'UID = 310000000000003', 'title = 1100', 'registeredAddress = Riyadh', 'businessCategory = Retail',
].join('\n');
fs.writeFileSync(path.join(tmpDir, 'csr.cnf'), conf, 'utf8');

execSync('openssl ecparam -name secp256k1 -genkey -noout -out ' + path.join(tmpDir, 'key.pem'), { stdio: 'pipe' });
execSync('openssl req -new -sha256 -key ' + path.join(tmpDir, 'key.pem') + ' -extensions v3_req -config ' + path.join(tmpDir, 'csr.cnf') + ' -out ' + path.join(tmpDir, 'csr.pem'), { stdio: 'pipe' });

const csrPem = fs.readFileSync(path.join(tmpDir, 'csr.pem'), 'utf8').trim();
// Strip DER-only base64 (what we currently do)
const csrDerBase64 = csrPem.replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '').replace(/-----END CERTIFICATE REQUEST-----/g, '').replace(/[\r\n]/g, '');

// What zatca-xml-js does: base64-encode the ENTIRE PEM text
const csrPemBase64 = Buffer.from(csrPem).toString('base64');

console.log('=== Test 1: DER base64 (our current method) ===');
console.log('Length:', csrDerBase64.length);
console.log('First 40:', csrDerBase64.substring(0, 40));

console.log('\n=== Test 2: PEM-text base64 (what zatca-xml-js does) ===');
console.log('Length:', csrPemBase64.length);
console.log('First 40:', csrPemBase64.substring(0, 40));

const headers = {
    'OTP': '123456',
    'Accept-Version': 'V2',
    'Accept-Language': 'en',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

(async () => {
    // Test 1: DER base64 (current broken method)
    try {
        const r = await axios.post(
            'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance',
            { csr: csrDerBase64 },
            { headers, timeout: 30000 }
        );
        console.log('\n[DER base64] SUCCESS:', Object.keys(r.data));
    } catch (e) {
        console.log('\n[DER base64] Status:', e.response?.status, '| Body:', typeof e.response?.data === 'string' ? e.response.data : JSON.stringify(e.response?.data));
    }

    // Test 2: PEM-text base64 (what zatca-xml-js does)
    try {
        const r = await axios.post(
            'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance',
            { csr: csrPemBase64 },
            { headers, timeout: 30000 }
        );
        console.log('\n[PEM base64] SUCCESS!!! Keys:', Object.keys(r.data));
        console.log('  requestID:', r.data.requestID);
        console.log('  has binarySecurityToken:', !!r.data.binarySecurityToken);
        console.log('  has secret:', !!r.data.secret);
    } catch (e) {
        console.log('\n[PEM base64] Status:', e.response?.status, '| Body:', typeof e.response?.data === 'string' ? e.response.data : JSON.stringify(e.response?.data));
    }

    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true }); } catch(e) {}
})();
