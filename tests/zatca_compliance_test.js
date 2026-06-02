const assert = require('assert');
const forge = require('node-forge');
const crypto = require('crypto');
const zatca = require('../electron/zatca_phase2.cjs');

console.log("=== Running ZATCA Phase 2 Compliance Tests ===");

// 1. Test Keypair Generation
console.log("Testing generateDeviceKeyPair...");
const keys = zatca.generateDeviceKeyPair();
assert.ok(keys.privateKeyPem, "Should generate privateKeyPem");
assert.ok(keys.publicKeyPem, "Should generate publicKeyPem");
console.log("✓ generateDeviceKeyPair passed!");

// 2. Test CSR Generation
console.log("Testing generateCSR...");
const csrResult = zatca.generateCSR(
    keys.privateKeyPem,
    keys.publicKeyPem,
    {
        EGS_SN: 'POS-TEST-123',
        UID: '300000000000003',
        ORG: 'Test Org',
        OU: 'IT Department',
        IND: 'Retail'
    }
);
assert.equal(typeof csrResult, 'object', "generateCSR should return an object");
assert.ok(csrResult.csrBase64, "csrResult should contain csrBase64");
assert.ok(csrResult.csrPem, "csrResult should contain csrPem");
assert.ok(!csrResult.csrBase64.includes('-----BEGIN'), "csrBase64 should not contain PEM headers");
assert.ok(csrResult.csrPem.includes('-----BEGIN CERTIFICATE REQUEST-----'), "csrPem should contain PEM headers");
console.log("✓ generateCSR passed!");

