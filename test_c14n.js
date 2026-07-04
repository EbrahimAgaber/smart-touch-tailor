const {DOMParser} = require('@xmldom/xmldom');
const xpath = require('xpath');
const fs = require('fs');
const doc = new DOMParser().parseFromString(fs.readFileSync('ZATCA_INV-albasma_signed.xml', 'utf8'));
const z = require('./electron/zatca_phase2.cjs');
const signedPropsNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];
// c14n11Element calls _c14n11SerialiseElement with new Map()
const signedPropsForHashing = z.c14n11Element(signedPropsNode);
console.log("----");
console.log(signedPropsForHashing);
console.log("----");
const crypto = require('crypto');
console.log(crypto.createHash('sha256').update(signedPropsForHashing, 'utf8').digest('base64'));
