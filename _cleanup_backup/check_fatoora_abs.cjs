const { execSync } = require('child_process');
const fs = require('fs');

const sdkPath = 'C:\\my-pos\\v2\\zatca-einvoicing-sdk-Java-238-R3.4.8';

const certPath = sdkPath + '\\Data\\Certificates\\cert.pem';
let cert = fs.readFileSync(certPath, 'utf8');
// restore header
if (!cert.includes('BEGIN')) {
    cert = `-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
    fs.writeFileSync(certPath, cert);
}

const xml = `<Invoice><test>123</test></Invoice>`; // just dummy to see error
fs.writeFileSync('C:\\my-pos\\v2\\unsigned_tmp.xml', xml);
try {
    const stdout = execSync('fatoora -sign -invoice "C:\\my-pos\\v2\\unsigned_tmp.xml" -signedInvoice "C:\\my-pos\\v2\\signed_tmp.xml"', { stdio: 'pipe' });
    console.log("Success:\n" + stdout.toString());
} catch(e) {
    console.log("ERROR");
    console.log(e.stdout ? e.stdout.toString() : '');
    console.log(e.stderr ? e.stderr.toString() : '');
}
