const crypto = require('crypto');
const forge  = require('node-forge');
const axios  = require('axios');

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

const { SignedXml, C14nCanonicalization } = require('xml-crypto');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// ─────────────────────────────────────────────────────────────────────────────
// ZATCA PHASE 2 CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// ── Key pair generation ───────────────────────────────────────────────────────
function generateDeviceKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding:  { type: 'spki',  format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

// ── CSR generation via OpenSSL ────────────────────────────────────────────────
function generateCSR(privateKeyPem, publicKeyPem, info) {
    const fs   = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    const os   = require('os');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zatca-csr-'));
    const keyPath = path.join(tempDir, 'key.pem');
    const cnfPath = path.join(tempDir, 'openssl.cnf');
    const csrPath = path.join(tempDir, 'csr.pem');

    try {
        fs.writeFileSync(keyPath, privateKeyPem);
        let templateName;
        const resolvedEnv = _resolveEnv(info.environment || info.isSandbox);
        if (resolvedEnv === 'sandbox') {
            templateName = 'TESTZATCA-Code-Signing';
        } else if (resolvedEnv === 'simulation') {
            templateName = 'PREZATCA-Code-Signing';
        } else {
            templateName = 'ZATCA-Code-Signing';
        }

        // Surgical Fix: Declared proper explicit ZATCA OID mapping sequences in configuration
        const cnfContent = `
[ req ]
default_bits        = 2048
default_keyfile     = ${keyPath.replace(/\\/g, '/')}
distinguished_name  = req_distinguished_name
req_extensions      = v3_req
prompt              = no

[ req_distinguished_name ]
countryName                 = SA
organizationName            = ${info.ORG || 'Smart Touch POS'}
organizationalUnitName      = ${info.OU  || 'Main Branch'}
commonName                  = ${info.CN  || 'ZATCA-EGS'}

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, nonRepudiation
subjectAltName = dirName:alt_names
1.3.6.1.4.1.311.20.2 = ASN1:PRINTABLESTRING:${templateName}

[ alt_names ]
C=SA
O=${info.ORG || 'Smart Touch POS'}
OU=${info.OU  || 'Main Branch'}
CN=${info.CN  || 'ZATCA-EGS'}
1.2.3.4.5.6.7.8.1=${info.EGS_SN || '1-SmartTouch|2-POS|3-001'}
1.2.3.4.5.6.7.8.2=${info.UID    || '310000000000003'}
1.2.3.4.5.6.7.8.3=${info.IND    || 'Retail'}
`;
        fs.writeFileSync(cnfPath, cnfContent);
        execSync(`openssl req -new -key "${keyPath}" -out "${csrPath}" -config "${cnfPath}"`, { stdio: 'pipe' });
        const csrPem    = fs.readFileSync(csrPath, 'utf8');
        const csrBase64 = csrPem
            .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
            .replace(/-----END CERTIFICATE REQUEST-----/g, '')
            .replace(/[\n\r]/g, '').trim();
        return { csrBase64, csrPem };
    } finally {
        try {
            if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
            if (fs.existsSync(cnfPath)) fs.unlinkSync(cnfPath);
            if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);
            fs.rmdirSync(tempDir);
        } catch (e) { console.error('[ZATCA CSR] cleanup error:', e); }
    }
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

// ── C14N with full ancestor namespace inheritance ─────────────────────────────
function c14nWithInheritedNS(el) {
    const nsMap = new Map();
    let node = el;
    while (node && node.nodeType === 1) {
        for (let i = 0; i < node.attributes.length; i++) {
            const a = node.attributes[i];
            if (a.name === 'xmlns' && !nsMap.has('')) {
                nsMap.set('', a.value);
            } else if (a.name.startsWith('xmlns:')) {
                const prefix = a.name.slice(6);
                if (!nsMap.has(prefix)) nsMap.set(prefix, a.value);
            }
        }
        node = node.parentNode;
    }

    let outerXml = new XMLSerializer().serializeToString(el);
    const firstTag = outerXml.match(/^<[^>]+>/)[0];
    const missing = [];
    for (const [prefix, uri] of nsMap) {
        const decl = prefix === '' ? 'xmlns' : ('xmlns:' + prefix);
        if (!firstTag.includes(decl + '=')) {
            missing.push(`${decl}="${uri}"`);
        }
    }
    if (missing.length > 0) {
        const tagName = outerXml.match(/^<([^\s>/]+)/)[1];
        outerXml = outerXml.replace('<' + tagName, '<' + tagName + ' ' + missing.join(' '));
    }

    const newDoc = new DOMParser().parseFromString(outerXml, 'application/xml');
    return new C14nCanonicalization().process(newDoc.documentElement);
}

// ── C14N 1.0 inclusive for the Invoice element (ZATCA-compliant) ──────────────
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

        const strippedXml = new XMLSerializer().serializeToString(doc);
        const cleanDoc = new DOMParser().parseFromString(strippedXml, 'application/xml');
        const c14n = new C14nCanonicalization();
        return c14n.process(cleanDoc.documentElement);
    } catch (err) {
        throw new Error('C14N canonicalization failed — cannot sign invoice safely: ' + err.message);
    }
}

// ── Startup C14N self-test ───────────────────────────────────────────
(function runC14NSelfTest() {
    const TEST_XML = `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:test"><cbc:ID>001</cbc:ID></Invoice>`;
    let result;
    try {
        result = canonicalizeInvoiceXML(TEST_XML);
    } catch (e) {
        throw new Error('[ZATCA MODULE LOAD BLOCKED] C14N self-test threw: ' + e.message);
    }
    if (!result || typeof result !== 'string' || result.indexOf('<Invoice') === -1) {
        throw new Error(
            '[ZATCA MODULE LOAD BLOCKED] C14N self-test produced invalid output. Got: ' + String(result).slice(0, 120)
        );
    }
})();

