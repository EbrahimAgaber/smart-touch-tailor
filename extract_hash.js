const fs = require('fs');
const java = fs.readFileSync('java_signed3.xml', 'utf8');
const node = fs.readFileSync('node_signed_exact.xml', 'utf8');

const r = /<ds:Reference[^>]*URI="#xadesSignedProperties"[^>]*>[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/;

console.log('Java Digest:', java.match(r)[1]);
console.log('Node Digest:', node.match(r)[1]);
