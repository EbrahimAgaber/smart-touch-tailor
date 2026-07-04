const fs     = require('fs');
const path   = require('path');

const PROJECT_ROOT  = __dirname;
const SDK_ROOT      = path.join(PROJECT_ROOT, 'zatca-einvoicing-sdk-Java-238-R3.4.8');
const SDK_APPS      = path.join(SDK_ROOT, 'Apps');
const SDK_CERTS_DIR = path.join(SDK_ROOT, 'Data', 'Certificates');
const SDK_CERT_FILE = path.join(SDK_CERTS_DIR, 'cert.pem');
const SDK_KEY_FILE  = path.join(SDK_CERTS_DIR, 'ec-secp256k1-priv-key.pem');

const xmlFile = path.join(PROJECT_ROOT, 'ZATCA_INV-ourown_singed.xml');
const keyFile = path.join(PROJECT_ROOT, 'last_signing_key.pem');

// 1. Extract cert from XML
const xml = fs.readFileSync(xmlFile, 'utf8');
const m = xml.match(/<ds:X509Certificate>([\s\S]+?)<\/ds:X509Certificate>/);
if (!m) {
    console.error('Could not find ds:X509Certificate in XML');
    process.exit(1);
}
const bareCert = m[1].replace(/[\n\r\s]/g, '');

// 2. Convert key
const pkcs8Pem = fs.readFileSync(keyFile, 'utf8');
const der = Buffer.from(
    pkcs8Pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/[\n\r]/g, ''),
    'base64'
);
let off = 0;
const readLen = (buf, o) => {
    const f = buf[o++];
    if (f < 0x80) return { len: f, end: o };
    const nb = f & 0x7f;
    let l = 0;
    for (let i = 0; i < nb; i++) l = (l << 8) | buf[o++];
    return { len: l, end: o };
};
off++; const outer = readLen(der, off); off = outer.end;
off++; const vLen = readLen(der, off); off = vLen.end + vLen.len;
off++; const algLen = readLen(der, off); off = algLen.end + algLen.len;
off++; const ecLen = readLen(der, off);
const ecKeyDer = der.slice(ecLen.end, ecLen.end + ecLen.len);
const rawKeyB64 = ecKeyDer.toString('base64');

// 3. Write certs
fs.writeFileSync(SDK_CERT_FILE, bareCert, 'utf8');
fs.writeFileSync(SDK_KEY_FILE, rawKeyB64, 'utf8');
console.log('✔  Certs injected successfully to Data/Certificates/');

// 4. Copy invoice
const destXml = path.join(SDK_APPS, 'ZATCA_INV-ourown_singed.xml');
fs.copyFileSync(xmlFile, destXml);
console.log(`✔  Copied invoice to Apps/ZATCA_INV-ourown_singed.xml`);
