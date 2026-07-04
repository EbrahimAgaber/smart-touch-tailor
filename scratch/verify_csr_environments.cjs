const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

// Load our actual phase2 module
const zatca = require('../electron/zatca_phase2.cjs');

function getTemplateName(csrPem) {
    const cleanBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n]/g, '')
        .trim();
    const bytes = Buffer.from(cleanBase64, 'base64');
    const asn1 = forge.asn1.fromDer(bytes.toString('binary'));
    const cri = asn1.value[0];
    
    let attributes;
    for (let i = 3; i < cri.value.length; i++) {
        const item = cri.value[i];
        if (item.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && item.type === 0) {
            attributes = item;
            break;
        }
    }
    
    if (attributes) {
        for (let attr of attributes.value) {
            const attrOid = forge.asn1.derToOid(attr.value[0].value);
            if (attrOid === '1.2.840.113549.1.9.14') { // extensionRequest
                const extSeq = attr.value[1].value[0];
                for (let ext of extSeq.value) {
                    const extOid = forge.asn1.derToOid(ext.value[0].value);
                    if (extOid === '1.3.6.1.4.1.311.20.2') { // templateName
                        // The value is an OCTET STRING containing the string value (PrintableString/etc)
                        const octets = ext.value[1];
                        const inner = forge.asn1.fromDer(octets.value);
                        return inner.value;
                    }
                }
            }
        }
    }
    return null;
}

function verifySubjectCN(csrPem) {
    const cleanBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n]/g, '')
        .trim();
    const bytes = Buffer.from(cleanBase64, 'base64');
    const asn1 = forge.asn1.fromDer(bytes.toString('binary'));
    const cri = asn1.value[0];
    const subject = cri.value[1];
    let cnValue = null;
    subject.value.forEach(set => {
        const seq = set.value[0];
        const oid = forge.asn1.derToOid(seq.value[0].value);
        if (oid === '2.5.4.3') { // CN
            const rawVal = seq.value[1].value;
            cnValue = Buffer.from(rawVal, 'binary').toString('utf8');
        }
    });
    return cnValue;
}

async function main() {
    const keys = zatca.generateDeviceKeyPair();

    console.log("=== Testing Sandbox CSR Generation ===");
    const sandboxCsr = zatca.generateCSR(keys.privateKeyPem, null, {
        EGS_SN: '1-SmartTouch|2-POS-9013|3-311167090900003',
        UID: '311167090900003',
        CN: '1-SmartTouch|2-POS-9013|3-311167090900003'.replace(/\|/g, '-'),
        ORG: 'Test',
        OU: 'Head Office',
        IND: 'Retail',
        isSandbox: true,
        environment: 'sandbox'
    });

    const sandboxTemplate = getTemplateName(sandboxCsr.csrPem);
    const sandboxCn = verifySubjectCN(sandboxCsr.csrPem);
    console.log("Sandbox Template:", sandboxTemplate);
    console.log("Sandbox CN:", sandboxCn);

    if (sandboxTemplate !== 'TSTZATCA-Code-Signing') {
        throw new Error(`Expected TSTZATCA-Code-Signing template but got: ${sandboxTemplate}`);
    }
    if (sandboxCn.includes('|')) {
        throw new Error(`Sandbox CN contains pipes: ${sandboxCn}`);
    }

    console.log("=== Testing Production CSR Generation ===");
    const prodCsr = zatca.generateCSR(keys.privateKeyPem, null, {
        EGS_SN: '1-SmartTouch|2-POS-9013|3-311167090900003',
        UID: '311167090900003',
        CN: '1-SmartTouch|2-POS-9013|3-311167090900003'.replace(/\|/g, '-'),
        ORG: 'Test',
        OU: 'Head Office',
        IND: 'Retail',
        isSandbox: false,
        environment: 'production'
    });

    const prodTemplate = getTemplateName(prodCsr.csrPem);
    const prodCn = verifySubjectCN(prodCsr.csrPem);
    console.log("Production Template:", prodTemplate);
    console.log("Production CN:", prodCn);

    if (prodTemplate !== 'ZATCA-Code-Signing') {
        throw new Error(`Expected ZATCA-Code-Signing template but got: ${prodTemplate}`);
    }
    if (prodCn.includes('|')) {
        throw new Error(`Production CN contains pipes: ${prodCn}`);
    }

    console.log("SUCCESS! Both Sandbox and Production CSRs are correctly structured and verified!");
}

main().catch(err => {
    console.error("VERIFICATION FAILED:", err);
    process.exit(1);
});
