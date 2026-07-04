const crypto = require('crypto');
const forge  = require('node-forge');
const asn1   = forge.asn1;
const axios  = require('axios');
const path   = require('path');
const EC     = require('elliptic').ec;
const ec     = new EC('secp256k1');

// ── Private Key Extraction Helper ─────────────────────────────────────────────
function extractPrivateKeyHex(pem) {
    const msg = forge.pem.decode(pem)[0];
    const asn1Obj = forge.asn1.fromDer(msg.body);
    if (asn1Obj.value[1].type === forge.asn1.Type.SEQUENCE && asn1Obj.value[2].type === forge.asn1.Type.OCTETSTRING) {
        // PKCS#8 format
        const ecPrivateKeyAsn1 = forge.asn1.fromDer(asn1Obj.value[2].value);
        return forge.util.bytesToHex(ecPrivateKeyAsn1.value[1].value);
    } else if (asn1Obj.value[1].type === forge.asn1.Type.OCTETSTRING) {
        // SEC1 format
        return forge.util.bytesToHex(asn1Obj.value[1].value);
    }
    throw new Error('Unsupported PEM format for EC private key');
}

function signEcdsaSha256(dataBuffer, privateKeyPem) {
    const dHex = extractPrivateKeyHex(privateKeyPem);
    const hash = crypto.createHash('sha256').update(dataBuffer).digest();
    const keyPair = ec.keyFromPrivate(dHex, 'hex');
    const signatureDerArray = keyPair.sign(hash).toDER();
    return Buffer.from(signatureDerArray);
}

// ── [C4] ZATCA environment URL map ────────────────────────────────────────────
const ZATCA_URLS = {
    sandbox: {
        compliance:        'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance',
        compliance_checks: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance/invoices',
        onboarding:        'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/production/csids',
        clearance:         'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single',
        reporting:         'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single',
    },
    simulation: {
        compliance:        'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
        compliance_checks: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance/invoices',
        onboarding:        'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/production/csids',
        clearance:         'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/clearance/single',
        reporting:         'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/reporting/single',
    },
    production: {
        compliance:        'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
        compliance_checks: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance/invoices',
        onboarding:        'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids',
        clearance:         'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single',
        reporting:         'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single',
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
// Algorithm URI: http://www.w3.org/2006/12/xml-c14n11
//
// ZATCA mandates C14N 1.1 in ds:CanonicalizationMethod and all Transform
// references. xml-crypto's built-in C14nCanonicalization implements C14N 1.0
// Inclusive only. This implementation provides compliant C14N 1.1 processing
// with correct attribute inheritance, namespace rendering, and newline
// normalization per W3C Canonical XML 1.1 (https://www.w3.org/TR/xml-c14n11/).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all in-scope namespace bindings for a node by walking ancestors.
 * Returns a Map<prefix, uri> where '' is the default namespace.
 */
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

/**
 * Determine which namespace declarations need to be rendered on this element
 * for C14N 1.1 (render all in-scope namespaces that are not already rendered
 * on a visible ancestor in the output document, plus any used by this element
 * or its attributes that are not yet rendered).
 *
 * For our use-case (serialising subtrees for signing), we always render the
 * full in-scope namespace set on the root of each subtree to ensure the output
 * is self-contained and deterministic.
 */
function _getNamespacesToRender(el, ancestorNsMap) {
    const inScope = _collectInScopeNamespaces(el);
    const toRender = new Map();

    // Render all in-scope namespaces not already declared identically on an
    // ancestor visible in this serialisation context.
    for (const [prefix, uri] of inScope) {
        if (ancestorNsMap.get(prefix) !== uri) {
            toRender.set(prefix, uri);
        }
    }
    return toRender;
}

/**
 * C14N 1.1 attribute sort comparator.
 * Namespace declarations first (sorted by prefix), then non-namespace
 * attributes sorted by namespace URI then local name.
 */
function _c14n11AttrSort(a, b) {
    const aIsNs = a.name === 'xmlns' || a.name.startsWith('xmlns:');
    const bIsNs = b.name === 'xmlns' || b.name.startsWith('xmlns:');
    if (aIsNs && !bIsNs) return -1;
    if (!aIsNs && bIsNs) return 1;
    if (aIsNs && bIsNs) {
        // Both namespace: sort by prefix (default '' < prefixed)
        const aP = a.name === 'xmlns' ? '' : a.name.slice(6);
        const bP = b.name === 'xmlns' ? '' : b.name.slice(6);
        return aP < bP ? -1 : aP > bP ? 1 : 0;
    }
    // Both non-namespace: sort by namespaceURI then localName
    const aNsURI = a.namespaceURI || '';
    const bNsURI = b.namespaceURI || '';
    if (aNsURI !== bNsURI) return aNsURI < bNsURI ? -1 : 1;
    const aLN = a.localName || a.name;
    const bLN = b.localName || b.name;
    return aLN < bLN ? -1 : aLN > bLN ? 1 : 0;
}

/**
 * Escape text content per C14N 1.1 rules.
 */
function _c14nEscapeText(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r/g, '&#xD;');
}

/**
 * Escape attribute value per C14N 1.1 rules.
 */
function _c14nEscapeAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/\t/g, '&#x9;')
        .replace(/\n/g, '&#xA;')
        .replace(/\r/g, '&#xD;');
}

