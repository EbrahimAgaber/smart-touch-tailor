const fs = require('fs');
const crypto = require('crypto');
const { DOMParser, XMLSerializer } = require('xmldom');

const xml = fs.readFileSync('java_signed3.xml', 'utf8');
const doc = new DOMParser().parseFromString(xml, 'application/xml');
const xpath = require('xpath');

const select = xpath.useNamespaces({ 'xades': 'http://uri.etsi.org/01903/v1.3.2#' });
const node = select("//xades:SignedProperties[@Id='xadesSignedProperties']", doc)[0];

let str = new XMLSerializer().serializeToString(node);
str = str
    .replace('<xades:SignedProperties Id="xadesSignedProperties" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">', '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')
    .replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
    .replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
    .replace('<ds:DigestValue>', '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
    .replace('<ds:X509IssuerName>', '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
    .replace('<ds:X509SerialNumber>', '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');

fs.writeFileSync('xmldom_sp.txt', str);
