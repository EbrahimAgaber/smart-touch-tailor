const fs = require('fs');
const crypto = require('crypto');
const xpath = require('xpath');
const DOMParser = require('@xmldom/xmldom').DOMParser;
const xmlcrypto = require('xml-crypto');

const xml = fs.readFileSync('java_signed3.xml', 'utf8');
const doc = new DOMParser().parseFromString(xml, 'application/xml');
const spNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];
const targetHash = '61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7';

function check(name, str) {
    const hash = crypto.createHash('sha256').update(str, 'utf8').digest('hex');
    if (hash === targetHash) {
        console.log("MATCH FOUND!!! " + name);
        console.log(str);
        process.exit(0);
    }
}

// 1. Exclusive C14N
const exc = new xmlcrypto.ExclusiveCanonicalization();
exc.includeComments = false;
const str1 = exc.process(spNode);
check('Exclusive C14N', str1);

// 2. Inclusive C14N
function c14nWithInheritedNS(el) {
    const ancestorNs = new Map();
    let node = el.parentNode;
    while (node && node.nodeType === 1) {
        for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            if (a.name === 'xmlns' && !ancestorNs.has('')) ancestorNs.set('', a.value);
            else if (a.name.startsWith('xmlns:')) ancestorNs.set(a.name.slice(6), a.value);
        }
        node = node.parentNode;
    }
    for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        if (a.name === 'xmlns') ancestorNs.set('', a.value);
        else if (a.name.startsWith('xmlns:')) ancestorNs.set(a.name.slice(6), a.value);
    }
    const exc2 = new xmlcrypto.ExclusiveCanonicalization();
    let baseC14n = exc2.process(el);
    baseC14n = baseC14n.replace(/ xmlns(:[a-zA-Z0-9-]+)?="[^"]*"/g, '');
    const sortedPrefs = Array.from(ancestorNs.keys()).sort();
    let nsString = '';
    for (const p of sortedPrefs) {
        const u = ancestorNs.get(p);
        nsString += (p === '' ? ` xmlns="${u}"` : ` xmlns:${p}="${u}"`);
    }
    return baseC14n.replace(/^<([^\s>]+)/, `<$1${nsString}`);
}
check('Inclusive C14N', c14nWithInheritedNS(spNode));

// 3. Raw string extraction
const rawStr = xml.substring(xml.indexOf('<xades:SignedProperties'), xml.indexOf('</xades:SignedProperties>') + 25);
check('Raw String', rawStr);

// 4. Raw string spaces stripped
check('Raw String spaces stripped', rawStr.replace(/>\s+</g, '><'));

// 5. Exclusive C14N minified
check('Exclusive C14N Minified', str1.replace(/>\s+</g, '><'));

// 6. Try xmldom serialization (it's what XMLSerializer would output)
const { XMLSerializer } = require('@xmldom/xmldom');
const rawDomString = new XMLSerializer().serializeToString(spNode);
check('xmldom serializeToString', rawDomString);
check('xmldom serializeToString minified', rawDomString.replace(/>\s+</g, '><'));

console.log("NO MATCH FOUND!");
