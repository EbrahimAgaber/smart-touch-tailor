const fs = require('fs');
const a = fs.readFileSync('java_props.xml', 'utf8');
const b = fs.readFileSync('node_props.xml', 'utf8');

const stripSpace = str => str.replace(/\s+/g, '');

const aStripped = stripSpace(a);
const bStripped = stripSpace(b);

if (aStripped === bStripped) {
    console.log("SUCCESS: The XML blocks are identical when whitespace is removed!");
} else {
    console.log("FAIL: The XML blocks have non-whitespace differences.");
    let diffs = [];
    for(let i=0; i<Math.max(aStripped.length, bStripped.length); i++) {
        if(aStripped[i] !== bStripped[i]) {
            console.log(`Diff at offset ${i}: Java=${aStripped[i]} Node=${bStripped[i]}`);
            console.log("Java context: " + aStripped.substring(Math.max(0, i-10), i+10));
            console.log("Node context: " + bStripped.substring(Math.max(0, i-10), i+10));
            break;
        }
    }
}
