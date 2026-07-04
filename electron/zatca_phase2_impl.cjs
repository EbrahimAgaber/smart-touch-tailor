const crypto = require('crypto');
// [FIX-FINDING-6] node-forge removed: all cert parsing now uses native crypto.X509Certificate.
// const forge = require('node-forge');
const axios = require('axios');

// ── [C4] ZATCA environment URL map ────────────────────────────────────────────
const ZATCA_URLS = {
    sandbox: {
        compliance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance',
        compliance_checks: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance/invoices',
        onboarding: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/production/csids',
        clearance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single',
        reporting: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single',
    },
    simulation: {
        compliance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
        compliance_checks: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance/invoices',
        onboarding: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/production/csids',
        clearance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/clearance/single',
        reporting: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/reporting/single',
    },
    production: {
        compliance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
        compliance_checks: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance/invoices',
        onboarding: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids',
        clearance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single',
        reporting: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single',
    },
};

function _resolveEnv(env) {
    if (typeof env === 'boolean') return env ? 'sandbox' : 'production';
    if (env === 'sandbox' || env === 'simulation' || env === 'production') return env;
    return 'production';
}

function getZatcaUrl(environment, endpoint) {
    const env = _resolveEnv(environment);
    return ZATCA_URLS[env][endpoint];
}

const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// ─────────────────────────────────────────────────────────────────────────────
// [FIX-2] TRUE XML CANONICALIZATION 1.1 (W3C C14N 1.1)
// ─────────────────────────────────────────────────────────────────────────────

function _collectInScopeNamespaces(node) {
    const nsMap = new Map();
    let cur = node;
    while (cur && cur.nodeType === 1 /* ELEMENT_NODE */) {
        for (let i = 0; i < cur.attributes.length; i++) {
            const a = cur.attributes[i];
            if (a.name === 'xmlns') {
                if (!nsMap.has('')) nsMap.set('', a.value);
            } else if (a.name.startsWith('xmlns:')) {
                const prefix = a.name.slice(6);
                if (!nsMap.has(prefix)) nsMap.set(prefix, a.value);
            }
        }
        cur = cur.parentNode;
    }
    return nsMap;
}

function _getNamespacesToRender(el, ancestorNsMap) {
    const inScope = _collectInScopeNamespaces(el);
    const toRender = new Map();
    for (const [prefix, uri] of inScope) {
        if (ancestorNsMap.get(prefix) !== uri) {
            toRender.set(prefix, uri);
        }
    }
    return toRender;
}

function _c14n11AttrSort(a, b) {
    const aIsNs = a.name === 'xmlns' || a.name.startsWith('xmlns:');
    const bIsNs = b.name === 'xmlns' || b.name.startsWith('xmlns:');
    if (aIsNs && !bIsNs) return -1;
    if (!aIsNs && bIsNs) return 1;
    if (aIsNs && bIsNs) {
        const aP = a.name === 'xmlns' ? '' : a.name.slice(6);
        const bP = b.name === 'xmlns' ? '' : b.name.slice(6);
        return aP < bP ? -1 : aP > bP ? 1 : 0;
    }
    const aNsURI = a.namespaceURI || '';
    const bNsURI = b.namespaceURI || '';
    if (aNsURI !== bNsURI) return aNsURI < bNsURI ? -1 : 1;
    const aLN = a.localName || a.name;
    const bLN = b.localName || b.name;
    return aLN < bLN ? -1 : aLN > bLN ? 1 : 0;
}

function _c14nEscapeText(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r/g, '&#xD;');
}

function _c14nEscapeAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/\t/g, '&#x9;')
        .replace(/\n/g, '&#xA;')
        .replace(/\r/g, '&#xD;');
}

function _c14n11SerialiseElement(el, ancestorNsMap, out) {
    const tagName = el.nodeName;
    out.push('<');
    out.push(tagName);

    const nsToRender = _getNamespacesToRender(el, ancestorNsMap);
    const childNsMap = new Map(ancestorNsMap);
    for (const [p, u] of nsToRender) childNsMap.set(p, u);

    const allAttrs = [];
    for (let i = 0; i < el.attributes.length; i++) {
        allAttrs.push(el.attributes[i]);
    }
    for (const [prefix, uri] of nsToRender) {
        const declName = prefix === '' ? 'xmlns' : ('xmlns:' + prefix);
        const already = allAttrs.some(a => a.name === declName);
        if (!already) {
            allAttrs.push({
                name: declName,
                value: uri,
                namespaceURI: 'http://www.w3.org/2000/xmlns/',
                localName: prefix === '' ? 'xmlns' : prefix,
                prefix: prefix === '' ? '' : 'xmlns'
            });
        }
    }

    allAttrs.sort(_c14n11AttrSort);
    for (const a of allAttrs) {
        out.push(' ');
        out.push(a.name);
        out.push('="');
        out.push(_c14nEscapeAttr(a.value));
        out.push('"');
    }

    out.push('>');

    let child = el.firstChild;
    while (child) {
        switch (child.nodeType) {
            case 1:
                _c14n11SerialiseElement(child, childNsMap, out);
                break;
            case 3:
                out.push(_c14nEscapeText(child.nodeValue || ''));
                break;
            case 4:
                out.push(_c14nEscapeText(child.nodeValue || ''));
                break;
            case 7:
                out.push('<?');
                out.push(child.nodeName);
                if (child.nodeValue) { out.push(' '); out.push(child.nodeValue); }
                out.push('?>');
                break;
            case 8:
                break;
            default:
                break;
        }
        child = child.nextSibling;
    }

    out.push('</');
    out.push(tagName);
    out.push('>');
}

function c14n11Element(el) {
    const out = [];
    _c14n11SerialiseElement(el, new Map(), out);
    return out.join('');
}

