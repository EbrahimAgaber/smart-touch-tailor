const {DOMParser} = require('@xmldom/xmldom');
const xpath = require('xpath');
const fs = require('fs');
const doc = new DOMParser().parseFromString(fs.readFileSync('ZATCA_INV-albasma_signed.xml', 'utf8'));
const base64Nodes = xpath.select("//*[local-name()='DigestValue' or local-name()='SignatureValue' or local-name()='X509Certificate' or local-name()='EmbeddedDocumentBinaryObject']", doc);
base64Nodes.forEach(n => console.log(n.localName + ': ' + n.textContent));
