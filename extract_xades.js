const fs = require('fs');

function extractSignedProperties(filename) {
    const xml = fs.readFileSync(filename, 'utf-8');
    const startTag = '<xades:SignedProperties';
    const endTag = '</xades:SignedProperties>';
    const startIdx = xml.indexOf(startTag);
    const endIdx = xml.indexOf(endTag) + endTag.length;
    if (startIdx === -1 || endIdx === -1) {
        throw new Error(`Could not find SignedProperties in ${filename}`);
    }
    return xml.substring(startIdx, endIdx);
}

try {
    const javaSigned = extractSignedProperties('java_signed3.xml');
    fs.writeFileSync('java_signed_props.xml', javaSigned);

    const nodeSigned = extractSignedProperties('node_signed3.xml');
    fs.writeFileSync('node_signed_props.xml', nodeSigned);

    console.log('Extraction complete. Files written to java_signed_props.xml and node_signed_props.xml');
} catch (e) {
    console.error(e);
}
