const fs = require('fs');
const forge = require('node-forge');

function inspectCSR(filePath) {
    console.log(`\n=== INSPECTING: ${filePath} ===`);
    const csrPem = fs.readFileSync(filePath, 'utf8');
    const cleanBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n]/g, '')
        .trim();
    const bytes = Buffer.from(cleanBase64, 'base64');
    
    // Parse using node-forge but catch public key error
    let asn1;
    try {
        asn1 = forge.asn1.fromDer(bytes.toString('binary'));
    } catch (e) {
        console.error("Failed to parse DER:", e.message);
        return;
    }
    
    // The CertificationRequestInfo is the first element
    const cri = asn1.value[0];
    
    // Subject is the third element of CRI (cri.value[1] is version, cri.value[2] is Subject)
    const subject = cri.value[1];
    console.log("Subject RDNs:");
    subject.value.forEach(set => {
        const seq = set.value[0];
        const oid = forge.asn1.derToOid(seq.value[0].value);
        const valType = seq.value[1].type;
        const rawVal = seq.value[1].value;
        const val = Buffer.from(rawVal, 'binary').toString('utf8');
        console.log(`  OID: ${oid}, Type: ${valType}, Value: ${val}`);
    });
    
    // Attributes are at cri.value[3] (index 3 is SubjectPublicKeyInfo, index 4 is Attributes)
    // Let's find index containing extensionRequest
    let attributes;
    for (let i = 3; i < cri.value.length; i++) {
        const item = cri.value[i];
        if (item.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && item.type === 0) {
            attributes = item;
            break;
        }
    }
    
    if (attributes) {
        console.log("Attributes:");
        attributes.value.forEach(attr => {
            const attrOid = forge.asn1.derToOid(attr.value[0].value);
            console.log(`  Attr OID: ${attrOid}`);
            // Check if it is extensionRequest
            if (attrOid === '1.2.840.113549.1.9.14') {
                const extSet = attr.value[1];
                const extSeq = extSet.value[0];
                extSeq.value.forEach(ext => {
                    const extOid = forge.asn1.derToOid(ext.value[0].value);
                    console.log(`    Extension OID: ${extOid}`);
                    // OID 2.5.29.17 is SAN
                    if (extOid === '2.5.29.17') {
                        // Let's inspect SAN GeneralNames
                        const sanValueOctets = ext.value[1]; // OCTET STRING
                        const innerAsn1 = forge.asn1.fromDer(sanValueOctets.value);
                        // The innerAsn1 is GeneralNames Sequence
                        // Let's print the structure of GeneralNames
                        innerAsn1.value.forEach(gn => {
                            console.log(`      GeneralName Tag: ${gn.type}`);
                            if (gn.type === 4) { // directoryName
                                // directoryName is Name Sequence
                                const nameSeq = gn.value[0];
                                console.log(`      directoryName RDNs:`);
                                nameSeq.value.forEach(set => {
                                    const seq = set.value[0];
                                    const oid = forge.asn1.derToOid(seq.value[0].value);
                                    const valType = seq.value[1].type;
                                    const rawVal = seq.value[1].value;
                                    const val = Buffer.from(rawVal, 'binary').toString('utf8');
                                    console.log(`        OID: ${oid}, Type: ${valType}, Value: ${val}`);
                                });
                            }
                        });
                    }
                });
            }
        });
    } else {
        console.log("No Attributes/Extensions found!");
    }
}

inspectCSR('scratch/sdk_csr.csr');
inspectCSR('scratch/csr.pem');
inspectCSR('scratch/test_unicode.csr');
