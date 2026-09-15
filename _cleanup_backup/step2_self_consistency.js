/**
 * Step 2 (revised): Self-consistency check.
 *
 * KEY FINDING: java_signed3.xml has NO <ds:Transforms> on the #xadesSignedProperties
 * Reference. Per RFC 3275 / XMLDSig spec, absent transforms means the reference
 * is dereferenced as a same-document URI fragment (#xadesSignedProperties) and the
 * result is the *octet stream* of the identified element — which in practice for
 * same-document fragment references means the element is serialized/canonicalized
 * using the implicit transform, which is C14N (inclusive without comments).
 *
 * We test multiple approaches until one reproduces the recorded digest.
 */
const fs = require('fs');
const crypto = require('crypto');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const xmlcrypto = require('xml-crypto');

const javaXml = fs.readFileSync('java_signed3.xml', 'utf8');
const doc = new DOMParser().parseFromString(javaXml, 'application/xml');

const recordedB64 = 'NjFkZmNjYWFiZjg2YzMwOTAyZDlhMWM3N2I3NDk2OTU4OWY0MDMxZGE0OGU2NDY1OTkyZDllZjlkZjY4YTRmNw==';
const recordedHex = Buffer.from(recordedB64, 'base64').toString('utf8');
console.log('Target hex:', recordedHex);

const spNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];

function testHash(label, str) {
    const h = crypto.createHash('sha256').update(str, 'utf8').digest('hex');
    const b64 = Buffer.from(h, 'utf8').toString('base64');
    const match = h === recordedHex;
    console.log(`\n[${label}]`);
    console.log('  computed hex:', h);
    console.log('  MATCH:', match);
    if (match) {
        console.log('  *** PIPELINE REPRODUCED JAVA DIGEST ***');
        fs.writeFileSync(`match_${label.replace(/\s/g, '_')}.xml`, str);
    }
    return match;
}

// 1. Exclusive C14N (xml-crypto)
const exc = new xmlcrypto.ExclusiveCanonicalization();
testHash('Exclusive C14N', exc.process(spNode));

// 2. Exclusive C14N with WithComments
const excWC = new xmlcrypto.ExclusiveCanonicalizationWithComments();
testHash('Exclusive C14N WithComments', excWC.process(spNode));

// 3. xmldom XMLSerializer (raw DOM serialize)
const ser = new XMLSerializer();
const rawSerialized = ser.serializeToString(spNode);
testHash('xmldom XMLSerializer', rawSerialized);

// 4. Literal substring from file
const startTag = '<xades:SignedProperties';
const endTag = '</xades:SignedProperties>';
const si = javaXml.indexOf(startTag);
const ei = javaXml.indexOf(endTag) + endTag.length;
const literal = javaXml.substring(si, ei);
testHash('Literal file substring', literal);

// 5. ZATCA-style: hash(hex(sha256(c14n))) — double encoding
const excStr = exc.process(spNode);
const excHex = crypto.createHash('sha256').update(excStr, 'utf8').digest('hex');
const excOfExcHex = crypto.createHash('sha256').update(excHex, 'utf8').digest('hex');
testHash('Double-hash Exclusive C14N', excHex); // hash of hex string

// 6. Inclusive C14N via _c14n11SerialiseElement from our patched file
// Load our patched module's c14n11Element
const { c14n11Element, c14nWithInheritedNS } = require('./zatca_phase2_patched.cjs');
testHash('Our c14n11Element on java DOM', c14n11Element(spNode));
testHash('Our c14nWithInheritedNS on java DOM', c14nWithInheritedNS(spNode));

// 7. Literal substring with \r\n normalized
testHash('Literal (CRLF->LF)', literal.replace(/\r\n/g, '\n'));
testHash('Literal (LF->CRLF)', literal.replace(/\n/g, '\r\n'));

// 8. xmldom output with various normalizations
testHash('XMLSerializer CRLF->LF', rawSerialized.replace(/\r\n/g, '\n'));
testHash('XMLSerializer LF->CRLF', rawSerialized.replace(/\n/g, '\r\n'));

// 9. Exclusive C14N with CRLF->LF
testHash('ExcC14N CRLF->LF', excStr.replace(/\r\n/g, '\n'));
testHash('ExcC14N LF->CRLF', excStr.replace(/\n/g, '\r\n'));

console.log('\nDone.');