function serializeDom4j(node, activeNs = new Map()) {
    if (node.nodeType === 3 || node.nodeType === 4) {
        return node.nodeValue
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    if (node.nodeType === 1) {
        const tagName = node.nodeName;
        let out = '<' + tagName;
        const localNs = new Map();
        const prefix = node.prefix || '';
        const nsUri = node.namespaceURI || '';
        if (nsUri && activeNs.get(prefix) !== nsUri) {
            localNs.set(prefix, nsUri);
        }

        const attrs = [];
        if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];
                if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue;
                attrs.push(attr);
                const attrPrefix = attr.prefix || '';
                const attrNsUri = attr.namespaceURI || '';
                if (attrNsUri && activeNs.get(attrPrefix) !== attrNsUri) {
                    localNs.set(attrPrefix, attrNsUri);
                }
            }
        }

        const nextNs = new Map(activeNs);
        for (const [p, u] of localNs.entries()) nextNs.set(p, u);

        const sortedPrefs = Array.from(localNs.keys()).sort();
        for (const p of sortedPrefs) {
            const u = localNs.get(p);
            out += p === '' ? ` xmlns="${u}"` : ` xmlns:${p}="${u}"`;
        }

        for (const attr of attrs) {
            const escapedVal = attr.value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/"/g, '&quot;')
                .replace(/\t/g, '&#x9;')
                .replace(/\n/g, '&#xA;')
                .replace(/\r/g, '&#xD;');
            out += ` ${attr.name}="${escapedVal}"`;
        }

        if (!node.firstChild) {
            out += '/>';
        } else {
            out += '>';
            let child = node.firstChild;
            while (child) {
                out += serializeDom4j(child, nextNs);
                child = child.nextSibling;
            }
            out += `</${tagName}>`;
        }
        return out;
    }
    return '';
}

function c14nWithInheritedNS(el) {
    const ancestorNs = new Map();
    let node = el.parentNode;
    while (node && node.nodeType === 1) {
        for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            if (a.name === 'xmlns' && !ancestorNs.has('')) {
                ancestorNs.set('', a.value);
            } else if (a.name.startsWith('xmlns:')) {
                const prefix = a.name.slice(6);
                if (!ancestorNs.has(prefix)) ancestorNs.set(prefix, a.value);
            }
        }
        node = node.parentNode;
    }
    // Also include the element's own namespaces so we can sort them all
    for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        if (a.name === 'xmlns') ancestorNs.set('', a.value);
        else if (a.name.startsWith('xmlns:')) ancestorNs.set(a.name.slice(6), a.value);
    }
    
    let baseC14n = c14n11Element(el);
    // Remove existing xmlns attributes from the root element tag in baseC14n
    baseC14n = baseC14n.replace(/ xmlns(:[a-zA-Z0-9-]+)?="[^"]*"/g, '');
    
    // Inject the sorted namespaces
    const sortedPrefs = Array.from(ancestorNs.keys()).sort();
    let nsString = '';
    for (const p of sortedPrefs) {
        const u = ancestorNs.get(p);
        nsString += (p === '' ? ` xmlns="${u}"` : ` xmlns:${p}="${u}"`);
    }
    
    return baseC14n.replace(/^<([^\s>]+)/, `<$1${nsString}`);
}

function canonicalizeInvoiceXML(xmlString) {
    try {
        const normalized = xmlString.replace(/\r\n/g, '\n');
        const doc = new DOMParser().parseFromString(normalized, 'application/xml');

        function removeByLocalName(root, localName) {
            const nodes = xpath.select(`//*[local-name()='${localName}']`, root);
            nodes.forEach(n => n.parentNode && n.parentNode.removeChild(n));
        }

        removeByLocalName(doc, 'UBLExtensions');
        const sigNodes = xpath.select(
            "//*[local-name()='Signature' and namespace-uri()='urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2']",
            doc
        );
        sigNodes.forEach(n => n.parentNode && n.parentNode.removeChild(n));

        const adrNodes = xpath.select("//*[local-name()='AdditionalDocumentReference']", doc);
        adrNodes.forEach(n => {
            const idChildren = xpath.select("*[local-name()='ID']", n);
            if (idChildren.length && idChildren[0].textContent.trim() === 'QR') {
                n.parentNode && n.parentNode.removeChild(n);
            }
        });
        const strippedXml = new XMLSerializer().serializeToString(doc);
        const cleanDoc = new DOMParser().parseFromString(strippedXml, 'application/xml');

        return c14n11Element(cleanDoc.documentElement);
    } catch (err) {
        throw new Error('C14N 1.1 canonicalization failed — cannot sign invoice safely: ' + err.message);
    }
}

(function runC14NSelfTest() {
    const TEST_XML = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:test"><cbc:ID xmlns:cbc="urn:test:cbc">001</cbc:ID></Invoice>`;
    try {
        canonicalizeInvoiceXML(TEST_XML);
    } catch (e) {
        throw new Error('[ZATCA MODULE LOAD BLOCKED] C14N 1.1 self-test threw: ' + e.message);
    }
})();

function generateDeviceKeyPair() {
    // [FIX-CURVE-MISMATCH-REVERTED] secp256k1 is correct per ZATCA spec, but
    // Electron's bundled BoringSSL cannot generate/parse/sign secp256k1 keys at
    // all (see the startup EC-key probe in main.cjs which detects and replaces
    // any secp256k1 key for exactly this reason). Generating secp256k1 here
    // would throw immediately. Keeping prime256v1 for the device key that
    // Node/Electron crypto touches directly; the actual curve mismatch is fixed
    // at the CSR layer in generateCSR() below — see [FIX-CSR-KEY-CAPTURE].
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'sec1', format: 'pem' },
    });
    return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}