/**
 * Recursively serialise a DOM element subtree using C14N 1.1 rules.
 * @param {Element} el              - Current element node
 * @param {Map}     ancestorNsMap   - Namespace declarations already rendered on ancestors
 * @param {string[]} out            - Output buffer (array of strings for efficiency)
 */
function _c14n11SerialiseElement(el, ancestorNsMap, out) {
    const tagName = el.nodeName;
    out.push('<');
    out.push(tagName);

    // Determine which namespace declarations to render on this element
    const nsToRender = _getNamespacesToRender(el, ancestorNsMap);

    // Build the merged namespace map for children
    const childNsMap = new Map(ancestorNsMap);
    for (const [p, u] of nsToRender) childNsMap.set(p, u);

    // Collect all attributes (namespace decls + regular) for sorting
    const allAttrs = [];
    for (let i = 0; i < el.attributes.length; i++) {
        allAttrs.push(el.attributes[i]);
    }
    // Add any namespace declarations that need to be rendered but aren't on el.attributes
    for (const [prefix, uri] of nsToRender) {
        const declName = prefix === '' ? 'xmlns' : ('xmlns:' + prefix);
        const already  = allAttrs.some(a => a.name === declName);
        if (!already) {
            // Synthesise a pseudo-attribute object
            allAttrs.push({ name: declName, value: uri, namespaceURI: 'http://www.w3.org/2000/xmlns/', localName: declName });
        }
    }

    // Sort attributes per C14N 1.1
    allAttrs.sort(_c14n11AttrSort);

    for (const a of allAttrs) {
        out.push(' ');
        out.push(a.name);
        out.push('="');
        out.push(_c14nEscapeAttr(a.value));
        out.push('"');
    }

    out.push('>');

    // Recurse into children
    let child = el.firstChild;
    while (child) {
        switch (child.nodeType) {
            case 1: // ELEMENT_NODE
                _c14n11SerialiseElement(child, childNsMap, out);
                break;
            case 3: // TEXT_NODE
                out.push(_c14nEscapeText(child.nodeValue || ''));
                break;
            case 4: // CDATA_SECTION_NODE → expand to text in C14N
                out.push(_c14nEscapeText(child.nodeValue || ''));
                break;
            case 7: // PROCESSING_INSTRUCTION_NODE
                out.push('<?');
                out.push(child.nodeName);
                if (child.nodeValue) { out.push(' '); out.push(child.nodeValue); }
                out.push('?>');
                break;
            case 8: // COMMENT_NODE — omitted in C14N without-comments
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

/**
 * Canonicalise a DOM Element to a C14N 1.1 string.
 * The element is treated as the root of the serialised subtree.
 * All ancestor namespace bindings are inherited and rendered on the root tag.
 */
function c14n11Element(el) {
    const out = [];
    _c14n11SerialiseElement(el, new Map(), out);
    return out.join('');
}

// ── C14N 1.1 for signature subtrees (with inherited ancestor namespaces) ──────
// Used for ds:SignedInfo and xades:SignedProperties serialisation before hashing.
function c14nWithInheritedNS(el) {
    // Collect all ancestor namespace bindings to inherit into the rendered root
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

    // Serialise with C14N 1.1, providing an empty ancestor map so all in-scope
    // namespaces get rendered on the root element of the subtree.
    const out = [];
    _c14n11SerialiseElement(el, new Map(), out);
    return out.join('');
}

// ── C14N 1.1 for the Invoice element (strips UBLExtensions, cac:Signature, QR)
function canonicalizeInvoiceXML(xmlString) {
    try {
        const doc = new DOMParser().parseFromString(xmlString, 'application/xml');

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

        // Re-serialise stripped document then apply C14N 1.1
        const strippedXml = new XMLSerializer().serializeToString(doc);
        const cleanDoc    = new DOMParser().parseFromString(strippedXml, 'application/xml');

        return c14n11Element(cleanDoc.documentElement);
    } catch (err) {
        throw new Error('C14N 1.1 canonicalization failed — cannot sign invoice safely: ' + err.message);
    }
}

// ── Startup C14N 1.1 self-test ────────────────────────────────────────────────
(function runC14NSelfTest() {
    const TEST_XML = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:test"><cbc:ID xmlns:cbc="urn:test:cbc">001</cbc:ID></Invoice>`;
    let result;
    try {
        result = canonicalizeInvoiceXML(TEST_XML);
    } catch (e) {
        throw new Error('[ZATCA MODULE LOAD BLOCKED] C14N 1.1 self-test threw: ' + e.message);
    }
    if (!result || typeof result !== 'string' || result.indexOf('<Invoice') === -1) {
        throw new Error(
            '[ZATCA MODULE LOAD BLOCKED] C14N 1.1 self-test produced invalid output. Got: ' + String(result).slice(0, 120)
        );
    }
})();

// ─────────────────────────────────────────────────────────────────────────────
// ZATCA PHASE 2 CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// ── Key pair generation ───────────────────────────────────────────────────────
// NOTE: Electron's BoringSSL strips secp256k1 support entirely — even
// crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' }) throws
// UNKNOWN_GROUP. We generate the keypair in pure-JS via `elliptic` then
// DER-encode it to standard PKCS#8 (private) and SPKI (public) PEM so the
// rest of the pipeline (forge ASN.1 builder, openssl, DB storage) is unaffected.
function generateDeviceKeyPair() {
    const keyPair = ec.genKeyPair();
    const dHex = keyPair.getPrivate('hex').padStart(64, '0');
    const pubPoint = keyPair.getPublic();
    const uncompressedHex = pubPoint.encode('hex', false); // 04 || x || y

    const dBuf = Buffer.from(dHex, 'hex');
    const pubBuf = Buffer.from(uncompressedHex, 'hex');
    const _asn1 = forge.asn1;

    // ECPrivateKey (RFC 5915) — wraps d scalar + public point
    const ecPrivateKey = _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.SEQUENCE, true, [
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.INTEGER, false, String.fromCharCode(0x01)),
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.OCTETSTRING, false,
            forge.util.createBuffer(dBuf).getBytes()),
        _asn1.create(_asn1.Class.CONTEXT_SPECIFIC, 1, true, [
            _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.BITSTRING, false,
                String.fromCharCode(0x00) + forge.util.createBuffer(pubBuf).getBytes()),
        ]),
    ]);
    const ecPrivateKeyDer = _asn1.toDer(ecPrivateKey).getBytes();

    // PKCS#8 PrivateKeyInfo
    const pkcs8 = _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.SEQUENCE, true, [
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.INTEGER, false, String.fromCharCode(0x00)),
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.SEQUENCE, true, [
            _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.OID, false,
                _asn1.oidToDer('1.2.840.10045.2.1').getBytes()),  // ecPublicKey
            _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.OID, false,
                _asn1.oidToDer('1.3.132.0.10').getBytes()),        // secp256k1
        ]),
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.OCTETSTRING, false, ecPrivateKeyDer),
    ]);

    // SPKI SubjectPublicKeyInfo
    const spki = _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.SEQUENCE, true, [
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.SEQUENCE, true, [
            _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.OID, false,
                _asn1.oidToDer('1.2.840.10045.2.1').getBytes()),
            _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.OID, false,
                _asn1.oidToDer('1.3.132.0.10').getBytes()),
        ]),
        _asn1.create(_asn1.Class.UNIVERSAL, _asn1.Type.BITSTRING, false,
            String.fromCharCode(0x00) + forge.util.createBuffer(pubBuf).getBytes()),
    ]);

    const privateKeyPem = forge.pem.encode({ type: 'PRIVATE KEY', body: _asn1.toDer(pkcs8).getBytes() });
    const publicKeyPem  = forge.pem.encode({ type: 'PUBLIC KEY',  body: _asn1.toDer(spki).getBytes()  });

    return { privateKeyPem, publicKeyPem };
}


