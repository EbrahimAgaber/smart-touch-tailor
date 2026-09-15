/**
 * Diagnostic script — report only, no fixes.
 * 1. BR-KSA-28/30: byte-compare the literal strings in submitted XML
 * 2. QR TLV: measure actual byte length, compare with elliptic vs simulated native signature size
 * 3. Report signature DER raw hex (elliptic)
 */
const { app } = require('electron');
const db = require('./electron/database.cjs');
const zatcaPhase2 = require('./electron/zatca_phase2.cjs');

// Pull signEcdsaSha256 and elliptic directly out of zatca_phase2.cjs
// (we need the actual signer for the DER comparison)
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const forge = require('node-forge');
const crypto = require('crypto');

app.whenReady().then(async () => {
    db.initDatabase('C:/Users/bin-g/AppData/Roaming/البصمة الذكية');
    const device = db.getZatcaDevice();
    const settings = db.getSettings();
    const zatcaEnv = settings.zatca_env || 'sandbox';
    const { generateUBL21XML } = require('./electron/zatca_utils.cjs');

    // ── Reconstruct the compCertPem from the user-provided token ──────────────
    const token = "TUlJQ0VEQ0NBYmVnQXdJQkFnSUdBWjhxSlZnWk1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nall3TnpBek1qSTBNVFV6V2hjTk16RXdOekF6TWpFd01EQXdXakJmTVFzd0NRWURWUVFHRXdKVFFURVVNQklHQTFVRUN3d0xTR1ZoWkNCUFptWnBZMlV4SmpBa0JnTlZCQW9NSFUxaGVHbHRkVzBnVTNCbFpXUWdWR1ZqYUNCVGRYQndiSGtnVEZSRU1SSXdFQVlEVlFRRERBbGFRVlJEUVMxRlIxTXdWakFRQmdjcWhrak9QUUlCQmdVcmdRUUFDZ05DQUFTN3lxVC9hTjdnNXgzY0ZuSndTQXdidk5yZ3JiSVFFWXhsZXF0YzlYMzZOTGljMVMyWVB0QjF2S21GRFNxVlAyUHM2alhUUWFXM2I3eHAxdjJydVZFU280R3JNSUdvTUF3R0ExVWRFd0VCL3dRQ01BQXdnWmNHQTFVZEVRU0JqekNCaktTQmlUQ0JoakVrTUNJR0ExVUVCQXdiTVMxVGJXRnlkRlJ2ZFdOb2ZESXRVRTlUZkRNdFVFOVRMVEF4TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXprNU9UazVPVGs1T1RBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SMHdHd1lEVlFRYURCVERtTUtudzVuQ2hNT1l3cm5EbWNLRXc1akNwekVQTUEwR0ExVUVEd3dHVW1WMFlXbHNNQW9HQ0NxR1NNNDlCQU1DQTBjQU1FUUNJQlVZMjl5dUJvY2lVUHY3QVB1K1Zhc2lleCtjZ1RkTHh4Uitic0xKb0FxWkFpQXF6MldlSzRzMnJ2bysyTklOenFpb1NBWk1ZWGNEZjlsQnpoNEc0QXV4U2c9PQ==";
    const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
    const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

    const uuid = crypto.randomUUID();
    const ts = new Date().toISOString();
    const invoiceData = {
        invoice: `DIAG-${Date.now()}`,
        timestamp: ts,
        total: '115.00',
        items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
        seller: settings.business_name_ar,
        vatNo: settings.vat_number,
        vatRate: 0.15,
        address: {
            street: settings.address_street || 'شارع',
            building: settings.address_building || '1111',
            district: settings.address_district || 'حي',
            city: settings.address_city || 'الرياض',
            postal: settings.address_postal || '12345',
            country: settings.address_country || 'SA'
        }
    };
    const xml = generateUBL21XML({ ...invoiceData, uuid, prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=', icv: 1 });

    // ── FINDING 1: BR-KSA-28/30 — literal byte comparison ─────────────────────
    console.log('\n========== FINDING 1: BR-KSA-28/30 LITERAL STRING COMPARISON ==========');
    const REQUIRED_28 = 'urn:oasis:names:specification:ubl:signature:1';
    const REQUIRED_30 = 'urn:oasis:names:specification:ubl:dsig:enveloped:xades';

    const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
        xml, device.private_key_pem, compCertPem, ts
    );
    const signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);

    // Check if the required strings are present in the FINAL signedXml submitted to ZATCA
    const has28 = signedXml.includes(REQUIRED_28);
    const has30 = signedXml.includes(REQUIRED_30);

    console.log(`BR-KSA-28 required: "${REQUIRED_28}"`);
    console.log(`BR-KSA-28 found in submitted XML: ${has28}`);
    console.log(`BR-KSA-30 required: "${REQUIRED_30}"`);
    console.log(`BR-KSA-30 found in submitted XML: ${has30}`);

    // Count occurrences — must be in the UBLExtension/SignatureInformation context
    const count28 = (signedXml.match(new RegExp(REQUIRED_28.replace(/:/g, '\\:'), 'g')) || []).length;
    const count30 = (signedXml.match(new RegExp(REQUIRED_30.replace(/:/g, '\\:'), 'g')) || []).length;
    console.log(`Occurrences of signature:1 string: ${count28}`);
    console.log(`Occurrences of dsig:enveloped:xades string: ${count30}`);

    // Extract the UBLExtensions block from submitted XML for manual inspection
    const ublBlockMatch = signedXml.match(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/);
    if (ublBlockMatch) {
        console.log('\nSubmitted UBLExtensions block (first 2000 chars):');
        console.log(ublBlockMatch[0].substring(0, 2000));
    } else {
        console.log('\n!! UBLExtensions block NOT FOUND in submitted XML !!');
    }

    // ── FINDING 2: QR TLV byte length ─────────────────────────────────────────
    console.log('\n========== FINDING 2: QR TLV BYTE LENGTH ==========');

    // The compliance checklist does NOT call injectQRPayload — QR field is empty in submitted XML
    // Confirm what the QR field looks like in the submitted signedXml
    const qrMatch = signedXml.match(/<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/);
    if (qrMatch) {
        console.log('\nQR block in submitted XML:');
        console.log(qrMatch[0]);
        const embeddedMatch = qrMatch[0].match(/<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]*)<\/cbc:EmbeddedDocumentBinaryObject>/);
        if (embeddedMatch) {
            const qrContent = embeddedMatch[1].trim();
            console.log(`\nQR EmbeddedDocumentBinaryObject content length: ${qrContent.length} chars`);
            if (qrContent.length === 0) {
                console.log('QR CONTENT IS EMPTY — this is the QRCODE_INVALID + BR-CL-KSA-14 root cause');
                console.log('The compliance checklist runOne() path does NOT call injectQRPayload()');
            } else {
                const qrBytes = Buffer.from(qrContent, 'base64');
                console.log(`QR TLV byte length: ${qrBytes.length} bytes`);
                if (qrBytes.length > 750) {  // 1000 char base64 ≈ 750 bytes
                    console.log('QR TLV EXCEEDS 1000 BASE64 CHARS — BR-CL-KSA-14 root cause');
                }
            }
        }
    } else {
        console.log('QR block not found in signedXml');
    }

    // ── FINDING 3: Signature DER byte length — elliptic vs. expected native ────
    console.log('\n========== FINDING 3: SIGNATURE DER BYTE LENGTH ==========');

    // Get the actual elliptic DER signature that was just produced
    const ellipticSigBase64 = signatureBase64;
    const ellipticSigBytes = Buffer.from(ellipticSigBase64, 'base64');
    console.log(`Elliptic DER signature byte length: ${ellipticSigBytes.length}`);
    console.log(`Elliptic DER signature hex: ${ellipticSigBytes.toString('hex')}`);

    // For comparison: generate a second signature with the same key to show variability
    // (ECDSA signatures are non-deterministic unless using RFC 6979)
    const { envelope: envelope2, signatureBase64: sig2Base64 } = zatcaPhase2.signInvoiceXML(
        xml, device.private_key_pem, compCertPem, ts
    );
    const sig2Bytes = Buffer.from(sig2Base64, 'base64');
    console.log(`\nElliptic DER signature #2 byte length: ${sig2Bytes.length}`);
    console.log(`Elliptic DER signature #2 hex: ${sig2Bytes.toString('hex')}`);

    // Parse the DER to show R and S lengths individually
    // DER ECDSA: SEQUENCE { INTEGER r, INTEGER s }
    const parseDer = (buf) => {
        if (buf[0] !== 0x30) return null;
        let offset = 2;
        const rLen = buf[offset + 1];
        const rStart = offset + 2;
        const r = buf.slice(rStart, rStart + rLen);
        offset = rStart + rLen;
        const sLen = buf[offset + 1];
        const sStart = offset + 2;
        const s = buf.slice(sStart, sStart + sLen);
        return { rLen, sLen, r: r.toString('hex'), s: s.toString('hex') };
    };

    const parsed1 = parseDer(ellipticSigBytes);
    const parsed2 = parseDer(sig2Bytes);
    if (parsed1) {
        console.log(`\nSig #1 — R length: ${parsed1.rLen} bytes, S length: ${parsed1.sLen} bytes`);
        console.log(`  R: ${parsed1.r}`);
        console.log(`  S: ${parsed1.s}`);
    }
    if (parsed2) {
        console.log(`\nSig #2 — R length: ${parsed2.rLen} bytes, S length: ${parsed2.sLen} bytes`);
        console.log(`  R: ${parsed2.r}`);
        console.log(`  S: ${parsed2.s}`);
    }

    // Check if high-S (not low-S normalized): for secp256k1, n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const halfN = n / 2n;
    if (parsed1) {
        const sVal = BigInt('0x' + parsed1.s);
        const highS = sVal > halfN;
        console.log(`\nSig #1 high-S (not low-S normalized): ${highS}`);
        if (highS) console.log('  --> S value is above half-order. Some validators reject high-S signatures.');
    }

    // Show what the QR would look like IF we generated it for this invoice
    console.log('\n========== WHAT QR WOULD LOOK LIKE (if generated) ==========');
    const { pubKeyPem, certSignature } = zatcaPhase2.extractCertDetails(compCertPem);
    const tlvBuffer = require('./electron/zatca_phase2.cjs');  // Can't call generateZatcaTLV9 directly (not exported)
    // Instead, let's compute it manually inline:
    const tlvEncode = (tag, valueBuf) => {
        const len = valueBuf.length;
        let lenBuf;
        if (len <= 127) lenBuf = Buffer.from([len]);
        else if (len <= 255) lenBuf = Buffer.from([0x81, len]);
        else lenBuf = Buffer.from([0x82, (len >> 8) & 0xFF, len & 0xFF]);
        return Buffer.concat([Buffer.from([tag]), lenBuf, valueBuf]);
    };
    const cleanTime = ts.replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
    const tags = [
        tlvEncode(1, Buffer.from(String(settings.business_name_ar || ''), 'utf8')),
        tlvEncode(2, Buffer.from(String(settings.vat_number || ''), 'utf8')),
        tlvEncode(3, Buffer.from(cleanTime, 'utf8')),
        tlvEncode(4, Buffer.from((115.00).toFixed(2), 'utf8')),
        tlvEncode(5, Buffer.from((15.00).toFixed(2), 'utf8')),
    ];
    // xmlHash
    tags.push(tlvEncode(6, Buffer.from(String(invoiceHashBase64), 'utf8')));
    // ecdsaSig — this is the base64 signature string
    tags.push(tlvEncode(7, Buffer.from(String(ellipticSigBase64), 'utf8')));
    // pubKey raw DER bytes
    if (pubKeyPem) {
        const pkB64 = pubKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/[\n\r]/g, '');
        tags.push(tlvEncode(8, Buffer.from(pkB64, 'base64')));
    }
    // certSignature
    if (certSignature) tags.push(tlvEncode(9, Buffer.from(certSignature, 'base64')));

    const tlvBuf = Buffer.concat(tags);
    const tlvBase64 = tlvBuf.toString('base64');
    console.log(`TLV total byte length: ${tlvBuf.length} bytes`);
    console.log(`TLV base64 length: ${tlvBase64.length} chars (limit 1000 base64 chars = 750 bytes raw)`);
    console.log(`EXCEEDS 1000 CHAR LIMIT: ${tlvBase64.length > 1000}`);
    
    // Break down by tag size
    let offset = 0;
    const tagNames = { 1: 'seller', 2: 'vatNo', 3: 'timestamp', 4: 'total', 5: 'vat', 6: 'xmlHash', 7: 'ecdsaSig', 8: 'pubKey', 9: 'certSig' };
    const rebuilt = Buffer.concat(tags);
    let ptr = 0;
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i][0];
        const firstLenByte = tags[i][1];
        let headerLen;
        if (firstLenByte <= 127) headerLen = 2;
        else if (firstLenByte === 0x81) headerLen = 3;
        else headerLen = 4;
        const valueLen = tags[i].length - headerLen;
        console.log(`  Tag ${tag} (${tagNames[tag] || '?'}): ${valueLen} bytes`);
    }

    console.log('\nDone.');
    app.quit();
});