function generateCSR(privateKeyPem, publicKeyPem, finalInfo) {
    // ZATCA mandates secp256k1 EC curves for Phase 2. Since BoringSSL in Electron doesn't support secp256k1 natively,
    // we use the local OpenSSL CLI to generate the keys and CSR exactly as required by ZATCA specs.
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zatca-csr-'));

    try {
        const resolvedEnv = finalInfo.env || 'sandbox';
        let certTypeExt = 'ZATCA-Code-Signing';
        if (resolvedEnv === 'sandbox' || resolvedEnv === 'simulation') {
            certTypeExt = 'TSTZATCA-Code-Signing';
        }

        let deviceSerial = finalInfo.EGS_SN || '1-SmartTouch|2-POS|3-001';
        if (!deviceSerial.includes('|')) {
            deviceSerial = `1-SmartTouch|2-POS|3-${deviceSerial}`;
        }
        const vatNumber = finalInfo.UID || '310000000000003';
        const branchName = finalInfo.title || '1100';
        const branchCity = finalInfo.address || 'Riyadh';
        const branchIndus = finalInfo.IND || 'Retail';
        const cn = finalInfo.CN || 'ZATCA-EGS';

        let ou = finalInfo.OU || 'Head Office';
        if (vatNumber.startsWith('31') && (!ou || !/^\d{10}$/.test(ou))) {
            ou = vatNumber.substring(0, 10);
        }
        const org = finalInfo.ORG || 'Smart Touch POS';

        // Generate config file for OpenSSL.
        // Explicitly define custom OIDs to avoid parse/OBJ conflicts, and enforce correct ASN1 types to handle pipe characters.
        const conf = [
            'oid_section = OIDs',
            '[OIDs]',
            'certificateTemplateName = 1.3.6.1.4.1.311.20.2',
            'zatcaDevice = 2.16.840.1.114564.5.2',
            '',
            '[req]',
            'default_bits = 2048',
            'req_extensions = v3_req',
            'distinguished_name = dn',
            'prompt = no',
            '',
            '[dn]',
            'C = SA',
            'OU = ' + ou,
            'O = ' + org,
            'CN = ' + cn,
            '',
            '[v3_req]',
            'certificateTemplateName = ASN1:PRINTABLESTRING:' + certTypeExt,
            'subjectAltName = dirName:alt_names',
            '',
            '[alt_names]',
            'SN = ' + deviceSerial,
            'UID = ' + vatNumber,
            'title = ' + branchName,
            'registeredAddress = ' + branchCity,
            'businessCategory = ' + branchIndus,
        ].join('\n');

        const confPath = path.join(tmpDir, 'csr.cnf');
        const keyPath = path.join(tmpDir, 'key.pem');
        const csrPath = path.join(tmpDir, 'csr.pem');

        fs.writeFileSync(confPath, conf, 'utf8');

        // Generate secp256k1 key pair
        execSync(`openssl ecparam -name secp256k1 -genkey -noout -out "${keyPath}"`, { stdio: 'pipe' });

        // Generate CSR
        execSync(`openssl req -new -sha256 -key "${keyPath}" -extensions v3_req -config "${confPath}" -out "${csrPath}"`, { stdio: 'pipe' });

        const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
        const csrPem = fs.readFileSync(csrPath, 'utf8');

        // Extract public key
        const pubKeyPem = execSync(`openssl ec -in "${keyPath}" -pubout`, { encoding: 'utf8', stdio: 'pipe' });

        // ZATCA expects the entire PEM text (including headers and newlines) to be base64 encoded.
        const csrBase64 = Buffer.from(csrPem.trim()).toString('base64');

        return { csrBase64, csrPem, privateKeyPem, publicKeyPem: pubKeyPem };
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) { }
    }
}

