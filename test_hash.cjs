const { DOMParser } = require('xmldom');
const { SignedXml } = require('xml-crypto');
const fs = require('fs');

const xml = fs.readFileSync('signed_test.xml', 'utf8');

const sig = new SignedXml();
sig.keyInfoProvider = {
    getKeyInfo: () => '<X509Data></X509Data>',
    getKey: () => null
};
sig.loadSignature(xml);
const res = sig.checkSignature(xml);
console.log("Check Signature Result:", res);
console.log("Errors:", sig.validationErrors);
