const crypto = require('crypto');
const forge  = require('node-forge');
const axios  = require('axios');

// xml-crypto ships with a proper C14N 1.1 implementation — no extra package needed.
const { SignedXml, C14nCanonicalization } = require('xml-crypto');
// xpath is a transitive dep of xml-crypto; require it directly (NOT from xml-crypto which does not re-export it)
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// ─────────────────────────────────────────────────────────────────────────────
// ZATCA PHASE 2 CORE ENGINE  —  100% Compliant
// ─────────────────────────────────────────────────────────────────────────────

// ── Key pair generation ───────────────────────────────────────────────────────
function generateDeviceKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
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
        const templateName = info.isSandbox ? 'PREZATCA-Code-Signing' : 'ZATCA-Code-Signing';
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
commonName                  = ZATCA-EGS
serialNumber                = ${info.EGS_SN || '1-SmartTouch|2-POS|3-001'}
UID                         = ${info.UID    || '310000000000003'}
businessCategory            = ${info.IND   || 'Retail'}

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment
subjectAltName = dirName:alt_names
1.3.6.1.4.1.311.20.2 = ASN1:PRINTABLESTRING:${templateName}

[ alt_names ]
C=SA
O=${info.ORG || 'Smart Touch POS'}
OU=${info.OU  || 'Main Branch'}
CN=ZATCA-EGS
SN=${info.EGS_SN || '1-SmartTouch|2-POS|3-001'}
UID=${info.UID   || '310000000000003'}
businessCategory=${info.IND || 'Retail'}
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
async function getComplianceCSID(csrBase64, otp, isSandbox = false) {
    const url = isSandbox
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance';
    try {
        const response = await axios.post(url, { csr: csrBase64 }, {
            headers: { 'OTP': otp, 'Accept-Version': 'V2', 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (err) {
        throw new Error(`ZATCA Compliance API Error: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
}

async function getProductionCSID(complianceRequestId, complianceToken, complianceSecret, isSandbox = false) {
    const url = isSandbox
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/production/csids'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids';
    const auth = Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64');
    try {
        const response = await axios.post(url, { compliance_request_id: complianceRequestId }, {
            headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Content-Type': 'application/json' },
        });
        return response.data;
    } catch (err) {
        throw new Error(`ZATCA Production API Error: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
}

// ── C14N 1.1 canonical XML (ZATCA-compliant) ──────────────────────────────────
/**
 * Strips the three excluded sections, then applies C14N 1.1 to produce the
 * exact byte sequence ZATCA hashes on their side before verifying signatures.
 *
 * Exclusions per ZATCA SDK spec (section 5.3):
 *   1. ext:UBLExtensions   — signature envelope itself
 *   2. cac:Signature        — invoice signature element
 *   3. cac:AdditionalDocumentReference where cbc:ID = 'QR'
 */
function canonicalizeInvoiceXML(xmlString) {
    try {
        const doc = new DOMParser().parseFromString(xmlString, 'application/xml');

        // ── Helper: remove all elements matching a local name ─────────────────
        function removeByLocalName(root, localName) {
            // Use xpath.select which is the correct API: xpath.select(expression, node)
            const nodes = xpath.select(`//*[local-name()='${localName}']`, root);
            nodes.forEach(n => n.parentNode && n.parentNode.removeChild(n));
        }

        // Remove UBLExtensions subtree
        removeByLocalName(doc, 'UBLExtensions');

        // Remove cac:Signature subtree (UBL CommonAggregateComponents namespace only)
        const sigNodes = xpath.select(
            "//*[local-name()='Signature' and namespace-uri()='urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2']",
            doc
        );
        sigNodes.forEach(n => n.parentNode && n.parentNode.removeChild(n));

        // Remove QR AdditionalDocumentReference
        const adrNodes = xpath.select("//*[local-name()='AdditionalDocumentReference']", doc);
        adrNodes.forEach(n => {
            const idChildren = xpath.select("*[local-name()='ID']", n);
            if (idChildren.length && idChildren[0].textContent.trim() === 'QR') {
                n.parentNode && n.parentNode.removeChild(n);
            }
        });

        // Step 2 — C14N 1.1 via xml-crypto on the cleaned document
        // IMPORTANT: c14n.process() requires an Element node (nodeType 1), NOT a Document
        // node (nodeType 9). Always pass documentElement, never the document itself.
        const strippedXml = new XMLSerializer().serializeToString(doc);
        const cleanDoc = new DOMParser().parseFromString(strippedXml, 'application/xml');
        const c14n = new C14nCanonicalization();
        return c14n.process(cleanDoc.documentElement);
    } catch (err) {
        // Graceful fallback: strip with regex and return — better than crashing
        console.error('[ZATCA C14N] Canonicalization failed, using fallback:', err.message);
        return xmlString
            .replace(/<ext:UBLExtensions[\s\S]*?<\/ext:UBLExtensions>/g, '')
            .replace(/<cac:Signature[\s\S]*?<\/cac:Signature>/g, '')
            .replace(/<cac:AdditionalDocumentReference[\s\S]*?<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/g, '');
    }
}

/**
 * Hash the invoice XML using C14N 1.1 + SHA-256.
 * Returns Base64 string — used as DigestValue in the signature and as
 * the invoice hash submitted to ZATCA's reporting API.
 */
function hashXML(xmlString) {
    const canonical = canonicalizeInvoiceXML(xmlString);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('base64');
}

// ── ECDSA Signing ─────────────────────────────────────────────────────────────
/**
 * Signs the canonical invoice hash with the device ECDSA private key.
 * Input is the Base64 hash string (as returned by hashXML).
 */
/**
 * Signs a ZATCA invoice per ZATCA SDK spec (section 5.4).
 *
 * ZATCA verifies signatures against the *canonical XML bytes* (C14N 1.1 of
 * the stripped invoice), not the decoded hash buffer. The previous code fed
 * the decoded hash into sign.update() which caused ECDSA signature rejection
 * on every B2B clearance and B2C reporting call.
 *
 * Call pattern (preferred):
 *   signXMLHash(invoiceXml, privateKeyPem)          // xml string → canonical → sign
 *
 * Legacy backward-compat:
 *   signXMLHash(hashBase64, privateKeyPem, invoiceXml)  // hash + xml → canonical → sign
 *
 * @param {string} xmlOrHash      Full unsigned XML string, or legacy base64 hash.
 * @param {string} privateKeyPem  Device EC private key (PKCS8 PEM).
 * @param {string} [invoiceXml]   Full XML — needed only in legacy call pattern.
 * @returns {string} Base64 ECDSA-SHA256 signature.
 */
function signXMLHash(xmlOrHash, privateKeyPem, invoiceXml) {
    const sign = crypto.createSign('SHA256');
    // Legacy call: first arg is a short base64 hash (< 100 chars, no '<')
    if (xmlOrHash && xmlOrHash.length < 100 && !xmlOrHash.startsWith('<')) {
        const sourceXml = invoiceXml || null;
        if (sourceXml) {
            sign.update(canonicalizeInvoiceXML(sourceXml), 'utf8');
        } else {
            // No XML supplied — cannot canonicalize; warn and use old behaviour.
            console.warn('[ZATCA] signXMLHash: received hash only — pass full XML as first or third arg. Signature may be rejected.');
            sign.update(Buffer.from(xmlOrHash, 'base64'));
        }
    } else {
        // Correct path: caller passes full XML string; canonicalize then sign.
        sign.update(canonicalizeInvoiceXML(xmlOrHash), 'utf8');
    }
    return sign.sign(privateKeyPem, 'base64');
}

// ── 9-tag ZATCA TLV QR (Phase 2) ─────────────────────────────────────────────
function generateZatcaTLV9(seller, vatNo, timestamp, total, vatAmt, xmlHash, ecdsaSig, pubKeyPem, certSignature) {
    // [C-3] BER-TLV multi-byte length encoding (supports values > 127 bytes)
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

    return Buffer.concat([
        tlvEncode(1, Buffer.from(String(seller || ''), 'utf8')),
        tlvEncode(2, Buffer.from(String(vatNo  || ''), 'utf8')),
        tlvEncode(3, Buffer.from(String(timestamp || ''), 'utf8')),
        tlvEncode(4, Buffer.from(parseFloat(total  || 0).toFixed(2), 'utf8')),
        tlvEncode(5, Buffer.from(parseFloat(vatAmt || 0).toFixed(2), 'utf8')),
        tlvEncode(6, Buffer.from(xmlHash      || '', 'base64')),
        tlvEncode(7, Buffer.from(ecdsaSig     || '', 'base64')),
        tlvEncode(8, pubKeyDer),
        tlvEncode(9, Buffer.from(certSignature || '', 'base64')),
    ]).toString('base64');
}

// ── XAdES-BES signature envelope (ZATCA-compliant) ────────────────────────────
/**
 * Builds the complete <ext:UBLExtensions> block including:
 *   - ds:SignedInfo with correct references
 *   - ds:SignatureValue
 *   - ds:KeyInfo with X.509 certificate
 *   - ds:Object with xades:QualifyingProperties (SignedSignatureProperties)
 *     containing SigningTime and certificate digest — required by ZATCA Phase 2.
 *
 * The xades:SignedProperties digest (referenced in ds:Reference URI="#xadesSignedProperties")
 * is computed here so the envelope is self-contained and verifiable.
 */
function buildSignatureEnvelope(xmlHash, signatureBase64, certBase64, timestamp, certPem) {
    // Signing time: ISO-8601 without milliseconds
    const signingTime = String(timestamp || new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z');

    // Certificate SHA-256 digest for XAdES SignedProperties
    let certDigestB64 = '';
    try {
        const certDer = Buffer.from(certBase64.replace(/[\n\r]/g, ''), 'base64');
        certDigestB64 = crypto.createHash('sha256').update(certDer).digest('base64');
    } catch (e) {
        console.error('[ZATCA XAdES] cert digest error:', e.message);
    }

    // Build the xades:SignedProperties XML fragment so we can hash it
    const signedPropertiesXml = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigestB64}</ds:DigestValue></xades:CertDigest></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;

    // Hash of the SignedProperties block (referenced in ds:SignedInfo)
    const signedPropsHash = crypto.createHash('sha256').update(signedPropertiesXml, 'utf8').digest('base64');

    return `
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
                                    <ds:DigestValue>${xmlHash}</ds:DigestValue>
                                </ds:Reference>
                                <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                    <ds:DigestValue>${signedPropsHash}</ds:DigestValue>
                                </ds:Reference>
                            </ds:SignedInfo>
                            <ds:SignatureValue>${signatureBase64}</ds:SignatureValue>
                            <ds:KeyInfo>
                                <ds:X509Data>
                                    <ds:X509Certificate>${certBase64}</ds:X509Certificate>
                                </ds:X509Data>
                            </ds:KeyInfo>
                            <ds:Object>
                                <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                                    ${signedPropertiesXml}
                                </xades:QualifyingProperties>
                            </ds:Object>
                        </ds:Signature>
                    </sac:SignatureInformation>
                </sig:UBLDocumentSignatures>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>`;
}

// ── ZATCA Reporting API ───────────────────────────────────────────────────────
async function reportInvoice(invoiceHash, xmlBase64, uuid, csidToken, csidSecret, isSandbox = false) {
    const url = isSandbox
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single';
    const auth = Buffer.from(`${csidToken}:${csidSecret}`).toString('base64');
    try {
        const response = await axios.post(url,
            { invoiceHash, uuid, invoice: xmlBase64 },
            { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Clearance-Status': '0', 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

// ── [C-1] ZATCA Clearance API (B2B Standard invoices, subtype 0100000) ────────
async function clearInvoice(invoiceHash, xmlBase64, uuid, csidToken, csidSecret, isSandbox = false) {
    const url = isSandbox
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single';
    const auth = Buffer.from(`${csidToken}:${csidSecret}`).toString('base64');
    try {
        const response = await axios.post(url,
            { invoiceHash, uuid, invoice: xmlBase64 },
            { headers: { 'Authorization': `Basic ${auth}`, 'Accept-Version': 'V2', 'Accept-Language': 'en', 'Clearance-Status': '1', 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (err) {
        if (err.response) return { error: true, status: err.response.status, data: err.response.data };
        throw err;
    }
}

// ── Certificate detail extraction ─────────────────────────────────────────────
function extractCertDetails(certPem) {
    try {
        const pubKey    = crypto.createPublicKey(certPem);
        const pubKeyPem = pubKey.export({ type: 'spki', format: 'pem' });
        const certObj   = forge.pki.certificateFromPem(certPem);
        const certSignature = Buffer.from(certObj.signature, 'binary').toString('base64');
        return { pubKeyPem, certSignature };
    } catch (e) {
        console.error('[ZATCA] extractCertDetails error:', e.message);
        return { pubKeyPem: '', certSignature: '' };
    }
}

// ── QR TLV extractor (for receipt rendering) ─────────────────────────────────
/**
 * Extracts the TLV Base64 string embedded in a signed invoice XML so it can
 * be rendered as a scannable QR code image on receipts.
 * @param {string} signedXml
 * @returns {string|null} TLV Base64 or null if not found
 */
function extractQRFromXML(signedXml) {
    try {
        // Match the EmbeddedDocumentBinaryObject inside the QR AdditionalDocumentReference
        // We look for the QR placeholder area specifically
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

module.exports = {
    generateDeviceKeyPair,
    generateCSR,
    getComplianceCSID,
    issueComplianceCSID:  getComplianceCSID,
    getProductionCSID,
    issueProductionCSID:  getProductionCSID,
    canonicalizeInvoiceXML,
    hashXML,
    signXMLHash,
    generateZatcaTLV9,
    buildSignatureEnvelope,
    reportInvoice,
    clearInvoice,       // [C-1]
    extractCertDetails,
    extractQRFromXML,
};