// Surgical Fix: Compute base64 directly from raw binary buffer to prevent UTF-8 string padding mismatches
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

// ── ECDSA Signing ─────────────────────────────────────────────────────────────
function signInvoiceXML(xmlString, privateKeyPem, certPem, timestamp) {
    const invoiceHashBase64 = hashXML(xmlString);

    const cleanCertBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/[\n\r]/g, '');
    const certHashB64 = crypto.createHash('sha256').update(cleanCertBase64, 'base64').digest('base64');

    let issuerName = '';
    let serialNumber = '';
    try {
        const x509 = new crypto.X509Certificate(certPem);
        const escapeXml = (s) => String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        
        issuerName = escapeXml(
            x509.issuer.split('\n').reverse().join(', ')
        );
        serialNumber = BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10);
    } catch (e) {
        console.warn('[ZATCA XAdES] Could not parse X509 for IssuerSerial:', e.message);
    }

    const signingTime = String(timestamp || new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z');

    const dummyEnvelope = `
    <ext:UBLExtensions>
        <ext:UBLExtension>
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

    let docStr = xmlString.replace('', dummyEnvelope);
    if (docStr === xmlString) {
        docStr = xmlString.replace('<cbc:ProfileID>', dummyEnvelope + '\n    <cbc:ProfileID>');
    }
    const doc = new DOMParser().parseFromString(docStr, 'application/xml');

    const signedPropsNode = xpath.select("//*[local-name()='SignedProperties']", doc)[0];
    const c14nSignedProps = c14nWithInheritedNS(signedPropsNode);
    const signedPropsHashB64 = crypto.createHash('sha256').update(c14nSignedProps, 'utf8').digest('base64');

    const digestValueNodes = xpath.select(
        "//*[local-name()='Reference' and @URI='#xadesSignedProperties']/*[local-name()='DigestValue']",
        doc
    );
    if (digestValueNodes.length > 0) {
        digestValueNodes[0].textContent = signedPropsHashB64;
    }

    const signedInfoNode = xpath.select("//*[local-name()='SignedInfo']", doc)[0];
    const c14nSignedInfo = c14nWithInheritedNS(signedInfoNode);
    const sign = crypto.createSign('SHA256');
    sign.update(c14nSignedInfo, 'utf8');
    const derSignature = sign.sign({ key: privateKeyPem });
    const p1363Buf = derToP1363(derSignature);
    const signatureBase64 = p1363Buf.toString('base64');

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

    let pubKeyDer = Buffer.alloc(0);
    try {
        if (pubKeyPem) {
            const b64 = pubKeyPem
                .replace(/-----BEGIN PUBLIC KEY-----/g, '')
                .replace(/-----END PUBLIC KEY-----/g, '')
                .replace(/[\n\r]/g, '');
            pubKeyDer = Buffer.from(b64, 'base64');
        }
    } catch (e) { /* leave empty */ }

    const tags = [
        tlvEncode(1, Buffer.from(String(seller || ''), 'utf8')),
        tlvEncode(2, Buffer.from(String(vatNo  || ''), 'utf8')),
        tlvEncode(3, Buffer.from(String(timestamp || ''), 'utf8')),
        tlvEncode(4, Buffer.from(parseFloat(total  || 0).toFixed(2), 'utf8')),
        tlvEncode(5, Buffer.from(parseFloat(vatAmt || 0).toFixed(2), 'utf8')),
    ];
    if (xmlHash)       tags.push(tlvEncode(6, Buffer.from(xmlHash, 'base64')));
    if (ecdsaSig)      tags.push(tlvEncode(7, Buffer.from(ecdsaSig, 'base64')));
    if (pubKeyDer.length > 0) tags.push(tlvEncode(8, pubKeyDer));
    if (certSignature) tags.push(tlvEncode(9, Buffer.from(certSignature, 'base64')));

    return Buffer.concat(tags).toString('base64');
}

// ── ZATCA Reporting API ───────────────────────────────────────────────────────
// Surgical Fix: Stripped non-existent Clearance-Status header
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
// Surgical Fix: Stripped non-existent Clearance-Status header to ensure gateway alignment
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

// ── Certificate detail extraction ─────────────────────────────────────────────
// Surgical Fix: Uses strict ASN.1 mapping properties via forge structural parser to extract raw signatures safely
function extractCertDetails(certPem) {
    try {
        const x509 = new crypto.X509Certificate(certPem);
        const pubKeyPem = x509.publicKey.export({ type: 'spki', format: 'pem' });
        const certDer = x509.raw;
        
        const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(certDer.toString('binary')));
        const capture = {};
        const errors = [];
        
        // Accurate extraction path for inner ECDSA signature block on standard ZATCA certificates
        const signatureValue = asn1Obj.value[2];
        let rawBytes = signatureValue.value;
        
        // Handle bit string padding offsets cleanly
        if (typeof rawBytes === 'string') {
            rawBytes = Buffer.from(rawBytes, 'binary');
            if (signatureValue.type === forge.asn1.Type.BITSTRING && rawBytes[0] === 0x00) {
                rawBytes = rawBytes.slice(1);
            }
        }
        
        const certSignature = Buffer.from(rawBytes).toString('base64');
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
    hashXML,
    signInvoiceXML,
    generateZatcaTLV9,
    reportInvoice,
    clearInvoice,
    extractCertDetails,
    extractQRFromXML,
    checkCertExpiry,
};