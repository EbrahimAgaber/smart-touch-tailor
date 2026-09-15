/**
 * Deeper Step 3: Extract the actual Invoice root element opening tag
 * and compare the ordering of namespace declarations between files.
 * C14N sorts namespaces lexicographically — if ordering in the source
 * differs, xml-crypto may behave differently.
 */
const fs = require('fs');

const javaXml = fs.readFileSync('java_signed3.xml', 'utf8');
const nodeXml = fs.readFileSync('node_signed_exact.xml', 'utf8');

function extractRootTag(xml) {
    // Skip the XML declaration
    const noDecl = xml.replace(/^<\?xml[^?]*\?>\s*/, '');
    const end = noDecl.indexOf('>');
    return noDecl.substring(0, end + 1);
}

const javaRoot = extractRootTag(javaXml);
const nodeRoot = extractRootTag(nodeXml);

console.log('=== Java root tag ===');
console.log(javaRoot);
console.log('\n=== Node root tag ===');
console.log(nodeRoot);

// Extract only namespace declarations in order
function extractNSDeclsOrdered(tag) {
    const re = /xmlns(?::([a-zA-Z0-9_\-]+))?="([^"]*)"/g;
    const result = [];
    let match;
    while ((match = re.exec(tag)) !== null) {
        result.push(`xmlns${match[1] ? ':' + match[1] : ''}="${match[2]}"`);
    }
    return result;
}

const javaNS = extractNSDeclsOrdered(javaRoot);
const nodeNS = extractNSDeclsOrdered(nodeRoot);

console.log('\n=== Java NS declaration order ===');
javaNS.forEach((ns, i) => console.log(`  [${i}] ${ns}`));

console.log('\n=== Node NS declaration order ===');
nodeNS.forEach((ns, i) => console.log(`  [${i}] ${ns}`));

// Check if ordering differs
const orderDiffers = javaNS.join('|') !== nodeNS.join('|');
console.log('\nOrdering differs:', orderDiffers);

// Also check where each namespace is declared (root vs SignedProperties vs ds:Signature etc)
console.log('\n=== Where is xades: declared? ===');
const javaXadesIdx = javaXml.indexOf('xmlns:xades=');
const nodeXadesIdx = nodeXml.indexOf('xmlns:xades=');
console.log('Java xades declaration position:', javaXadesIdx);
console.log('Node xades declaration position:', nodeXadesIdx);
console.log('Java context:', javaXml.substring(Math.max(0, javaXadesIdx - 30), javaXadesIdx + 60));
console.log('Node context:', nodeXml.substring(Math.max(0, nodeXadesIdx - 30), nodeXadesIdx + 60));
