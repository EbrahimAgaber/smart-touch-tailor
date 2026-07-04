const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const crypto = require('crypto');
const fs = require('fs');

function c14n11Element(el) {
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
    function render(n, inheritedNs) {
        if (n.nodeType === 3) {
            out.push(n.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;'));
        } else if (n.nodeType === 1) {
            out.push(`<${n.tagName}`);
            const localNs = new Map(inheritedNs);
            const attrs = [];
            for (let i = 0; i < n.attributes.length; i++) {
                const a = n.attributes[i];
                if (a.name === 'xmlns') {
                    localNs.set('', a.value);
                } else if (a.name.startsWith('xmlns:')) {
                    localNs.set(a.name.slice(6), a.value);
                } else {
                    attrs.push(a);
                }
            }
            if (n === el) {
                // For the root of the subtree being canonicalised, emit all effective namespaces
                for (const [prefix, uri] of localNs.entries()) {
                    if (prefix === '') out.push(` xmlns="${uri}"`);
                    else out.push(` xmlns:${prefix}="${uri}"`);
                }
            } else {
                // Naive C14N for child elements (doesn't handle all edge cases but usually fine if NS are declared at root)
                for (let i = 0; i < n.attributes.length; i++) {
                    const a = n.attributes[i];
                    if (a.name.startsWith('xmlns')) {
                        out.push(` ${a.name}="${a.value}"`);
                    }
                }
            }
            
            // Sort attributes alphabetically by name
            attrs.sort((a, b) => a.name.localeCompare(b.name));
            for (const a of attrs) {
                out.push(` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r/g, '&#xD;').replace(/\n/g, '&#xA;').replace(/\t/g, '&#x9;')}"`);
            }
            out.push('>');
            for (let i = 0; i < n.childNodes.length; i++) {
                render(n.childNodes[i], localNs);
            }
            out.push(`</${n.tagName}>`);
        }
    }
    render(el, ancestorNs);
    return out.join('');
}

const docStr = fs.readFileSync('node_signed_exact.xml', 'utf8');
const doc = new DOMParser().parseFromString(docStr, 'application/xml');
const signedPropsNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];
const c14n = c14n11Element(signedPropsNode);

fs.writeFileSync('node_c14n.xml', c14n);

const javaDocStr = fs.readFileSync('java_signed3.xml', 'utf8');
const javaDoc = new DOMParser().parseFromString(javaDocStr, 'application/xml');
const javaSignedPropsNode = xpath.select("//*[local-name()='SignedProperties']", javaDoc)[0];
const javaC14n = c14n11Element(javaSignedPropsNode);

fs.writeFileSync('java_c14n.xml', javaC14n);

const javaHashHex = crypto.createHash('sha256').update(javaC14n, 'utf8').digest('hex');
const javaHashB64 = Buffer.from(javaHashHex, 'utf8').toString('base64');
console.log("If Node C14n'd Java file:", javaHashB64);