// ── CSR generation — pure in-memory, no OpenSSL / temp files ──────────────────
//
// IMPORTANT ENGINEERING NOTE: ZATCA mandates secp256k1 EC keys (see
// generateDeviceKeyPair above) — not RSA. node-forge's `pki.privateKeyFromPem`
// / `pki.createCertificationRequest().sign()` path only understands RSA keys
// internally, so it cannot parse or sign with our EC private key. To keep this
// 100% pure-JS and in-memory (no execSync, no OpenSSL, no temp files) we use
// forge purely as an ASN.1 builder/DER-encoder (subject RDNs, SPKI passthrough,
// the ZATCA custom extensions) and delegate the actual ECDSA-SHA256 signing
// operation to Node's native `crypto`, which natively supports secp256k1.
function generateCSR(privateKeyPem, publicKeyPem, info) {
    const asn1 = forge.asn1;

    let templateName = 'ZATCA-Code-Signing';
    const resolvedEnv = _resolveEnv(info.environment || info.isSandbox);
    if (resolvedEnv === 'sandbox') {
        templateName = 'TESTZATCA-Code-Signing';
    } else if (resolvedEnv === 'simulation') {
        templateName = 'PREZATCA-Code-Signing';
    }

    const ORG    = info.ORG    || 'Smart Touch POS';
    const OU     = info.OU     || 'Main Branch';
    const CN     = info.CN     || 'ZATCA-EGS';
    let EGS_SN = info.EGS_SN || '1-SmartTouch|2-POS|3-001';
    if (!EGS_SN.includes('|')) {
        EGS_SN = `1-SmartTouch|2-POS|3-${EGS_SN}`;
    }
    const UID    = info.UID    || '310000000000003';
    const IND    = info.IND    || 'Retail';

    // ── Subject Name RDNs: C=SA, O, OU, CN ────────────────────────────────────
    function rdn(oid, value, valueType) {
        return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
                asn1.create(asn1.Class.UNIVERSAL, valueType || asn1.Type.UTF8, false, value),
            ]),
        ]);
    }

    const subjectAttrs = [
        rdn('2.5.4.6',  'SA', asn1.Type.PRINTABLESTRING), // C
        rdn('2.5.4.10', ORG),                              // O
        rdn('2.5.4.11', OU),                               // OU
        rdn('2.5.4.3',  CN),                               // CN
    ];
    const subject = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, subjectAttrs);

    // ── SubjectPublicKeyInfo — lifted directly from the SPKI PEM (EC keys
    // pass straight through forge's ASN.1 parser; only forge.pki's high-level
    // RSA-oriented helpers are off-limits here) ───────────────────────────────
    const spkiDer  = forge.pem.decode(publicKeyPem)[0].body;
    const spkiAsn1 = asn1.fromDer(forge.util.createBuffer(spkiDer));

    // ── Extension builder ─────────────────────────────────────────────────────
    function extension(oid, valueAsn1) {
        return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, asn1.toDer(valueAsn1).getBytes()),
        ]);
    }

    // 1.3.6.1.4.1.311.20.2 — Certificate Template Name
    const templateExt = extension(
        '1.3.6.1.4.1.311.20.2',
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTF8, false, templateName)
    );

    // 2.5.29.17 — subjectAltName: directoryName GeneralName wrapping the
    // same C/O/OU/CN RDN sequence, per ZATCA's strict onboarding schema.
    const directoryName = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, subjectAttrs);
    const generalNameDirectoryName = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 4, true, [directoryName]);
    const sanExt = extension(
        '2.5.29.17',
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [generalNameDirectoryName])
    );

    // ZATCA proprietary attribute extensions
    const egsSnExt = extension('1.2.3.4.5.6.7.8.1', asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTF8, false, EGS_SN));
    const vatExt    = extension('1.2.3.4.5.6.7.8.2', asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTF8, false, UID));
    const indExt    = extension('1.2.3.4.5.6.7.8.3', asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTF8, false, IND));

    const extensionsSeq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        templateExt, sanExt, egsSnExt, vatExt, indExt,
    ]);

    // extensionRequest attribute (PKCS#9, OID 1.2.840.113549.1.9.14):
    // Attribute ::= SEQUENCE { type OID, values SET OF Extensions }
    const extensionRequestAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer('1.2.840.113549.1.9.14').getBytes()),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [extensionsSeq]),
    ]);

    // CertificationRequestInfo.attributes is [0] IMPLICIT SET
    const attributes = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [extensionRequestAttr]);

    // ── CertificationRequestInfo ───────────────────────────────────────────────
    const version = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(0x00));
    const cri = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        version, subject, spkiAsn1, attributes,
    ]);
    const criDer = Buffer.from(asn1.toDer(cri).getBytes(), 'binary');

    // ── Sign the CRI with the device's secp256k1 private key (ECDSA-SHA256) ───
    const derSignature = signEcdsaSha256(criDer, privateKeyPem); // already DER-encoded ECDSA sig

    // ecdsa-with-SHA256 = 1.2.840.10045.4.3.2 (no parameters for EC sig algs)
    const signatureAlgorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer('1.2.840.10045.4.3.2').getBytes()),
    ]);
    const signatureValue = asn1.create(
        asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false,
        String.fromCharCode(0x00) + derSignature.toString('binary')
    );

    const csrAsn1 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        cri, signatureAlgorithm, signatureValue,
    ]);

    const csrDer    = asn1.toDer(csrAsn1).getBytes();
    const csrPem    = forge.pem.encode({ type: 'CERTIFICATE REQUEST', body: csrDer });
    const csrBase64 = forge.util.encode64(csrDer);

    return { csrBase64, csrPem };
}

