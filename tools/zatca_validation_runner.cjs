#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// tools/zatca_validation_runner.cjs
// PHASE 4 — ZATCA VALIDATION TOOLING
//
// Generates unsigned + signed XML for all four invoice types, saves snapshots,
// computes invoice hashes, decodes QR TLV tags, validates XML structure
// locally, and emits structured JSON diagnostics.
//
// Usage:
//   node tools/zatca_validation_runner.cjs [--type simplified|standard|credit|debit]
//   node tools/zatca_validation_runner.cjs --all
//   node tools/zatca_validation_runner.cjs --type simplified --env sandbox
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Resolve paths relative to project root (two levels up from tools/) ────────
const ROOT = path.resolve(__dirname, '..');

// ── Import confirmed-available exports ────────────────────────────────────────
const { generateUBL21XML }            = require(path.join(ROOT, 'electron', 'zatca_utils.cjs'));
const {
    signAndPackageInvoice,
    hashXML,
    extractQRFromXML,
    canonicalizeInvoiceXML,
    checkCertExpiry,
    extractCertDetails,
    generateZatcaTLV9,
} = require(path.join(ROOT, 'electron', 'zatca_phase2_impl.cjs'));

// ── Snapshot output directory ─────────────────────────────────────────────────
const SNAPSHOT_DIR = path.join(ROOT, 'tools', 'snapshots');
if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX FIXTURE DATA
// These are ZATCA-compliant test values that pass address/VAT validators.
// ─────────────────────────────────────────────────────────────────────────────

const SANDBOX_SELLER = {
    name:    'شركة الاختبار للتجارة',
    nameEn:  'Test Trading Company',
};

const SANDBOX_ADDRESS = {
    street:            'شارع الملك فهد',
    building:          '1234',
    additional_street: 'حي العليا',
    plot_id:           '5678',
    district:          'العليا',
    city:              'الرياض',
    postal:            '12345',
    country:           'SA',
};

// ZATCA sandbox VAT number (15-digit, starts & ends with 3)
const SANDBOX_VAT_NO = '399999999900003';
const SANDBOX_CRN    = '1010101010';

// Sandbox device mock — cert-free (offline mode uses TLV-only QR)
const SANDBOX_DEVICE_OFFLINE = {
    production_csid:     null,
    production_cert_pem: null,
    private_key_pem:     null,
};

// ── Attempt to load live sandbox cert from DB if available ───────────────────
function tryLoadLiveDevice() {
    try {
        const db = require(path.join(ROOT, 'electron', 'database.cjs'));
        const database = db.getDbInstance();
        if (!database) return null;
        const device = database.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (device && device.production_cert_pem && device.production_csid) {
            return device;
        }
    } catch (_) { /* DB not initialised in CLI context — that is expected */ }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE TYPE FIXTURE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

const GENESIS_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+03:00');
}

function makeBaseInvoice(overrides = {}) {
    return {
        invoice:   overrides.invoice   || 'TEST-INV-001',
        icv:       overrides.icv       || 1,
        uuid:      crypto.randomUUID(),
        timestamp: overrides.timestamp || nowIso(),
        prevHash:  overrides.prevHash  || GENESIS_PIH,
        seller:    SANDBOX_SELLER.name,
        vatNo:     SANDBOX_VAT_NO,
        crn:       SANDBOX_CRN,
        vatRate:   0.15,
        address:   SANDBOX_ADDRESS,
        total:     overrides.total     || 115.00,
        discount:  overrides.discount  || 0,
        buyer:     overrides.buyer     || null,
        typeCode:  overrides.typeCode  || '388',
        billingRef:overrides.billingRef|| null,
        reason:    overrides.reason    || null,
        items: overrides.items || [
            {
                name:     'منتج اختبار',
                quantity: 1,
                Qty:      1,
                Price:    115.00,
                item_price: 115.00,
                Unit:     'وحدة',
                tax_category: 'S',
            }
        ],
    };
}