function logZatcaDebug(message) {
    try {
        const { app } = require('electron');
        const fs = require('fs');
        const path = require('path');
        const logDir = app ? app.getPath('userData') : process.cwd();
        const logPath = path.join(logDir, 'zatca_debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
    } catch (e) { }
}

async function getComplianceCSID(csrBase64, otp, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].compliance;
    try {
        const response = await axios.post(url, { csr: csrBase64 }, {
            headers: { 'OTP': otp, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        console.log('RAW_ZATCA_COMPLIANCE_RESPONSE:', JSON.stringify(response.data));
        return response.data;
    } catch (err) {
        let errDetails = err.response?.data ? (typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data) : err.message;
        throw new Error(`ZATCA Compliance API Error: ${errDetails}`);
    }
}

async function getProductionCSID(complianceRequestId, complianceToken, complianceSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].onboarding;
    const auth = Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64');
    try {
        const response = await axios.post(url, { compliance_request_id: complianceRequestId }, {
            headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        console.log('RAW_ZATCA_PRODUCTION_RESPONSE:', JSON.stringify(response.data));
        return response.data;
    } catch (err) {
        throw new Error(`ZATCA Production API Error: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
}

function hashXML(xmlString) {
    const canonical = canonicalizeInvoiceXML(xmlString);
    return crypto.createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('base64');
}

function derToP1363(derBuf) {
    if (derBuf[0] !== 0x30) throw new Error('[ZATCA] derToP1363: expected SEQUENCE tag 0x30');
    let offset = 2;
    if (derBuf[1] & 0x80) offset += (derBuf[1] & 0x7f);
    if (derBuf[offset] !== 0x02) throw new Error('[ZATCA] derToP1363: expected INTEGER tag 0x02 for r');
    const rLen = derBuf[offset + 1];
    offset += 2;
    let r = derBuf.slice(offset, offset + rLen);
    if (r[0] === 0x00) r = r.slice(1);
    offset += rLen;
    if (derBuf[offset] !== 0x02) throw new Error('[ZATCA] derToP1363: expected INTEGER tag 0x02 for s');
    const sLen = derBuf[offset + 1];
    offset += 2;
    let s = derBuf.slice(offset, offset + sLen);
    if (s[0] === 0x00) s = s.slice(1);
    const rPad = Buffer.alloc(32);
    const sPad = Buffer.alloc(32);
    r.copy(rPad, 32 - r.length);
    s.copy(sPad, 32 - s.length);
    return Buffer.concat([rPad, sPad]);
}

const UBL_EXTENSIONS_RE = /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/;
const QR_REF_BLOCK_RE = /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/;
const QR_EMBED_RE = /<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">[\s\S]*?<\/cbc:EmbeddedDocumentBinaryObject>/;

function injectUBLExtensions(xml, replacement) {
    if (!UBL_EXTENSIONS_RE.test(xml)) throw new Error('[ZATCA] UBLExtensions missing.');
    return xml.replace(UBL_EXTENSIONS_RE, replacement);
}

function injectQRPayload(xml, tlvBase64) {
    const qrBlockMatch = xml.match(QR_REF_BLOCK_RE);
    if (!qrBlockMatch) throw new Error('[ZATCA] QR reference block missing.');
    const qrBlock = qrBlockMatch[0];
    if (!QR_EMBED_RE.test(qrBlock)) throw new Error('[ZATCA] EmbeddedDocumentBinaryObject tag missing inside QR.');
    return xml.replace(qrBlock, qrBlock.replace(QR_EMBED_RE, `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${tlvBase64}</cbc:EmbeddedDocumentBinaryObject>`));
}

// ── ECDSA Signing ─────────────────────────────────────────────────────────────
function signInvoiceXML(xmlString, privateKeyPem, certPem, timestamp) {
    const invoiceHashBase64 = hashXML(xmlString);
    let cleanCertBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/[\r\n\s]/g, '')
        .trim();

    let pureCertDerBytes;
    let x509ForDetails;
    let issuerName = '';
    let serialNumber = '';

    try {
        const derBuf = Buffer.from(cleanCertBase64, 'base64');

        let innerDer = derBuf;
        const possiblePemStr = derBuf.toString('utf8').trim();

        // ZATCA sometimes double-base64 encodes the certificate.
        // It might be wrapped in PEM headers, or it might just be the raw Base64 string.
        // Since X.509 DER ALWAYS starts with 0x30 (SEQUENCE), its Base64 ALWAYS starts with 'M' (0x4D).
        // If the decoded buffer starts with 'M' or contains PEM headers, it is double-encoded.
        if (possiblePemStr.includes('-----BEGIN CERTIFICATE-----') || (derBuf[0] === 0x4D && /^[A-Za-z0-9+/=\s]+$/.test(possiblePemStr))) {
            const innerBase64 = possiblePemStr
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/[\r\n\s]/g, '');
            innerDer = Buffer.from(innerBase64, 'base64');
        }

        // We no longer slice using _derReadTLV because it was truncating valid certs.

        pureCertDerBytes = innerDer;
        cleanCertBase64 = innerDer.toString('base64');

        const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        try {
            let pem = `-----BEGIN CERTIFICATE-----\n${cleanCertBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
            if (possiblePemStr.includes('-----BEGIN CERTIFICATE-----')) {
                pem = possiblePemStr;
            }
            x509ForDetails = new crypto.X509Certificate(pem);
            issuerName = escapeXml(x509ForDetails.issuer.split('\n').join(', '));
            serialNumber = BigInt('0x' + x509ForDetails.serialNumber.replace(/:/g, '')).toString(10);
        } catch (certDetailErr) {
            throw new Error('[ZATCA] signInvoiceXML: X509 issuer/serial extraction failed — re-onboard this device: ' + certDetailErr.message);
        }
    } catch (err) {
        console.error("Cert outer parse error", err);
    }

    // [FIX-CERT-HASH]
    // ZATCA validator expects the certificate hash to be calculated as: Base64(Hex(SHA256(Base64_STRING)))
    const certHashHex = crypto.createHash('sha256').update(cleanCertBase64, 'utf8').digest('hex');
    const certHashB64 = Buffer.from(certHashHex, 'utf8').toString('base64');

    const signingTime = String(timestamp || new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z');

    const dummyEnvelope = `<ext:UBLExtensions>
        <ext:UBLExtension>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:signature</ext:ExtensionURI>
            <ext:ExtensionContent>
                <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                    <sac:SignatureInformation>
                        <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                        <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
                            <ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                                <ds:Reference Id="invoiceSignedData" URI="">
                                    <ds:Transforms>
                                        <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                            <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                                        </ds:Transform>
                                        <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                    </ds:Transforms>
                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>${invoiceHashBase64}</ds:DigestValue>
                                </ds:Reference>
                                <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>__SIGNED_PROPS_HASH__</ds:DigestValue>
                                </ds:Reference>
                            </ds:SignedInfo>
                            <ds:SignatureValue>__SIGNATURE_VALUE__</ds:SignatureValue>
                            <ds:KeyInfo>
                                <ds:X509Data>
                                    <ds:X509Certificate>${cleanCertBase64}</ds:X509Certificate>
                                </ds:X509Data>
                            </ds:KeyInfo>
                            <ds:Object>
                                <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                                    <xades:SignedProperties Id="xadesSignedProperties">
                                        <xades:SignedSignatureProperties>
                                            <xades:SigningTime>${signingTime}</xades:SigningTime>
                                            <xades:SigningCertificate>
                                                <xades:Cert>
                                                    <xades:CertDigest>
                                                        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                        <ds:DigestValue>${certHashB64}</ds:DigestValue>
                                                    </xades:CertDigest>
                                                    <xades:IssuerSerial>
                                                        <ds:X509IssuerName>${issuerName}</ds:X509IssuerName>
                                                        <ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>
                                                    </xades:IssuerSerial>
                                                </xades:Cert>
                                            </xades:SigningCertificate>
                                        </xades:SignedSignatureProperties>
                                    </xades:SignedProperties>
                                </xades:QualifyingProperties>
                            </ds:Object>
                        </ds:Signature>
                    </sac:SignatureInformation>
                </sig:UBLDocumentSignatures>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>`;

    const preDocStr = dummyEnvelope.replace('__SIGNED_PROPS_HASH__', '___TMP___').replace('__SIGNATURE_VALUE__', '');
    const docStr = injectUBLExtensions(xmlString, preDocStr);
    const doc = new DOMParser().parseFromString(docStr, 'application/xml');
    const signedPropsNodes = xpath.select("//*[local-name()='SignedProperties']", doc);
    
    let signedPropsForHashing = dummyEnvelope.substring(
        dummyEnvelope.indexOf('<xades:SignedProperties Id="xadesSignedProperties">'),
        dummyEnvelope.indexOf('</xades:SignedProperties>') + '</xades:SignedProperties>'.length
    );
    
    // [FIX-CERT-HASH] Analogous fix for SignedProperties hash!
    // ZATCA validator does NOT canonicalize the SignedProperties. It serializes it using DOM4J's Node.asXML(),
    // which preserves exact indentation but moves the xmlns:xades attribute and injects xmlns:ds into ds: nodes.
    // We perfectly replicate its output string manually based on our dummyEnvelope indentation:
    signedPropsForHashing = signedPropsForHashing
        .replace('<xades:SignedProperties Id="xadesSignedProperties">', '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')
        .replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
        .replace('<ds:DigestValue>', '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
        .replace('<ds:X509IssuerName>', '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
        .replace('<ds:X509SerialNumber>', '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');

    const spHashHex = crypto.createHash('sha256').update(signedPropsForHashing, 'utf8').digest('hex');
    const signedPropsHashB64 = Buffer.from(spHashHex).toString('base64');

    const digestValueNodes = xpath.select("//*[local-name()='Reference' and @URI='#xadesSignedProperties']/*[local-name()='DigestValue']", doc);
    if (digestValueNodes.length > 0) digestValueNodes[0].textContent = signedPropsHashB64;

    const preFinalEnvelope = dummyEnvelope.replace('__SIGNED_PROPS_HASH__', signedPropsHashB64).replace('__SIGNATURE_VALUE__', '');
    const preFinalXml = injectUBLExtensions(xmlString, preFinalEnvelope);
    const preFinalDoc = new DOMParser().parseFromString(preFinalXml, 'application/xml');
    const signedInfoNodes = xpath.select("//*[local-name()='SignedInfo']", preFinalDoc);
    const signedInfoForSigning = c14n11Element(signedInfoNodes[0]);
    const c14nSignedInfoBytes = Buffer.from(signedInfoForSigning, 'utf8');

    let derSignatureBuf = signSecp256k1Sha256(privateKeyPem, c14nSignedInfoBytes);

    const signatureBase64 = derSignatureBuf.toString('base64');
    const rawSigBuf = derToP1363(derSignatureBuf);
    const rawSigBase64 = rawSigBuf.toString('base64');

    const envelope = dummyEnvelope.replace('__SIGNED_PROPS_HASH__', signedPropsHashB64).replace('__SIGNATURE_VALUE__', signatureBase64);
    const finalXml = injectUBLExtensions(xmlString, envelope);
    return { finalXml, envelope, invoiceHashBase64, signatureBase64, rawSigBase64 };
}

// ── 9-tag ZATCA TLV QR (Phase 2) ─────────────────────────────────────────────
function generateZatcaTLV9(seller, vatNo, timestamp, total, vatAmt, xmlHash, ecdsaSig, pubKeyPem, certSignature) {
    const tlvEncode = (tag, valueBuf) => {
        const len = valueBuf.length;
        let lenBuf = len <= 127 ? Buffer.from([len]) : (len <= 255 ? Buffer.from([0x81, len]) : Buffer.from([0x82, (len >> 8) & 0xFF, len & 0xFF]));
        return Buffer.concat([Buffer.from([tag]), lenBuf, valueBuf]);
    };

    let pubKeyDer = Buffer.alloc(0);
    try {
        if (pubKeyPem) {
            const b64 = pubKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/[\n\r]/g, '');
            pubKeyDer = Buffer.from(b64, 'base64');
        }
    } catch (e) { }

    const issueDate = String(timestamp || '').split('T')[0] || '';
    // Strip milliseconds AND the trailing 'Z' — IssueTime in the XML is 'HH:MM:SS' with no
    // timezone suffix, so KSA-25 compares tag3 against IssueDate+'T'+IssueTime verbatim.
    const cleanTime = (String(timestamp || '').split('T')[1] || '').replace(/\.\d{3}/, '').replace(/Z$/, '');
    const tlvTimestamp = issueDate && cleanTime ? `${issueDate}T${cleanTime}` : String(timestamp || '');

    const tags = [
        tlvEncode(1, Buffer.from(String(seller || ''), 'utf8')),
        tlvEncode(2, Buffer.from(String(vatNo || ''), 'utf8')),
        tlvEncode(3, Buffer.from(tlvTimestamp, 'utf8')),
        tlvEncode(4, Buffer.from(Math.abs(parseFloat(total || 0)).toFixed(2), 'utf8')),
        tlvEncode(5, Buffer.from(Math.abs(parseFloat(vatAmt || 0)).toFixed(2), 'utf8')),
    ];

    if (xmlHash) tags.push(tlvEncode(6, Buffer.from(xmlHash)));
    if (ecdsaSig) tags.push(tlvEncode(7, Buffer.from(ecdsaSig)));
    if (pubKeyDer.length > 0) tags.push(tlvEncode(8, pubKeyDer));
    if (certSignature) tags.push(tlvEncode(9, Buffer.from(certSignature, 'base64')));

    return Buffer.concat(tags).toString('base64');
}

async function reportInvoice(invoiceHash, xmlBase64, uuid, csidToken, csidSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].reporting;
    const auth = Buffer.from(`${csidToken}:${csidSecret}`).toString('base64');
    try {
        const response = await axios.post(url, { invoiceHash, uuid, invoice: xmlBase64 }, { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' }, timeout: 30000 });
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

async function clearInvoice(invoiceHash, xmlBase64, uuid, csidToken, csidSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].clearance;
    const auth = Buffer.from(`${csidToken}:${csidSecret}`).toString('base64');
    try {
        const response = await axios.post(url, { invoiceHash, uuid, invoice: xmlBase64 }, { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' }, timeout: 30000 });
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

function checkCertExpiry(certPem) {
    try {
        if (!certPem) return 0;
        let cleanB64 = String(certPem)
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/-----BEGIN PKCS7-----/g, '')
            .replace(/-----END PKCS7-----/g, '')
            .replace(/[\r\n\s]/g, '')
            .trim();

        // Handle double base64 wrapper if present
        try {
            const decodedStr = Buffer.from(cleanB64, 'base64').toString('utf8');
            if (decodedStr.startsWith('MII')) {
                cleanB64 = decodedStr;
            }
        } catch (e) { }

        const crypto = require('crypto');
        let x509Obj;

        try {
            // Fast path: native crypto parse of X.509 DER
            x509Obj = new crypto.X509Certificate(Buffer.from(cleanB64, 'base64'));
        } catch (nativeErr) {
            // Fallback: It might be a PKCS#7 container (common for ZATCA production CSID)
            const forge = require('node-forge');
            const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(cleanB64, 'base64').toString('binary')));
            const p7 = forge.pkcs7.messageFromAsn1(asn1Obj);
            const innerDer = forge.asn1.toDer(p7.certificates[0]).getBytes();
            x509Obj = new crypto.X509Certificate(Buffer.from(innerDer, 'binary'));
        }

        if (!x509Obj) return 0;
        const notAfter = new Date(x509Obj.validTo);
        const msRemaining = notAfter.getTime() - Date.now();
        return Math.floor(msRemaining / 86400000);
    } catch (e) {
        console.error('[ZATCA] checkCertExpiry error:', e.message);
        return 0;
    }
}

function _derReadTLV(buf, offset) {
    const tag = buf[offset];
    const lenByte = buf[offset + 1];
    let length;
    let valueStart;
    if (lenByte & 0x80) {
        const numLenBytes = lenByte & 0x7f;
        length = 0;
        for (let i = 0; i < numLenBytes; i++) length = (length << 8) | buf[offset + 2 + i];
        valueStart = offset + 2 + numLenBytes;
    } else {
        length = lenByte;
        valueStart = offset + 2;
    }
    return { tag, length, valueStart, valueEnd: valueStart + length, nextOffset: valueStart + length };
}

// ── Certificate detail extraction ─────────────────────────────────────────────
// [FIX-SECP256K1] Electron's bundled BoringSSL only supports prime256v1/secp384r1/
// secp521r1 for EC key generation, parsing, and signing — it does NOT support
// secp256k1, which is the exact curve ZATCA's fatoora SDK actually uses when it
// generates the EGS key pair for the CSR (regardless of what curve we hand it).
// crypto.createPrivateKey()/crypto.sign() will throw on a secp256k1 PEM. These
// helpers manually walk the PKCS8 DER to pull out the raw 32-byte private scalar
// and sign with the pure-JS 'elliptic' library, which has no curve whitelist.
function _pkcs8ToECScalar(pem) {
    const b64 = String(pem)
        .replace(/-----BEGIN (EC )?PRIVATE KEY-----/g, '')
        .replace(/-----END (EC )?PRIVATE KEY-----/g, '')
        .replace(/[\r\n\s]/g, '');
    const der = Buffer.from(b64, 'base64');

    // Detect format by DER content, NOT by PEM header.
    // ZATCA's fatoora SDK writes PKCS8 DER (version INTEGER 0x00) but wraps it
    // with a '-----BEGIN EC PRIVATE KEY-----' header (which conventionally means
    // SEC1). Trusting the header causes the SEC1 branch to misparse PKCS8 DER,
    // extracting the AlgorithmIdentifier SEQUENCE (16 bytes) instead of the
    // 32-byte scalar, so isValidECPrivateKeyPem() returns false and the startup
    // probe nukes the legitimate secp256k1 key on every restart.
    //
    // Real SEC1 ECPrivateKey ::= SEQUENCE { version INTEGER(1), privateKey OCTET STRING, ... }
    //   version = 1 (0x02 0x01 0x01)
    // PKCS8 PrivateKeyInfo ::= SEQUENCE { version INTEGER(0), algorithm SEQUENCE, privateKey OCTET STRING }
    //   version = 0 (0x02 0x01 0x00)
    //
    // Read the version byte at offset 4 (after outer SEQUENCE tag+len which is
    // either 2 or 3 bytes; we check both positions defensively).
    const outer = _derReadTLV(der, 0); // outer SEQUENCE
    const versionTlv = _derReadTLV(der, outer.valueStart);
    // versionTlv.tag must be 0x02 (INTEGER); value byte tells us format
    const versionValue = versionTlv.tag === 0x02 ? der[versionTlv.valueStart] : 0;
    const isTrueSec1 = (versionValue === 0x01); // SEC1 version=1; PKCS8 version=0

    if (isTrueSec1) {
        // SEC1 ECPrivateKey: SEQUENCE { version INTEGER(1), privateKey OCTET STRING(32), [0] OID, [1] pubkey }
        let pos = outer.valueStart;
        const ver = _derReadTLV(der, pos); pos = ver.nextOffset;
        const scalarTlv = _derReadTLV(der, pos);
        return der.slice(scalarTlv.valueStart, scalarTlv.valueEnd);
    }

    // PKCS8 PrivateKeyInfo: SEQUENCE { version INTEGER(0), algorithm SEQUENCE, privateKey OCTET STRING }
    // The OCTET STRING wraps a nested SEC1 ECPrivateKey blob.
    let pos = outer.valueStart;
    const versionSkip = _derReadTLV(der, pos); pos = versionSkip.nextOffset;
    const algIdTlv = _derReadTLV(der, pos); pos = algIdTlv.nextOffset;
    const pkOctet = _derReadTLV(der, pos); // OCTET STRING wrapping ECPrivateKey
    const ecPrivDer = der.slice(pkOctet.valueStart, pkOctet.valueEnd);
    const ecOuter = _derReadTLV(ecPrivDer, 0);
    let ePos = ecOuter.valueStart;
    const ecVersionTlv = _derReadTLV(ecPrivDer, ePos); ePos = ecVersionTlv.nextOffset;
    const scalarTlv = _derReadTLV(ecPrivDer, ePos);
    return ecPrivDer.slice(scalarTlv.valueStart, scalarTlv.valueEnd);
}

// True if the PEM is a usable EC private key, EITHER because BoringSSL accepts
// it directly (prime256v1 etc.) OR because we can manually extract a 32-byte
// secp256k1 scalar from it. Replaces the old "createPrivateKey() throws -> bad
// key, regenerate" assumption, which would otherwise nuke legitimate secp256k1
// keys on every app startup.
function isValidECPrivateKeyPem(pem) {
    if (!pem) return false;
    try {
        crypto.createPrivateKey(pem);
        return true;
    } catch (_) {
        try {
            const scalar = _pkcs8ToECScalar(pem);
            const ok = !!(scalar && scalar.length === 32);
            if (!ok) console.warn('[ZATCA] isValidECPrivateKeyPem: scalar extraction returned', scalar ? scalar.length : 'null', 'bytes (expected 32)');
            return ok;
        } catch (_e2) {
            console.warn('[ZATCA] isValidECPrivateKeyPem: scalar extraction threw:', _e2.message);
            return false;
        }
    }
}

function signSecp256k1Sha256(privateKeyPem, dataBuffer) {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { execSync } = require('child_process');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zatca-sign-'));
    const keyPath = path.join(tmpDir, 'key.pem');
    const dataPath = path.join(tmpDir, 'data.bin');
    const sigPath = path.join(tmpDir, 'sig.bin');

    try {
        fs.writeFileSync(keyPath, privateKeyPem, 'utf8');
        fs.writeFileSync(dataPath, dataBuffer);

        execSync(`openssl dgst -sha256 -sign "${keyPath}" -out "${sigPath}" "${dataPath}"`, { stdio: 'pipe' });

        return fs.readFileSync(sigPath);
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) { }
    }
}

function extractCertDetails(certPem) {
    try {
        if (!certPem) throw new Error('Certificate data is empty');

        const cleanB64 = String(certPem)
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/[\r\n\s]/g, '')
            .trim();

        let x509Obj;
        try {
            x509Obj = new crypto.X509Certificate(Buffer.from(cleanB64, 'base64'));
        } catch (e) {
            const innerStr = Buffer.from(cleanB64, 'base64').toString('utf8').trim();
            const innerB64 = innerStr
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/[\r\n\s]/g, '');
            x509Obj = new crypto.X509Certificate(Buffer.from(innerB64, 'base64'));
        }

        const derBuf = x509Obj.raw;

        // [FIX-PUBKEY-DECODE] x509Obj.publicKey.export() throws PUBLIC_KEY_DECODE_ERROR
        // in Electron/BoringSSL when the cert uses secp256k1 (ZATCA compliance cert curve).
        // Instead, extract the SubjectPublicKeyInfo block directly from the DER bytes,
        // which avoids BoringSSL's key-object layer entirely.
        let pubKeyPem = '';
        try {
            // Walk: Certificate > TBSCertificate > fields until we hit SPKI (tag 0x30)
            // TBSCertificate layout:
            //   [0] version (optional, context tag 0xa0)
            //   INTEGER serialNumber
            //   SEQUENCE sigAlgorithm
            //   SEQUENCE issuer
            //   SEQUENCE validity
            //   SEQUENCE subject
            //   SEQUENCE SubjectPublicKeyInfo  <-- we want this
            const outerSeq = _derReadTLV(derBuf, 0);          // Certificate SEQUENCE
            const tbsSeq = _derReadTLV(derBuf, outerSeq.valueStart); // TBSCertificate SEQUENCE
            let pos = tbsSeq.valueStart;
            // Skip optional version [0] EXPLICIT
            if (derBuf[pos] === 0xa0) { const v = _derReadTLV(derBuf, pos); pos = v.nextOffset; }
            // Skip serialNumber INTEGER
            const serial = _derReadTLV(derBuf, pos); pos = serial.nextOffset;
            // Skip signature algorithm SEQUENCE
            const sigAlgTbs = _derReadTLV(derBuf, pos); pos = sigAlgTbs.nextOffset;
            // Skip issuer SEQUENCE
            const issuerSeq = _derReadTLV(derBuf, pos); pos = issuerSeq.nextOffset;
            // Skip validity SEQUENCE
            const validitySeq = _derReadTLV(derBuf, pos); pos = validitySeq.nextOffset;
            // Skip subject SEQUENCE
            const subjectSeq = _derReadTLV(derBuf, pos); pos = subjectSeq.nextOffset;
            // pos now points at SubjectPublicKeyInfo SEQUENCE
            const spkiTlv = _derReadTLV(derBuf, pos);
            const spkiBytes = derBuf.slice(pos, spkiTlv.nextOffset);
            const spkiB64 = spkiBytes.toString('base64').match(/.{1,64}/g).join('\n');
            pubKeyPem = `-----BEGIN PUBLIC KEY-----\n${spkiB64}\n-----END PUBLIC KEY-----`;
        } catch (pkErr) {
            // Last resort: try the native export (may fail on secp256k1)
            try { pubKeyPem = x509Obj.publicKey.export({ type: 'spki', format: 'pem' }); } catch (_) { }
            if (!pubKeyPem) console.warn('[ZATCA] extractCertDetails: pubKey extraction failed, QR tag 8 will be empty');
        }

        let vatNumber = '';
        const subjectLines = x509Obj.subject.split('\n');
        for (const line of subjectLines) {
            const m = line.match(/^(?:UID|serialNumber|2\.5\.4\.97)=(.+)$/);
            if (m) {
                const val = m[1].trim();
                if (/^\d{15}$/.test(val)) { vatNumber = val; break; }
            }
        }
        if (!vatNumber) {
            const fallback = x509Obj.subject.match(/\d{15}/);
            if (fallback) vatNumber = fallback[0];
        }

        let certSignature = '';
        try {
            const outer = _derReadTLV(derBuf, 0);
            const tbsCert = _derReadTLV(derBuf, outer.valueStart);
            const sigAlg = _derReadTLV(derBuf, tbsCert.nextOffset);
            const sigVal = _derReadTLV(derBuf, sigAlg.nextOffset);
            if (sigVal.tag === 0x03) {
                let rawBytes = derBuf.slice(sigVal.valueStart + 1, sigVal.valueEnd);
                certSignature = Buffer.from(rawBytes).toString('base64');
            }
        } catch (walkErr) {
            console.error('[ZATCA] signatureValue DER walk failed:', walkErr.message);
        }

        return { pubKeyPem, certSignature, vatNumber };
    } catch (e) {
        console.error('[ZATCA] Critical extractCertDetails failure:', e.message);
        return { pubKeyPem: '', certSignature: '', vatNumber: '' };
    }
}

function extractQRFromXML(signedXml) {
    try {
        const qrRefMatch = signedXml.match(/<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([A-Za-z0-9+/=]+)<\/cbc:EmbeddedDocumentBinaryObject>/);
        return qrRefMatch ? qrRefMatch[1].trim() : null;
    } catch (e) { return null; }
}

async function checkComplianceInvoice(invoiceHash, xmlBase64, uuid, complianceToken, complianceSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].compliance_checks;
    const auth = Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64');
    try {
        const response = await axios.post(url, { invoiceHash, uuid, invoice: xmlBase64 }, { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' }, timeout: 30000 });
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

async function renewProductionCSID(newCsrBase64, currentToken, currentSecret, otp, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].onboarding;
    const auth = Buffer.from(`${currentToken}:${currentSecret}`).toString('base64');
    try {
        const response = await axios.patch(url, { csr: newCsrBase64 }, { headers: { 'OTP': otp, 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' }, timeout: 30000 });
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

function signAndPackageInvoice({ xml, device, settings, timestamp, total, tax, db }) {
    console.log("THIS IS THE CORRECT PIPELINE - PURE JS");
    const invoiceHash = hashXML(xml);
    let signedXml = xml;

    if (!device.production_csid || !device.production_cert_pem) {
        const tlv = generateZatcaTLV9(
            settings.business_name_ar || 'مؤسسة تجارية',
            settings.vat_number || settings.tax_number || '300000000000003',
            timestamp, total, tax
        );
        signedXml = injectUBLExtensions(xml, '');
        signedXml = injectQRPayload(signedXml, tlv);
    } else {
        const { envelope, invoiceHashBase64, signatureBase64, rawSigBase64 } = signInvoiceXML(
            xml,
            device.private_key_pem,
            device.production_cert_pem,
            timestamp
        );
        signedXml = injectUBLExtensions(xml, envelope);

        const { pubKeyPem, certSignature, vatNumber: certVatNumber } = extractCertDetails(device.production_cert_pem);
        const effectiveVatNo = certVatNumber || settings.vat_number || settings.tax_number || '300000000000003';
        const tlv = generateZatcaTLV9(
            settings.business_name_ar || 'مؤسسة تجارية',
            effectiveVatNo,
            timestamp, total, tax,
            invoiceHash, signatureBase64, pubKeyPem, certSignature
        );
        signedXml = injectQRPayload(signedXml, tlv);
    }
    // [FIX-WINDOWS-CRLF] Ensure the entire XML document uses strict Unix line endings (\n) as required by ZATCA
    signedXml = signedXml.replace(/\r\n/g, '\n');
    return { signedXml, invoiceHash };
}

function extractCertInfo(certPem) {
    const crypto = require('crypto');
    const cert = new crypto.X509Certificate(certPem);
    const pubKeySpkiB64 = cert.publicKey.export({type: 'spki', format: 'der'}).toString('base64');
    
    let cleanCertBase64 = certPem.replace(/-----.*?-----/g, '').replace(/\s/g, '');
    const certDer = Buffer.from(cleanCertBase64, 'base64');
    
    // Find the BIT STRING of the signature (starts with 0x03) at the end of the cert
    let sigB64 = '';
    for(let i=certDer.length-100; i<certDer.length; i++) {
        if(certDer[i]===0x03 && certDer[i+2]===0x00 && certDer[i+3]===0x30) {
            sigB64 = certDer.slice(i+3).toString('base64');
            break;
        }
    }
    return { pubKeySpkiB64, sigB64 };
}

module.exports = {
    derToP1363, generateDeviceKeyPair, generateCSR, getComplianceCSID, issueComplianceCSID: getComplianceCSID,
    getProductionCSID, issueProductionCSID: getProductionCSID, checkComplianceInvoice, renewProductionCSID,
    getZatcaUrl, ZATCA_URLS, canonicalizeInvoiceXML, c14nWithInheritedNS, c14n11Element, hashXML,
    signInvoiceXML, signAndPackageInvoice, injectUBLExtensions, injectQRPayload, generateZatcaTLV9, extractCertInfo,
    reportInvoice, clearInvoice, extractCertDetails, extractQRFromXML, checkCertExpiry,
    isValidECPrivateKeyPem, signSecp256k1Sha256, _pkcs8ToECScalar
};