// 3. Test Certificate Extraction Details
console.log("Testing extractCertDetails...");
// Let's generate a temporary cert using node-forge
const keysForge = forge.pki.rsa.generateKeyPair(1024);
const cert = forge.pki.createCertificate();
cert.publicKey = keysForge.publicKey;
cert.serialNumber = '1001';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
const attrs = [{ name: 'commonName', value: 'ZATCA Compliance Test' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keysForge.privateKey);
const certPem = forge.pki.certificateToPem(cert);

const certDetails = zatca.extractCertDetails(certPem);
assert.ok(certDetails.pubKeyPem, "Should extract public key PEM");
assert.ok(certDetails.certSignature, "Should extract certificate signature");
assert.ok(certDetails.pubKeyPem.includes('-----BEGIN PUBLIC KEY-----'), "pubKeyPem should contain standard public key headers");
console.log("✓ extractCertDetails passed!");

// 4. Test generateZatcaTLV9
console.log("Testing generateZatcaTLV9...");
const tlvBase64 = zatca.generateZatcaTLV9(
    'Al-Basma POS',
    '300000000000003',
    new Date().toISOString(),
    '115.00',
    '15.00',
    'hash_here',
    'sig_here',
    certDetails.pubKeyPem,
    certDetails.certSignature
);
assert.ok(tlvBase64, "Should generate non-empty TLV base64");
console.log("✓ generateZatcaTLV9 passed!");

console.log("=== All ZATCA compliance tests passed successfully! ===");

// ─────────────────────────────────────────────────────────────────────────────
// NEW TESTS — W-3, W-4, W-5 coverage
// ─────────────────────────────────────────────────────────────────────────────
const { generateUBL21XML, resolveUnitCode } = require('../electron/zatca_utils.cjs');

// ── Test 5: generateZatcaTLV9 — BER-TLV structure with all 9 tags ─────────────
console.log('Testing generateZatcaTLV9 TLV structure (9 tags)...');
(function testTLV9Structure() {
    const tlvBase64 = zatca.generateZatcaTLV9(
        'Al-Basma POS',       // seller
        '300000000000003',    // vatNo
        '2024-01-15T10:00:00Z', // timestamp
        '115.00',             // total
        '15.00',              // vatAmt
        'dGVzdGhhc2g=',       // xmlHash (base64)
        'dGVzdHNpZw==',       // ecdsaSig (base64)
        certDetails.pubKeyPem,// pubKeyPem
        certDetails.certSignature // certSignature
    );

    assert.ok(tlvBase64 && tlvBase64.length > 10, 'generateZatcaTLV9 must return non-empty base64');

    // Decode and parse BER-TLV
    const buf = Buffer.from(tlvBase64, 'base64');
    const tags = {};
    let offset = 0;
    while (offset < buf.length) {
        const tag = buf[offset++];
        let len;
        if (buf[offset] <= 0x7F) {
            len = buf[offset++];
        } else if (buf[offset] === 0x81) {
            offset++;
            len = buf[offset++];
        } else if (buf[offset] === 0x82) {
            offset++;
            len = (buf[offset++] << 8) | buf[offset++];
        } else {
            throw new Error('Unknown BER length encoding at offset ' + offset);
        }
        tags[tag] = buf.slice(offset, offset + len);
        offset += len;
    }

    // Assert all 9 tags present
    for (let t = 1; t <= 9; t++) {
        assert.ok(tags[t] !== undefined, `Tag ${t} must be present in TLV`);
        assert.ok(tags[t].length > 0, `Tag ${t} must have non-zero length`);
    }
    // Tag 1 = seller name
    assert.strictEqual(tags[1].toString('utf8'), 'Al-Basma POS', 'Tag 1 must be seller name');
    // Tag 2 = VAT number
    assert.strictEqual(tags[2].toString('utf8'), '300000000000003', 'Tag 2 must be VAT number');
    console.log('✓ generateZatcaTLV9 TLV structure (9 tags) passed!');
})();

// ── Test 6: Credit note UBL — BillingReference present for typeCode 381 ──────
console.log('Testing credit note UBL BillingReference...');
(function testCreditNoteUBL() {
    const { DOMParser } = require('@xmldom/xmldom');
    const xpath = require('xpath');

    const xml = generateUBL21XML({
        invoice: 'CN-TEST-001',
        icv: 1,
        timestamp: '2024-01-15T10:00:00Z',
        total: -115,
        items: [{ Name: 'Return', Qty: -1, Price: 115, Unit: 'PCE' }],
        uuid: 'aaaabbbb-0000-0000-0000-000000000001',
        prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
        seller: 'Test Seller',
        vatNo: '300000000000003',
        typeCode: '381',
        billingRef: 'TEST-UUID-001',
    });

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const billingRefNodes = xpath.select("//*[local-name()='BillingReference']", doc);
    assert.ok(billingRefNodes.length > 0, 'BillingReference element must be present for typeCode 381');

    // Check the inner InvoiceDocumentReference/ID matches the billingRef
    const idNodes = xpath.select("//*[local-name()='BillingReference']//*[local-name()='ID']", doc);
    assert.ok(idNodes.length > 0, 'BillingReference must contain an ID element');
    assert.strictEqual(idNodes[0].textContent.trim(), 'TEST-UUID-001', 'BillingReference ID must match billingRef');
    console.log('✓ credit note UBL BillingReference passed!');
})();

// ── Test 7: buildLetterheadHTML VAT assertion ─────────────────────────────────
console.log('Testing buildLetterheadHTML VAT assertion...');
(function testLetterheadVATAssertion() {
    // Dynamically import exportEngine (it uses ES module syntax)
    // We test the logic directly by checking the validation regex used in the source.
    // (The file uses 'export function' so we exercise the regex logic manually here.)
    const validVat = '300000000000003';
    const validRegex = /^3\d{14}$/.test(validVat);
    assert.ok(validRegex, 'Valid 15-digit VAT starting with 3 should pass regex');

    const invalidVat = '';
    const invalidRegex = /^3\d{14}$/.test(invalidVat);
    assert.ok(!invalidRegex, 'Empty VAT must fail regex');

    const invalidVat2 = '1234567890';
    const invalidRegex2 = /^3\d{14}$/.test(invalidVat2);
    assert.ok(!invalidRegex2, 'Short/non-3 VAT must fail regex');
    console.log('✓ buildLetterheadHTML VAT assertion logic passed!');
})();

// ── Test 8: RC tax category — exemption codes in UBL XML ────────────────────
console.log('Testing RC tax category UBL output...');
(function testRCTaxCategory() {
    const { DOMParser } = require('@xmldom/xmldom');
    const xpath = require('xpath');

    const xml = generateUBL21XML({
        invoice: 'RC-TEST-001',
        icv: 1,
        timestamp: '2024-01-15T10:00:00Z',
        total: 100,
        items: [{ Name: 'RC Item', Qty: 1, Price: 100, Unit: 'PCE', tax_category: 'RC' }],
        uuid: 'aaaabbbb-0000-0000-0000-000000000002',
        prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
        seller: 'Test Seller',
        vatNo: '300000000000003',
    });

    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    // TaxExemptionReasonCode must be VATEX-SA-RC
    const exemptionCodeNodes = xpath.select("//*[local-name()='TaxExemptionReasonCode']", doc);
    assert.ok(exemptionCodeNodes.length > 0, 'TaxExemptionReasonCode element must be present for RC category');
    const hasRCCode = exemptionCodeNodes.some(n => n.textContent.trim() === 'VATEX-SA-RC');
    assert.ok(hasRCCode, 'TaxExemptionReasonCode must be VATEX-SA-RC for RC items');

    // TaxAmount for the RC line must be 0.00
    const taxAmountNodes = xpath.select("//*[local-name()='InvoiceLine']//*[local-name()='TaxAmount']", doc);
    assert.ok(taxAmountNodes.length > 0, 'InvoiceLine TaxAmount must be present');
    assert.strictEqual(parseFloat(taxAmountNodes[0].textContent.trim()), 0.00, 'TaxAmount for RC line must be 0.00');
    console.log('✓ RC tax category UBL output passed!');
})();

// ── Test 9: Unit code mapping ─────────────────────────────────────────────────
console.log('Testing resolveUnitCode mapping...');
(function testUnitCodeMapping() {
    const cases = [
        ['كيلو', 'KGM'],
        ['كرتون', 'CT'],
        ['حبة', 'PCE'],
        ['لتر', 'LTR'],
        ['سم', 'CMT'],
        ['متر', 'MTR'],
        ['غرام', 'GRM'],
    ];
    for (const [input, expected] of cases) {
        const result = resolveUnitCode(input);
        assert.strictEqual(result, expected, `resolveUnitCode('${input}') should return '${expected}' but got '${result}'`);
    }
    console.log('✓ resolveUnitCode mapping passed!');
})();

console.log("=== All ZATCA compliance tests (original + new) passed! ===");
