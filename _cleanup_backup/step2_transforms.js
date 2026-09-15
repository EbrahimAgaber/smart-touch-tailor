const fs = require('fs');
const xml = fs.readFileSync('java_signed3.xml', 'utf8');

// Extract the full Reference block for #xadesSignedProperties
const start = xml.indexOf('<ds:Reference');
let searchFrom = 0;
let block = null;
while (true) {
    const idx = xml.indexOf('<ds:Reference', searchFrom);
    if (idx === -1) break;
    const end = xml.indexOf('</ds:Reference>', idx) + '</ds:Reference>'.length;
    const candidate = xml.substring(idx, end);
    if (candidate.includes('#xadesSignedProperties')) {
        block = candidate;
        break;
    }
    searchFrom = end;
}

if (!block) {
    console.log('NOT FOUND');
} else {
    console.log('=== Literal <ds:Reference URI="#xadesSignedProperties"> block from java_signed3.xml ===\n');
    console.log(block);
    console.log('\n=== Has <ds:Transforms>:', block.includes('<ds:Transforms>'));
    console.log('=== Has Transform Algorithm:', block.includes('Algorithm='));
}
