const fs = require('fs');
const { DOMParser } = require('xmldom');
const crypto = require('crypto');
const { c14n11Element } = require('./electron/zatca_phase2_impl.cjs');

const xml = fs.readFileSync('java_signed.xml', 'utf8');
const start = xml.indexOf('<xades:SignedProperties');
const end = xml.indexOf('</xades:SignedProperties>') + '</xades:SignedProperties>'.length;
const rawString = xml.substring(start, end);

// Wrap in a dummy root if necessary, or just parse directly if xmldom allows
const standaloneXml = rawString;
// We must provide the namespaces that are strictly required to parse it
const parseableXml = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"` + rawString.substring(23);

const doc = new DOMParser().parseFromString(parseableXml, 'application/xml');
const c14n = c14n11Element(doc.documentElement);
const hex = crypto.createHash('sha256').update(c14n, 'utf8').digest('hex');
console.log('c14n:', c14n);
console.log('Hex:', hex);
