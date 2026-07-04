const crypto = require('crypto');
const fs = require('fs');

const targetHex = 'a9bf78ed94201fb74f3496e4fa0411915abf4e81ed973bcf3ba6c99df096af1e';

const { DOMParser } = require('xmldom');
const xpath = require('xpath');
const { ExclusiveCanonicalization } = require('xml-crypto');
const { c14n11Element } = require('./electron/zatca_phase2_impl.cjs');

const xml = fs.readFileSync('java_signed.xml', 'utf8');
const doc = new DOMParser().parseFromString(xml, 'application/xml');
const node = xpath.select("//*[@Id='xadesSignedProperties']", doc)[0];

const variations = [];

const c14 = c14n11Element(node);
variations.push(c14);

// Replace empty tags with closed tags in c14
variations.push(c14.replace('></ds:DigestMethod>', '/>'));
variations.push(c14.replace('></ds:DigestMethod>', ' />'));

// Try stripping inherited namespaces!
const stripped = c14
    .replace(' xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"', '')
    .replace(' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"', '')
    .replace(' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"', '')
    .replace(' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"', '')
    .replace(' xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"', '')
    .replace(' xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2"', '')
    .replace(' xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"', '');
variations.push(stripped);
variations.push(stripped.replace('></ds:DigestMethod>', '/>'));

// Try C14N of just the raw string as document root
const rawStart = xml.indexOf('<xades:SignedProperties');
const rawEnd = xml.indexOf('</xades:SignedProperties>') + '</xades:SignedProperties>'.length;
const rawString = xml.substring(rawStart, rawEnd);
const parseableXml = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"` + rawString.substring(23);
const doc2 = new DOMParser().parseFromString(parseableXml, 'application/xml');
const c14_doc2 = c14n11Element(doc2.documentElement);
variations.push(c14_doc2);
variations.push(c14_doc2.replace('></ds:DigestMethod>', '/>'));

for (let i = 0; i < variations.length; i++) {
    const hex = crypto.createHash('sha256').update(variations[i], 'utf8').digest('hex');
    if (hex === targetHex) {
        console.log('MATCH FOUND!', i);
        console.log('Content:', variations[i]);
        return;
    }
}
console.log('No match found.');
