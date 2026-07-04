const { DOMParser } = require('xmldom');
const xpath = require('xpath');

const xmlString = `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
    <xades:SignedProperties Id="xadesSignedProperties">
        <xades:SignedSignatureProperties>
            <xades:SigningTime>2026-07-01T22:34:34Z</xades:SigningTime>
        </xades:SignedSignatureProperties>
    </xades:SignedProperties>
</xades:QualifyingProperties>`;

const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
const el = xpath.select("//*[local-name()='SignedProperties']", doc)[0];

function _c14n11SerialiseElement(node, activeNs, out) {
    if (node.nodeType === 3) {
        out.push(String(node.nodeValue).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        return;
    }
    if (node.nodeType !== 1) return;
    
    out.push('<' + node.nodeName);
    
    const attrs = [];
    let nsList = [];
    if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            if (a.name.startsWith('xmlns')) nsList.push(a);
            else attrs.push(a);
        }
    }
    
    // Add inherited namespaces that are used but not declared
    if (node === el) {
        for (const [prefix, uri] of activeNs.entries()) {
            if (prefix === '') nsList.push({ name: 'xmlns', value: uri });
            else nsList.push({ name: 'xmlns:' + prefix, value: uri });
        }
    }

    nsList.sort((a, b) => a.name.localeCompare(b.name));
    for (const a of nsList) out.push(` ${a.name}="${a.value}"`);

    attrs.sort((a, b) => a.name.localeCompare(b.name));
    for (const a of attrs) out.push(` ${a.name}="${a.value}"`);

    out.push('>');
    
    if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
            _c14n11SerialiseElement(node.childNodes[i], activeNs, out);
        }
    }
    out.push('</' + node.nodeName + '>');
}

function c14nWithInheritedNS(el) {
    const ancestorNs = new Map();
    let node = el.parentNode;
    while (node && node.nodeType === 1) {
        for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            if (a.name === 'xmlns' && !ancestorNs.has('')) {
                ancestorNs.set('', a.value);
            } else if (a.name.startsWith('xmlns:')) {
                const prefix = a.name.slice(6);
                if (!ancestorNs.has(prefix)) ancestorNs.set(prefix, a.value);
            }
        }
        node = node.parentNode;
    }
    const out = [];
    _c14n11SerialiseElement(el, ancestorNs, out);
    return out.join('');
}

console.log(c14nWithInheritedNS(el));
