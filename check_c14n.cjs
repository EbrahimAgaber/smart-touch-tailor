const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  
  const queue = db.prepare('SELECT signed_xml FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
  if (!queue || !queue.signed_xml) process.exit(0);

  const { DOMParser } = require('xmldom');
  const xpath = require('xpath');

  const doc = new DOMParser().parseFromString(queue.signed_xml, 'application/xml');
  const signedPropsNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];

  function serializeDom4j(node, activeNs = new Map()) {
    if (node.nodeType === 3) return String(node.nodeValue).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (node.nodeType !== 1) return '';
    let name = node.nodeName;
    let res = '<' + name;
    
    // Check missing xmlns
    const declaredNs = [];
    if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            if (attr.name.startsWith('xmlns:')) declaredNs.push(attr);
        }
    }
    
    // Sort namespaces alphabetically for C14N
    declaredNs.sort((a, b) => a.name.localeCompare(b.name));
    for (const attr of declaredNs) res += ` ${attr.name}="${attr.value}"`;

    const attrs = [];
    if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            if (!attr.name.startsWith('xmlns:')) attrs.push(attr);
        }
    }
    attrs.sort((a, b) => a.name.localeCompare(b.name));
    for (const attr of attrs) res += ` ${attr.name}="${attr.value}"`;

    res += '>';
    if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) res += serializeDom4j(node.childNodes[i], activeNs);
    }
    res += '</' + name + '>';
    return res;
  }

  const c14nString = serializeDom4j(signedPropsNode);
  console.log("MY JS CANONICALIZATION:\n" + c14nString);
  
  // Now proper C14N with xmldom
  const c14n = require('xml-crypto/lib/c14n-canonicalization').ExclusiveCanonicalization;
  // Wait, ZATCA uses Inclusive C14N!
  const DOM = require('xmldom').DOMParser;
  
  process.exit(0);
});
