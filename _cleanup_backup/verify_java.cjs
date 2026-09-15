const fs = require('fs');
const { DOMParser } = require('xmldom');
const xpath = require('xpath');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { ExclusiveCanonicalization } = require('xml-crypto');

const xml = fs.readFileSync('java_signed.xml', 'utf8');
const doc = new DOMParser().parseFromString(xml, 'application/xml');

const certB64 = xpath.select("//*[local-name()='X509Certificate']/text()", doc)[0].nodeValue;
const certPem = `-----BEGIN CERTIFICATE-----\n${certB64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
const sigValueB64 = xpath.select("//*[local-name()='SignatureValue']/text()", doc)[0].nodeValue;
const sigValueDer = Buffer.from(sigValueB64, 'base64');
const signedInfoNode = xpath.select("//*[local-name()='SignedInfo']", doc)[0];

const exc = new ExclusiveCanonicalization();
const c14n = exc.process(signedInfoNode);

fs.writeFileSync('data.bin', c14n);
try {
    execSync(`openssl dgst -sha256 -verify pubkey_only.pem -signature sig.bin data.bin`, { stdio: 'pipe' });
    console.log('Match: Exclusive C14N Raw bytes');
} catch(e) {}

const hashHex = crypto.createHash('sha256').update(c14n, 'utf8').digest('hex');
fs.writeFileSync('data_hex.bin', hashHex);
try {
    execSync(`openssl dgst -sha256 -verify pubkey_only.pem -signature sig.bin data_hex.bin`, { stdio: 'pipe' });
    console.log('Match: Exclusive C14N Hex string');
} catch(e) {}
console.log('Done Exclusive tests');
