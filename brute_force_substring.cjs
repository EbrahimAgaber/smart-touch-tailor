const fs = require('fs');
const crypto = require('crypto');

const xml = fs.readFileSync('java_signed3.xml', 'utf8');
const targetHash = '61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7';

console.log("Brute forcing substrings...");
const startIdx = xml.indexOf('<xades:SignedProperties');
const endIdx = xml.indexOf('</xades:SignedProperties>') + '</xades:SignedProperties>'.length;

// Expand search window slightly
const windowStart = Math.max(0, startIdx - 100);
const windowEnd = Math.min(xml.length, endIdx + 100);
const searchArea = xml.substring(windowStart, windowEnd);

for (let i = 0; i < searchArea.length; i++) {
    for (let j = i + 1; j <= searchArea.length; j++) {
        const sub = searchArea.substring(i, j);
        const hash = crypto.createHash('sha256').update(sub, 'utf8').digest('hex');
        if (hash === targetHash) {
            console.log("FOUND EXACT SUBSTRING!");
            console.log("----------------------");
            console.log(sub);
            console.log("----------------------");
            process.exit(0);
        }
    }
}
console.log("No exact substring matched.");
