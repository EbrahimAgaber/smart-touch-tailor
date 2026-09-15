const fs = require('fs');
const a = fs.readFileSync('java_props.xml', 'utf8');
const b = fs.readFileSync('node_props.xml', 'utf8');

let diffs = [];
for(let i=0; i<Math.max(a.length, b.length); i++) {
    if(a[i] !== b[i]) {
        diffs.push({offset: i, javaChar: a[i], nodeChar: b[i]});
    }
}

console.log(`Found ${diffs.length} differences.`);
if(diffs.length > 0) {
    console.log('First diff at offset ' + diffs[0].offset);
    const start = Math.max(0, diffs[0].offset - 10);
    console.log('Java context:', JSON.stringify(a.substring(start, start + 30)));
    console.log('Node context:', JSON.stringify(b.substring(start, start + 30)));
    
    // Also let's print all continuous chunks of differences to see what exactly differs
    let inDiff = false;
    let javaChunk = '';
    let nodeChunk = '';
    
    for(let i=0; i<Math.max(a.length, b.length); i++) {
        if(a[i] !== b[i]) {
            if (!inDiff) {
                console.log(`\nDiff block starting at ${i}:`);
                inDiff = true;
            }
            javaChunk += a[i] || '';
            nodeChunk += b[i] || '';
        } else {
            if (inDiff) {
                console.log('Java had: ' + JSON.stringify(javaChunk));
                console.log('Node had: ' + JSON.stringify(nodeChunk));
                inDiff = false;
                javaChunk = '';
                nodeChunk = '';
            }
        }
    }
    if (inDiff) {
        console.log('Java had: ' + JSON.stringify(javaChunk));
        console.log('Node had: ' + JSON.stringify(nodeChunk));
    }
}
