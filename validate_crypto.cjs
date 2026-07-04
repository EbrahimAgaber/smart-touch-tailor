const fs = require('fs');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('xmldom');

const xml = fs.readFileSync('java_signed.xml', 'utf8');
const doc = new DOMParser().parseFromString(xml);

const sig = new SignedXml();
const signatureNode = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];

const originalGetCanonXml = sig.getCanonXml.bind(sig);
sig.getCanonXml = function() {
    return "MOCK";
};
sig.loadSignature(signatureNode);

for (let ref of sig.references) {
    try {
        const digest = sig.getDigest(xml, ref);
        console.log('URI:', ref.uri);
        console.log('  Calculated Digest:', digest);
        console.log('  Expected Digest:', ref.digestValue);
    } catch(e) {
        console.log('URI:', ref.uri, 'ERROR:', e.message);
    }
}