const INVOICE_FIXTURES = {
    // ── B2C Simplified (typeCode 388, subtype 0200000, no buyer) ─────────────
    simplified: {
        label: 'Simplified Tax Invoice (B2C)',
        typeCode: '388',
        data: () => makeBaseInvoice({
            invoice:  'SIMPLIFIED-001',
            icv:      1,
            typeCode: '388',
            total:    575.00,
            items: [
                { name: 'قهوة', Qty: 5, Price: 115.00, item_price: 115.00, Unit: 'وحدة', tax_category: 'S' },
            ],
        }),
    },

    // ── B2B Standard (typeCode 388, subtype 0100000, with buyer) ─────────────
    standard: {
        label: 'Standard Tax Invoice (B2B)',
        typeCode: '388',
        data: () => makeBaseInvoice({
            invoice:  'STANDARD-001',
            icv:      1,
            typeCode: '388',
            total:    1150.00,
            buyer: {
                name:     'شركة العميل المحدودة',
                vatNo:    '300000000000003',
                street:   'شارع الأمير محمد',
                building: '9900',
                district: 'الروضة',
                city:     'جدة',
                postal:   '21411',
                country:  'SA',
            },
            items: [
                { name: 'خدمة استشارية', Qty: 1, Price: 1150.00, item_price: 1150.00, Unit: 'وحدة', tax_category: 'S' },
            ],
        }),
    },

    // ── Credit Note (typeCode 381) ────────────────────────────────────────────
    credit: {
        label: 'Credit Note (typeCode 381)',
        typeCode: '381',
        data: () => makeBaseInvoice({
            invoice:   'CREDIT-001',
            icv:       2,
            typeCode:  '381',
            billingRef:'SIMPLIFIED-001',
            reason:    'إلغاء طلب',
            total:     -115.00,
            items: [
                { name: 'إرجاع منتج', Qty: 1, Price: -115.00, item_price: -115.00, Unit: 'وحدة', tax_category: 'S' },
            ],
        }),
    },

    // ── Debit Note (typeCode 383) ─────────────────────────────────────────────
    debit: {
        label: 'Debit Note (typeCode 383)',
        typeCode: '383',
        data: () => makeBaseInvoice({
            invoice:   'DEBIT-001',
            icv:       2,
            typeCode:  '383',
            billingRef:'SIMPLIFIED-001',
            reason:    'تعديل سعر',
            total:     57.50,
            items: [
                { name: 'فارق سعري', Qty: 1, Price: 57.50, item_price: 57.50, Unit: 'وحدة', tax_category: 'S' },
            ],
        }),
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// QR TLV DECODER
// Decodes base64 TLV payload (ZATCA QR format) into human-readable tags.
// ─────────────────────────────────────────────────────────────────────────────

const TLV_TAGS = {
    1: 'seller_name',
    2: 'vat_number',
    3: 'timestamp',
    4: 'total_with_vat',
    5: 'vat_amount',
    6: 'invoice_hash',
    7: 'signature',
    8: 'public_key',
    9: 'certificate_signature',
};

function decodeQRTLV(base64) {
    const decoded = {};
    if (!base64) return { error: 'No QR base64 found in signed XML' };

    try {
        const buf = Buffer.from(base64, 'base64');
        let offset = 0;

        while (offset < buf.length) {
            if (offset + 2 > buf.length) break;
            const tag = buf[offset];
            const len = buf[offset + 1];
            offset += 2;

            if (offset + len > buf.length) {
                decoded[`tag_${tag}_truncated`] = '(truncated)';
                break;
            }

            const val = buf.slice(offset, offset + len);
            offset += len;

            const tagName = TLV_TAGS[tag] || `tag_${tag}`;

            // Tags 6-9 are binary — represent as hex + base64
            if (tag >= 6) {
                decoded[tagName] = {
                    hex:    val.toString('hex'),
                    base64: val.toString('base64'),
                    length: val.length,
                };
            } else {
                decoded[tagName] = val.toString('utf8');
            }
        }

        decoded._total_tags = Object.keys(decoded).filter(k => !k.startsWith('_')).length;
        decoded._parsed_ok  = true;
    } catch (e) {
        decoded.error = e.message;
        decoded._parsed_ok = false;
    }

    return decoded;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL XML STRUCTURE VALIDATOR
// Checks required ZATCA UBL 2.1 elements without any external API call.
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_ELEMENTS = [
    { tag: 'cbc:ProfileID',        value: 'reporting:1.0'                               },
    { tag: 'cbc:ID',               value: null, label: 'Invoice Number'                 },
    { tag: 'cbc:UUID',             value: null, label: 'UUID'                           },
    { tag: 'cbc:IssueDate',        value: null, label: 'Issue Date'                     },
    { tag: 'cbc:IssueTime',        value: null, label: 'Issue Time'                     },
    { tag: 'cbc:InvoiceTypeCode',  value: null, label: 'InvoiceTypeCode'                },
    { tag: 'cbc:DocumentCurrencyCode', value: 'SAR'                                     },
    { tag: 'cbc:TaxCurrencyCode',  value: 'SAR'                                         },
    { tag: 'cac:AccountingSupplierParty', value: null, label: 'Seller block'            },
    { tag: 'cac:TaxTotal',         value: null, label: 'TaxTotal'                       },
    { tag: 'cac:LegalMonetaryTotal', value: null, label: 'LegalMonetaryTotal'           },
    { tag: 'cac:InvoiceLine',      value: null, label: 'InvoiceLine(s)'                 },
];

const REQUIRED_SIGNED_ELEMENTS = [
    { tag: 'ext:UBLExtensions',    label: 'UBLExtensions (signature envelope)'          },
    { tag: 'ds:SignedInfo',        label: 'ds:SignedInfo'                               },
    { tag: 'ds:SignatureValue',    label: 'ds:SignatureValue'                           },
    { tag: 'xades:QualifyingProperties', label: 'XAdES QualifyingProperties'           },
    { tag: 'cac:AdditionalDocumentReference', label: 'AdditionalDocumentReference'     },
];

function validateXMLStructure(xml, label = 'unsigned', sigMode = 'FULL_XADES') {
    const results = { label, sigMode, checks: [], passed: 0, failed: 0, warnings: [] };
    const checks  = label === 'unsigned' ? REQUIRED_ELEMENTS
                  : [...REQUIRED_ELEMENTS, ...REQUIRED_SIGNED_ELEMENTS];

    for (const check of checks) {
        const isXadesCheck = REQUIRED_SIGNED_ELEMENTS.some(c => c.tag === check.tag);
        const found = xml.includes(`<${check.tag}`) || xml.includes(`<${check.tag}>`);
        const checkResult = {
            element: check.tag,
            label:   check.label || check.tag,
            present: found,
            // In offline TLV-only mode, XAdES checks are advisory (WARN) not mandatory (FAIL)
            advisory: label === 'signed' && isXadesCheck && sigMode !== 'FULL_XADES',
        };
        if (check.value && found) {
            const regex = new RegExp(`<${check.tag.replace(':', ':')}[^>]*>\\s*${escapeRegex(check.value)}\\s*</${check.tag}>`, 's');
            checkResult.value_match = regex.test(xml);
            if (!checkResult.value_match) {
                checkResult.expected_value = check.value;
                checkResult.warning        = `Element present but value does not match "${check.value}"`;
                results.warnings.push(checkResult.warning);
            }
        }
        if (found) {
            results.passed++;
        } else if (checkResult.advisory) {
            // Advisory-only miss: counts as a warning, not a failure
            results.warnings.push(`[offline-mode] ${checkResult.label} absent (expected in full XAdES mode only)`);
        } else {
            results.failed++;
        }
        results.checks.push(checkResult);
    }

    // Additional signature-specific checks on signed XML
    if (label === 'signed') {
        // Verify QR tag is present (mandatory even in offline mode)
        const hasQR = xml.includes('<cbc:ID>QR</cbc:ID>');
        results.checks.push({ element: 'QR Tag', present: hasQR, label: 'QR TLV Reference' });
        if (hasQR) results.passed++;
        else        results.failed++;

        // Verify canonicalization algorithm — advisory in offline mode
        const hasC14N11 = xml.includes('xml-c14n11') || xml.includes('http://www.w3.org/2006/12/xml-c14n11');
        const c14nAdvisory = sigMode !== 'FULL_XADES';
        results.checks.push({ element: 'C14N 1.1 Algorithm', present: hasC14N11, label: 'C14N 1.1 in SignedInfo', advisory: c14nAdvisory });
        if (hasC14N11) {
            results.passed++;
        } else if (c14nAdvisory) {
            results.warnings.push('[offline-mode] C14N 1.1 absent (expected in full XAdES mode only)');
        } else {
            results.failed++;
        }
    }

    results.total   = results.passed + results.failed;
    results.score   = results.total > 0 ? Math.round((results.passed / results.total) * 100) : 100;
    results.status  = results.failed === 0 ? (results.warnings.length > 0 ? 'WARN' : 'PASS')
                    : (results.passed / Math.max(results.total, 1) >= 0.85 ? 'WARN' : 'FAIL');
    return results;
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// CERT DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

function diagnoseCert(device) {
    const diag = { available: false, days_remaining: null, expired: null, cert_hash: null };
    if (!device || !device.production_cert_pem) return diag;

    diag.available = true;
    const days = checkCertExpiry(device.production_cert_pem);
    diag.days_remaining = days;
    diag.expired        = days !== Infinity && days < 0;
    diag.expires_soon   = days !== Infinity && days < 30 && days >= 0;
    diag.cert_hash      = crypto.createHash('sha256')
        .update(device.production_cert_pem)
        .digest('hex')
        .slice(0, 16) + '…';

    try {
        const details = extractCertDetails(device.production_cert_pem);
        diag.vat_in_cert    = details.vatNumber || null;
        diag.cert_serial    = details.serial    || null;
    } catch (_) {}

    return diag;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE INVOICE RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runInvoiceValidation(typeKey, device, settings) {
    const fixture = INVOICE_FIXTURES[typeKey];
    if (!fixture) throw new Error(`Unknown invoice type: "${typeKey}". Valid: ${Object.keys(INVOICE_FIXTURES).join(', ')}`);

    const diag = {
        type:      typeKey,
        label:     fixture.label,
        timestamp: new Date().toISOString(),
        unsigned:  null,
        signed:    null,
        hash:      null,
        qr:        null,
        validation: { unsigned: null, signed: null },
        cert:      diagnoseCert(device),
        errors:    [],
        warnings:  [],
        status:    'PENDING',
    };

    // ── 1. Generate unsigned XML ──────────────────────────────────────────────
    let unsignedXml;
    try {
        const invoiceData = fixture.data();
        unsignedXml = generateUBL21XML(invoiceData);

        // Save snapshot
        const unsignedPath = path.join(SNAPSHOT_DIR, `${typeKey}_unsigned.xml`);
        fs.writeFileSync(unsignedPath, unsignedXml, 'utf8');
        diag.unsigned = { path: unsignedPath, size_bytes: Buffer.byteLength(unsignedXml, 'utf8') };
        console.log(`  [✓] Unsigned XML generated → ${unsignedPath}`);
    } catch (e) {
        diag.errors.push({ phase: 'generate_unsigned', message: e.message });
        diag.status = 'FAIL';
        return diag;
    }

    // ── 2. Validate unsigned XML structure ────────────────────────────────────
    try {
        diag.validation.unsigned = validateXMLStructure(unsignedXml, 'unsigned');
    } catch (e) {
        diag.warnings.push({ phase: 'validate_unsigned', message: e.message });
    }

    // ── 3. Compute invoice hash ───────────────────────────────────────────────
    try {
        const hash = hashXML(unsignedXml);
        diag.hash = { base64: hash, hex: Buffer.from(hash, 'base64').toString('hex') };
        console.log(`  [✓] Invoice hash: ${hash}`);
    } catch (e) {
        diag.errors.push({ phase: 'hash_xml', message: e.message });
    }

    // ── 4. Generate signed XML ────────────────────────────────────────────────
    let signedXml;
    try {
        const invoiceData = fixture.data();
        const mockSettings = settings || {
            business_name_ar: SANDBOX_SELLER.name,
            vat_number:       SANDBOX_VAT_NO,
        };
        const effectiveDevice = device || SANDBOX_DEVICE_OFFLINE;

        const { signedXml: sx } = signAndPackageInvoice({
            xml:       unsignedXml,
            device:    effectiveDevice,
            settings:  mockSettings,
            timestamp: invoiceData.timestamp,
            total:     invoiceData.total,
            tax:       parseFloat((invoiceData.total * 0.15 / 1.15).toFixed(2)),
        });
        signedXml = sx;

        const signedPath = path.join(SNAPSHOT_DIR, `${typeKey}_signed.xml`);
        fs.writeFileSync(signedPath, signedXml, 'utf8');
        diag.signed = { path: signedPath, size_bytes: Buffer.byteLength(signedXml, 'utf8') };
        const sigMode = effectiveDevice.production_cert_pem ? 'FULL_XADES' : 'TLV_ONLY_NO_CERT';
        console.log(`  [✓] Signed XML generated (mode: ${sigMode}) → ${signedPath}`);
    } catch (e) {
        diag.errors.push({ phase: 'sign_xml', message: e.message });
        diag.status = 'FAIL';
        return diag;
    }

    // ── 5. Extract and decode QR TLV ─────────────────────────────────────────
    try {
        const qrBase64 = extractQRFromXML(signedXml);
        diag.qr = {
            base64: qrBase64 ? qrBase64.slice(0, 60) + (qrBase64.length > 60 ? '…' : '') : null,
            decoded: decodeQRTLV(qrBase64),
        };
        if (qrBase64) {
            console.log(`  [✓] QR TLV extracted (${Buffer.from(qrBase64, 'base64').length} bytes)`);
        } else {
            diag.warnings.push({ phase: 'extract_qr', message: 'No QR TLV found in signed XML' });
            console.warn(`  [!] QR TLV not found in signed XML`);
        }
    } catch (e) {
        diag.warnings.push({ phase: 'extract_qr', message: e.message });
    }

    // ── 6. Validate signed XML structure ─────────────────────────────────────
    try {
        const effectiveSigMode = (device && device.production_cert_pem) ? 'FULL_XADES' : 'TLV_ONLY';
        diag.validation.signed = validateXMLStructure(signedXml, 'signed', effectiveSigMode);
    } catch (e) {
        diag.warnings.push({ phase: 'validate_signed', message: e.message });
    }

    // ── 7. Compute final status ───────────────────────────────────────────────
    const hasErrors   = diag.errors.length > 0;
    const unsignedFail = diag.validation.unsigned && diag.validation.unsigned.status === 'FAIL';
    const signedFail   = diag.validation.signed   && diag.validation.signed.status   === 'FAIL';

    if (hasErrors || unsignedFail || signedFail) {
        diag.status = 'FAIL';
    } else if (diag.warnings.length > 0 ||
               (diag.validation.unsigned && diag.validation.unsigned.status === 'WARN') ||
               (diag.validation.signed   && diag.validation.signed.status   === 'WARN')) {
        diag.status = 'WARN';
    } else {
        diag.status = 'PASS';
    }

    return diag;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT PRINTER
// ─────────────────────────────────────────────────────────────────────────────

function printReport(results) {
    const ICONS = { PASS: '✅', FAIL: '❌', WARN: '⚠️', PENDING: '⏳' };
    const LINE  = '═'.repeat(72);

    console.log(`\n${LINE}`);
    console.log('  ZATCA PHASE 4 — VALIDATION REPORT');
    console.log(`  Generated: ${new Date().toISOString()}`);
    console.log(LINE);

    for (const diag of results) {
        const icon = ICONS[diag.status] || '?';
        console.log(`\n${icon}  [${diag.type.toUpperCase()}] ${diag.label}`);
        console.log(`   Status: ${diag.status}`);

        if (diag.cert.available) {
            const certStatus = diag.cert.expired  ? '❌ EXPIRED'
                             : diag.cert.expires_soon ? `⚠️  ${diag.cert.days_remaining}d remaining`
                             : `✓ ${diag.cert.days_remaining}d remaining`;
            console.log(`   Cert:   ${certStatus}  [${diag.cert.cert_hash}]`);
            if (diag.cert.vat_in_cert) console.log(`   VAT in cert: ${diag.cert.vat_in_cert}`);
        } else {
            console.log(`   Cert:   ⚠️  No production cert — offline TLV mode`);
        }

        if (diag.hash) {
            console.log(`   Hash:   ${diag.hash.base64}`);
        }

        if (diag.qr && diag.qr.decoded && diag.qr.decoded._parsed_ok) {
            const d = diag.qr.decoded;
            console.log(`   QR Tags: ${d._total_tags} decoded`);
            if (d.seller_name)       console.log(`     Tag 1 (seller):    ${d.seller_name}`);
            if (d.vat_number)        console.log(`     Tag 2 (VAT):       ${d.vat_number}`);
            if (d.timestamp)         console.log(`     Tag 3 (timestamp): ${d.timestamp}`);
            if (d.total_with_vat)    console.log(`     Tag 4 (total):     ${d.total_with_vat}`);
            if (d.vat_amount)        console.log(`     Tag 5 (VAT amt):   ${d.vat_amount}`);
            if (d.invoice_hash)      console.log(`     Tag 6 (hash):      ${d.invoice_hash.length} bytes`);
            if (d.signature)         console.log(`     Tag 7 (sig):       ${d.signature.length} bytes`);
            if (d.public_key)        console.log(`     Tag 8 (pubkey):    ${d.public_key.length} bytes`);
            if (d.certificate_signature) console.log(`     Tag 9 (cert sig): ${d.certificate_signature.length} bytes`);
        } else if (diag.qr && diag.qr.decoded && diag.qr.decoded.error) {
            console.log(`   QR:     ⚠️  ${diag.qr.decoded.error}`);
        }

        // Validation scores
        for (const [phase, vr] of [['unsigned', diag.validation.unsigned], ['signed', diag.validation.signed]]) {
            if (!vr) continue;
            const s = ICONS[vr.status] || '?';
            console.log(`   XML [${phase}]: ${s} ${vr.passed}/${vr.total} checks passed (${vr.score}%)`);
            if (vr.failed > 0) {
                const fails = vr.checks.filter(c => !c.present);
                for (const f of fails) {
                    console.log(`      ❌ Missing: ${f.label || f.element}`);
                }
            }
            if (vr.warnings.length > 0) {
                for (const w of vr.warnings) console.log(`      ⚠️  ${w}`);
            }
        }

        if (diag.errors.length > 0) {
            for (const e of diag.errors) {
                console.log(`   ❌ ERROR [${e.phase}]: ${e.message}`);
            }
        }
        if (diag.warnings.length > 0) {
            for (const w of diag.warnings) {
                console.log(`   ⚠️  WARN [${w.phase}]: ${w.message}`);
            }
        }

        if (diag.unsigned) console.log(`   📄 Unsigned: ${diag.unsigned.path}`);
        if (diag.signed)   console.log(`   📄 Signed:   ${diag.signed.path}`);
    }

    console.log(`\n${LINE}`);
    const passed  = results.filter(r => r.status === 'PASS').length;
    const warned  = results.filter(r => r.status === 'WARN').length;
    const failed  = results.filter(r => r.status === 'FAIL').length;
    console.log(`  SUMMARY: ${passed} PASS  ${warned} WARN  ${failed} FAIL  (of ${results.length} types)`);
    console.log(LINE);

    // Save full structured diagnostics JSON
    const reportPath = path.join(SNAPSHOT_DIR, `validation_report_${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n  📊 Full structured diagnostics → ${reportPath}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ENTRYPOINT
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    const args     = process.argv.slice(2);
    const runAll   = args.includes('--all');
    const typeArg  = (() => { const i = args.indexOf('--type'); return i >= 0 ? args[i + 1] : null; })();

    const typesToRun = runAll
        ? Object.keys(INVOICE_FIXTURES)
        : typeArg
            ? [typeArg]
            : Object.keys(INVOICE_FIXTURES);  // default: run all

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║           ZATCA Phase 4 — Validation Runner                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log(`\nTypes to validate: ${typesToRun.join(', ')}`);
    console.log(`Snapshot dir: ${SNAPSHOT_DIR}\n`);

    // Try to load live device cert (best-effort; falls back to offline mode)
    const liveDevice = tryLoadLiveDevice();
    if (liveDevice) {
        console.log('[INFO] Found live ZATCA device in DB — using production cert for signing');
    } else {
        console.log('[INFO] No live ZATCA device found — running in offline/TLV-only mode');
    }

    const results = [];

    for (const typeKey of typesToRun) {
        console.log(`\n──── ${typeKey.toUpperCase()} ────`);
        try {
            const diag = await runInvoiceValidation(typeKey, liveDevice, null);
            results.push(diag);
        } catch (e) {
            console.error(`[FATAL] ${typeKey}: ${e.message}`);
            results.push({ type: typeKey, status: 'FAIL', errors: [{ phase: 'runner', message: e.message }] });
        }
    }

    printReport(results);

    const exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
    process.exit(exitCode);
}

main().catch(e => {
    console.error('[FATAL] Validation runner crashed:', e);
    process.exit(1);
});