// ── ZATCA Compliance API ──────────────────────────────────────────────────────
async function getComplianceCSID(csrBase64, otp, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].compliance;
    try {
        const response = await axios.post(url, { csr: csrBase64 }, {
            headers: { 'OTP': otp, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (err) {
        throw new Error(`ZATCA Compliance API Error: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
}

async function getProductionCSID(complianceRequestId, complianceToken, complianceSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].onboarding;
    const auth = Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64');
    try {
        const response = await axios.post(url, { compliance_request_id: complianceRequestId }, {
            headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (err) {
        throw new Error(`ZATCA Production API Error: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
}

// Compute base64 hash from C14N 1.1 canonical form
function hashXML(xmlString) {
    const canonical = canonicalizeInvoiceXML(xmlString);
    return crypto.createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('base64');
}

// ── DER → IEEE P1363 signature converter ────────────────────────────────────
function derToP1363(derBuf) {
    if (derBuf[0] !== 0x30) throw new Error('[ZATCA] derToP1363: expected SEQUENCE tag 0x30, got 0x' + derBuf[0].toString(16));

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

// ─────────────────────────────────────────────────────────────────────────────
// [FIX-PLACEHOLDER] Structural XML injection — targets the REAL tags emitted
// by generateUBL21XML() (zatca_utils.cjs) instead of nonexistent comment
// markers. Both helpers THROW LOUDLY if their anchor structure is missing, so
// a future template change breaks immediately instead of silently shipping
// unsigned / un-QR'd invoices to ZATCA.
// ─────────────────────────────────────────────────────────────────────────────
const UBL_EXTENSIONS_RE = /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/;
const QR_REF_BLOCK_RE   = /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/;
const QR_EMBED_RE       = /<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">[\s\S]*?<\/cbc:EmbeddedDocumentBinaryObject>/;

/**
 * Replace the existing <ext:UBLExtensions>...</ext:UBLExtensions> block (the
 * empty skeleton emitted by generateUBL21XML) with `replacement`. Pass '' to
 * strip the block entirely (unsigned / pre-CSID path).
 */
function injectUBLExtensions(xml, replacement) {
    if (!UBL_EXTENSIONS_RE.test(xml)) {
        throw new Error('[ZATCA] injectUBLExtensions: <ext:UBLExtensions> block not found in XML — refusing to silently skip signature assembly.');
    }
    return xml.replace(UBL_EXTENSIONS_RE, replacement);
}

/**
 * Inject the Base64 TLV QR payload into the <cbc:EmbeddedDocumentBinaryObject>
 * tag that lives inside the AdditionalDocumentReference whose <cbc:ID> is
 * "QR" (NOT the ICV or PIH references, which share the same parent tag name).
 */
function injectQRPayload(xml, tlvBase64) {
    const qrBlockMatch = xml.match(QR_REF_BLOCK_RE);
    if (!qrBlockMatch) {
        throw new Error('[ZATCA] injectQRPayload: QR AdditionalDocumentReference block not found in XML — refusing to silently skip QR injection.');
    }
    const qrBlock = qrBlockMatch[0];
    if (!QR_EMBED_RE.test(qrBlock)) {
        throw new Error('[ZATCA] injectQRPayload: EmbeddedDocumentBinaryObject tag not found inside QR reference block.');
    }
    const patchedBlock = qrBlock.replace(
        QR_EMBED_RE,
        `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${tlvBase64}</cbc:EmbeddedDocumentBinaryObject>`
    );
    return xml.replace(qrBlock, patchedBlock);
}

// ── ECDSA Signing ─────────────────────────────────────────────────────────────
function signInvoiceXML(xmlString, privateKeyPem, certPem, timestamp) {
    const invoiceHashBase64 = hashXML(xmlString);

    const cleanCertBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/[\n\r]/g, '');
    const certHashHex = crypto.createHash('sha256').update(cleanCertBase64, 'utf8').digest('hex');
    const certHashB64 = Buffer.from(certHashHex, 'utf8').toString('base64');

    let issuerName = '';
    let serialNumber = '';
    try {
        const forge = require('node-forge');
        const der = forge.util.decode64(cleanCertBase64);
        const obj = forge.asn1.fromDer(der, false); // strict=false to ignore trailing padding
        const tbs = obj.value[0];
        
        let idx = 0;
        if (tbs.value[idx].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC) {
            idx++; // skip version
        }
        const serialObj = tbs.value[idx++];
        const serialHex = forge.util.bytesToHex(serialObj.value);
        idx++; // skip signature
        const issuerSeq = tbs.value[idx++];

        const rdns = [];
        const oidMap = { '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU' };
        for (const set of issuerSeq.value) {
            for (const seq of set.value) {
                const oid = forge.asn1.derToOid(seq.value[0].value);
                const valObj = seq.value[1];
                let val = valObj.value;
                if (valObj.type === forge.asn1.Type.UTF8) {
                    val = forge.util.decodeUtf8(val);
                }
                rdns.push(`${oidMap[oid] || oid}=${val}`);
            }
        }
        const issuerString = rdns.reverse().join(', ');

        const escapeXml = (s) => String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        issuerName = escapeXml(issuerString);
        serialNumber = BigInt('0x' + serialHex).toString(10);
    } catch (e) {
        console.warn('[ZATCA XAdES] Could not parse X509 for IssuerSerial (ASN.1 Walk):', e.message);
    }

    const signingTime = String(timestamp || new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z');

    const dummyEnvelope = `<ext:UBLExtensions>
        <ext:UBLExtension>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                    <sac:SignatureInformation>
                        <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                        <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
                            <ds:SignedInfo>
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

    const docStr = injectUBLExtensions(xmlString, dummyEnvelope);
    const doc = new DOMParser().parseFromString(docStr, 'application/xml');

    let signedPropsForHashing = dummyEnvelope.substring(
        dummyEnvelope.indexOf('<xades:SignedProperties Id="xadesSignedProperties">'),
        dummyEnvelope.indexOf('</xades:SignedProperties>') + '</xades:SignedProperties>'.length
    );
    signedPropsForHashing = signedPropsForHashing
        .replace('<xades:SignedProperties Id="xadesSignedProperties">', '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')
        .replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
        .replace('<ds:DigestValue>', '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
        .replace('<ds:X509IssuerName>', '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
        .replace('<ds:X509SerialNumber>', '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');

    const signedPropsHashHex = crypto.createHash('sha256').update(signedPropsForHashing, 'utf8').digest('hex');
    const signedPropsHashB64 = Buffer.from(signedPropsHashHex, 'utf8').toString('base64');

    const digestValueNodes = xpath.select(
        "//*[local-name()='Reference' and @URI='#xadesSignedProperties']/*[local-name()='DigestValue']",
        doc
    );
    if (digestValueNodes.length > 0) {
        digestValueNodes[0].textContent = signedPropsHashB64;
    }

    // [FIX-2] Use C14N 1.1 for SignedInfo serialisation before ECDSA signing
    const signedInfoNode = xpath.select("//*[local-name()='SignedInfo']", doc)[0];
    const c14nSignedInfo = c14nWithInheritedNS(signedInfoNode);
    
    const derSignature = signEcdsaSha256(Buffer.from(c14nSignedInfo, 'utf8'), privateKeyPem);
    const signatureBase64 = derSignature.toString('base64');

    const envelope = dummyEnvelope
        .replace('__SIGNED_PROPS_HASH__', signedPropsHashB64)
        .replace('__SIGNATURE_VALUE__', signatureBase64);

    return { envelope, invoiceHashBase64, signatureBase64 };
}

// ── 9-tag ZATCA TLV QR (Phase 2) ─────────────────────────────────────────────
function generateZatcaTLV9(seller, vatNo, timestamp, total, vatAmt, xmlHash, ecdsaSig, pubKeyPem, certSignature) {
    const tlvEncode = (tag, valueBuf) => {
        const len = valueBuf.length;
        let lenBuf;
        if (len <= 127) {
            lenBuf = Buffer.from([len]);
        } else if (len <= 255) {
            lenBuf = Buffer.from([0x81, len]);
        } else {
            lenBuf = Buffer.from([0x82, (len >> 8) & 0xFF, len & 0xFF]);
        }
        return Buffer.concat([Buffer.from([tag]), lenBuf, valueBuf]);
    };

    const cleanTime = String(timestamp || '').replace(/\.\d{3}Z$/, '').replace(/Z$/, '');

    const tags = [
        tlvEncode(1, Buffer.from(String(seller || ''), 'utf8')),
        tlvEncode(2, Buffer.from(String(vatNo  || ''), 'utf8')),
        tlvEncode(3, Buffer.from(cleanTime, 'utf8')),
        tlvEncode(4, Buffer.from(parseFloat(total  || 0).toFixed(2), 'utf8')),
        tlvEncode(5, Buffer.from(parseFloat(vatAmt || 0).toFixed(2), 'utf8')),
    ];
    if (xmlHash)       tags.push(tlvEncode(6, Buffer.from(String(xmlHash), 'utf8')));
    if (ecdsaSig)      tags.push(tlvEncode(7, Buffer.from(String(ecdsaSig), 'utf8')));
    
    if (pubKeyPem) {
        const pkB64 = pubKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/[\n\r]/g, '');
        tags.push(tlvEncode(8, Buffer.from(pkB64, 'base64')));
    }
    
    if (certSignature) tags.push(tlvEncode(9, Buffer.from(certSignature, 'base64')));

    return Buffer.concat(tags).toString('base64');
}

// ── ZATCA Reporting API ───────────────────────────────────────────────────────
async function reportInvoice(invoiceHash, xmlBase64, uuid, csidToken, csidSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].reporting;
    const auth = Buffer.from(`${csidToken}:${csidSecret}`).toString('base64');
    try {
        const response = await axios.post(url,
            { invoiceHash, uuid, invoice: xmlBase64 },
            { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

// ── ZATCA Clearance API ────────────────────────────────────────────────
async function clearInvoice(invoiceHash, xmlBase64, uuid, csidToken, csidSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].clearance;
    const auth = Buffer.from(`${csidToken}:${csidSecret}`).toString('base64');
    try {
        const response = await axios.post(url,
            { invoiceHash, uuid, invoice: xmlBase64 },
            { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

// ── Certificate expiry check ───────────────────────────────────────────
function checkCertExpiry(certPem) {
    try {
        const certObj = forge.pki.certificateFromPem(certPem);
        const notAfter = certObj.validity.notAfter;
        const msRemaining = notAfter.getTime() - Date.now();
        return Math.floor(msRemaining / 86_400_000);
    } catch (e) {
        console.error('[ZATCA] checkCertExpiry: could not parse cert:', e.message);
        return Infinity;
    }
}

function extractCertDetails(certPem) {
    try {
        const b64 = certPem
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/[\n\r]/g, '');
        
        const certDer = Buffer.from(b64, 'base64');
        const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(certDer.toString('binary')));

        let pubKeyPem = '';
        try {
            const tbsCertificate = asn1Obj.value[0];
            const spki = tbsCertificate.value[6];
            const spkiDer = forge.asn1.toDer(spki).getBytes();
            const spkiB64 = Buffer.from(spkiDer, 'binary').toString('base64');
            pubKeyPem = '-----BEGIN PUBLIC KEY-----\n' + (spkiB64.match(/.{1,64}/g) || []).join('\n') + '\n-----END PUBLIC KEY-----\n';
        } catch (e) {
            console.error('[ZATCA] extractCertDetails SPKI parse error:', e.message);
        }

        const signatureValue = asn1Obj.value[2];
        let certSignature = '';
        if (Array.isArray(signatureValue.value)) {
            // node-forge auto-parsed the BIT STRING contents into ASN.1 objects
            const innerDer = forge.asn1.toDer(signatureValue.value[0]).getBytes();
            certSignature = Buffer.from(innerDer, 'binary').toString('base64');
        } else {
            let rawBytes = Buffer.from(signatureValue.value, 'binary');
            if (signatureValue.type === forge.asn1.Type.BITSTRING && rawBytes[0] === 0x00) {
                rawBytes = rawBytes.slice(1);
            }
            certSignature = Buffer.from(rawBytes).toString('base64');
        }
        return { pubKeyPem, certSignature };
    } catch (e) {
        console.error('[ZATCA] extractCertDetails error:', e.message);
        return { pubKeyPem: '', certSignature: '' };
    }
}

// ── QR TLV extractor (for receipt rendering) ─────────────────────────────────
function extractQRFromXML(signedXml) {
    try {
        const qrRefMatch = signedXml.match(
            /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([A-Za-z0-9+/=]+)<\/cbc:EmbeddedDocumentBinaryObject>/
        );
        if (qrRefMatch && qrRefMatch[1] && qrRefMatch[1].length > 10) {
            return qrRefMatch[1].trim();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// ── Compliance invoice check ────────────────────────────────────────────
async function checkComplianceInvoice(invoiceHash, xmlBase64, uuid, complianceToken, complianceSecret, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].compliance_checks;
    const auth = Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64');
    try {
        const response = await axios.post(
            url,
            { invoiceHash, uuid, invoice: xmlBase64 },
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept-Version': 'V2',
                    'Accept-Language': 'en',
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

// ── Production CSID renewal ─────────────────────────────────────────────
async function renewProductionCSID(newCsrBase64, currentToken, currentSecret, otp, environment = 'production') {
    const env = _resolveEnv(environment);
    const url = ZATCA_URLS[env].onboarding;
    const auth = Buffer.from(`${currentToken}:${currentSecret}`).toString('base64');
    try {
        const response = await axios.patch(
            url,
            { csr: newCsrBase64 },
            {
                headers: {
                    'OTP': otp,
                    'Authorization': `Basic ${auth}`,
                    'Accept-Version': 'V2',
                    'Accept-Language': 'en',
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

// ── signAndPackageInvoice ─────────────────────────────────────────────────────
function signAndPackageInvoice({ xml, device, settings, timestamp, total, tax, db }) {
    const invoiceHash = hashXML(xml);
    let signedXml = xml;
    // [FIX-PIH-CHAIN] Default chain value to the unsigned-branch hash; overwritten below if signed.
    let chainHashB64 = invoiceHash;

    if (!device.production_csid || !device.production_cert_pem) {
        const tlv = generateZatcaTLV9(
            settings.business_name_ar || 'مؤسسة تجارية',
            settings.vat_number || settings.tax_number || '300000000000003',
            timestamp, total, tax
        );
        // [FIX-PLACEHOLDER] Structural replace — no signature yet, so the
        // skeleton UBLExtensions block is stripped entirely.
        signedXml = injectUBLExtensions(xml, '');
        signedXml = injectQRPayload(signedXml, tlv);
    } else {
        const { envelope, invoiceHashBase64, signatureBase64 } = signInvoiceXML(
            xml,
            device.private_key_pem,
            device.production_cert_pem,
            timestamp
        );
        // [FIX-PLACEHOLDER] Structural replace — swap the empty skeleton
        // <ext:UBLExtensions> block for the fully computed XAdES envelope.
        signedXml = injectUBLExtensions(xml, envelope);
        chainHashB64 = invoiceHashBase64;

        const { pubKeyPem, certSignature } = extractCertDetails(device.production_cert_pem);
        const tlv = generateZatcaTLV9(
            settings.business_name_ar || 'مؤسسة تجارية',
            settings.vat_number || settings.tax_number || '300000000000003',
            timestamp, total, tax,
            invoiceHashBase64, signatureBase64, pubKeyPem, certSignature
        );
        signedXml = injectQRPayload(signedXml, tlv);
    }

    // [FIX-PIH-CHAIN] Moved outside the if/else — last_pih must be updated for EVERY
    // invoice (signed or unsigned), or the chain silently desyncs the next time a
    // production-CSID invoice follows a non-CSID one.
    if (db) {
        db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(chainHashB64, device.id);
    }

    return { signedXml, invoiceHash };
}

module.exports = {
    derToP1363,
    generateDeviceKeyPair,
    generateCSR,
    getComplianceCSID,
    issueComplianceCSID:  getComplianceCSID,
    getProductionCSID,
    issueProductionCSID:  getProductionCSID,
    checkComplianceInvoice,
    renewProductionCSID,
    getZatcaUrl,
    ZATCA_URLS,
    canonicalizeInvoiceXML,
    c14nWithInheritedNS,
    c14n11Element,
    hashXML,
    signInvoiceXML,
    signAndPackageInvoice,
    injectUBLExtensions,
    injectQRPayload,
    generateZatcaTLV9,
    reportInvoice,
    clearInvoice,
    extractCertDetails,
    extractQRFromXML,
    checkCertExpiry,
};
