/**
 * Step 3: Full-document namespace declaration diff.
 * Find every namespace declaration in both files and compare them.
 */
const fs = require('fs');

const javaXml = fs.readFileSync('java_signed3.xml', 'utf8');
const nodeXml = fs.readFileSync('node_signed_exact.xml', 'utf8');

function extractAllNSDecls(xml) {
    const decls = [];
    // Match all xmlns:xxx="..." and xmlns="..." anywhere in the document
    const re = /xmlns(?::([a-zA-Z0-9_\-]+))?="([^"]*)"/g;
    let match;
    while ((match = re.exec(xml)) !== null) {
        const prefix = match[1] || '';
        const uri = match[2];
        decls.push({ prefix, uri });
    }
    return decls;
}

function dedupeDecls(decls) {
    const seen = new Set();
    return decls.filter(d => {
        const key = `${d.prefix}=${d.uri}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function countDecls(decls) {
    const counts = {};
    for (const d of decls) {
        const key = `${d.prefix}=${d.uri}`;
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

const javaDecls = extractAllNSDecls(javaXml);
const nodeDecls = extractAllNSDecls(nodeXml);

const javaCounts = countDecls(javaDecls);
const nodeCounts = countDecls(nodeDecls);

const allKeys = new Set([...Object.keys(javaCounts), ...Object.keys(nodeCounts)]);

console.log('=== Namespace Declaration Count Diff ===');
console.log('(prefix=URI : java_count vs node_count)\n');

let hasDiff = false;
for (const key of [...allKeys].sort()) {
    const jc = javaCounts[key] || 0;
    const nc = nodeCounts[key] || 0;
    const diff = jc !== nc ? ' *** DIFF ***' : '';
    if (diff) hasDiff = true;
    console.log(`  ${key}: java=${jc} node=${nc}${diff}`);
}

if (!hasDiff) console.log('\nNo count differences found.');

// Also check the document root element's namespace declarations
console.log('\n=== Root element namespace declarations ===');
const javaRootMatch = javaXml.match(/^<[^>]+>/);
const nodeRootMatch = nodeXml.match(/^<[^>]+>/);

if (javaRootMatch) {
    console.log('\nJava root element:\n' + javaRootMatch[0].substring(0, 2000));
}
if (nodeRootMatch) {
    console.log('\nNode root element:\n' + nodeRootMatch[0].substring(0, 2000));
}
