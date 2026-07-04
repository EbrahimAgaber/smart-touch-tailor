const fs = require('fs');
const crypto = require('crypto');

const javaXml = fs.readFileSync('java_signed3.xml', 'utf8');
const nodeXml = fs.readFileSync('node_signed_exact.xml', 'utf8');

// Step 1: Extract exact literal substrings for SignedProperties
function extractSignedProperties(xml) {
    const startTag = '<xades:SignedProperties';
    const endTag = '</xades:SignedProperties>';
    const startIdx = xml.indexOf(startTag);
    const endIdx = xml.indexOf(endTag) + endTag.length;
    return xml.substring(startIdx, endIdx);
}

const javaSpStr = extractSignedProperties(javaXml);
const nodeSpStr = extractSignedProperties(nodeXml);

console.log("--- Step 1: Raw Byte Checksums ---");
const javaHash = crypto.createHash('sha256').update(javaSpStr, 'utf8').digest('hex');
const nodeHash = crypto.createHash('sha256').update(nodeSpStr, 'utf8').digest('hex');
console.log(`Java Extracted Substring SHA-256 (hex): ${javaHash}`);
console.log(`Node Extracted Substring SHA-256 (hex): ${nodeHash}`);
console.log(`Identical hashes? ${javaHash === nodeHash}\n`);

// Step 4: Extract DigestValue blocks
console.log("--- Step 4: DigestValue blocks ---");
function extractDigestBlock(xml) {
    const startStr = '<ds:Reference';
    const endStr = '</ds:Reference>';
    let searchIdx = 0;
    while (true) {
        let idx = xml.indexOf(startStr, searchIdx);
        if (idx === -1) break;
        let endIdx = xml.indexOf(endStr, idx) + endStr.length;
        let block = xml.substring(idx, endIdx);
        if (block.includes('URI="#xadesSignedProperties"')) {
            return block;
        }
        searchIdx = endIdx;
    }
    return "NOT FOUND";
}
console.log("Java File Reference Block:\n" + extractDigestBlock(javaXml) + "\n");
console.log("Node File Reference Block:\n" + extractDigestBlock(nodeXml) + "\n");
