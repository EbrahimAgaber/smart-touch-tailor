'use strict';
// ELECTRON-INTERNAL DIAGNOSTIC — injected via main.cjs
// Call window.diagQR() from DevTools console, then check the log file.
// Log is written to userData/diag_qr.log

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function runDiagQR({ db, zatcaPhase2, settings, app }) {
    const logPath = path.join(app.getPath('userData'), 'diag_qr.log');
    const lines = [];
    const log = (...a) => { const s = a.join(' '); console.log('[DIAG]', s); lines.push(s); };

    try {
        log('=== ZATCA QR DIAGNOSTIC ===', new Date().toISOString());

        // ── 1. Device private key ─────────────────────────────────────────────
        const device = db.getZatcaDevice();
        if (!device) { log('ERROR: no zatca_device row'); return; }
        log('\n--- Device private key ---');
        try {
            const privKey = crypto.createPrivateKey(device.private_key_pem);
            log('curve:', privKey.asymmetricKeyDetails?.namedCurve);
            log('type :', privKey.asymmetricKeyType);
            const pubPem = crypto.createPublicKey(device.private_key_pem).export({ type: 'spki', format: 'pem' });
            const pubDer = Buffer.from(pubPem.replace(/-----[^\n]+-----/g, '').replace(/\s/g, ''), 'base64');
            log('pubkey DER len:', pubDer.length);
            log('pubkey DER hex[0:12]:', pubDer.slice(0, 12).toString('hex'));
        } catch (e) {
            log('private_key_pem parse FAILED (BoringSSL):', e.message);
            // [FIX-SECP256K1] Not necessarily corrupt — Electron's BoringSSL simply
            // cannot parse secp256k1 keys at all. Check via the manual DER walk.
            if (zatcaPhase2.isValidECPrivateKeyPem && zatcaPhase2.isValidECPrivateKeyPem(device.private_key_pem)) {
                log('  -> but isValidECPrivateKeyPem() says this IS a usable secp256k1 key (manual DER scalar found). Expected after the secp256k1 fix.');
            } else {
                log('  -> isValidECPrivateKeyPem() also rejects it. This key is genuinely corrupt.');
            }
        }

        // ── 2. Compliance cert ────────────────────────────────────────────────
        log('\n--- Compliance cert ---');
        const compCsidRaw = device.compliance_csid;
        if (!compCsidRaw) { log('ERROR: compliance_csid is NULL'); return; }
        const compCsid = JSON.parse(compCsidRaw);
        const cleanToken = compCsid.binarySecurityToken.replace(/[\n\r\s]/g, '');
        const compCertPem = `-----BEGIN CERTIFICATE-----\n${cleanToken.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
        log('token length:', cleanToken.length);

        try {
            const x509 = new crypto.X509Certificate(Buffer.from(cleanToken, 'base64'));
            log('subject:', x509.subject.replace(/\n/g, ' | '));
            log('issuer :', x509.issuer.replace(/\n/g, ' | '));
            log('serial :', x509.serialNumber);
            try {
                const pk = x509.publicKey.export({ type: 'spki', format: 'pem' });
                const pkDer = Buffer.from(pk.replace(/-----[^\n]+-----/g, '').replace(/\s/g, ''), 'base64');
                log('publicKey.export(): SUCCEEDED, DER len:', pkDer.length, 'hex[0:12]:', pkDer.slice(0,12).toString('hex'));
            } catch (e) { log('publicKey.export(): FAILED —', e.message); }
        } catch (e) { log('X509Certificate parse FAILED:', e.message); }

        // ── 3. extractCertDetails ─────────────────────────────────────────────
        log('\n--- extractCertDetails ---');
        const certDetails = zatcaPhase2.extractCertDetails(compCertPem);
        log('pubKeyPem length  :', certDetails.pubKeyPem?.length);
        log('pubKeyPem start   :', certDetails.pubKeyPem?.substring(0, 60));
        log('certSignature len :', certDetails.certSignature?.length);
        log('certSignature start:', certDetails.certSignature?.substring(0, 40));
        log('vatNumber         :', certDetails.vatNumber);

        if (certDetails.pubKeyPem) {
            const spkiDer = Buffer.from(certDetails.pubKeyPem.replace(/-----[^\n]+-----/g, '').replace(/\s/g, ''), 'base64');
            log('SPKI DER len:', spkiDer.length, 'hex[0:16]:', spkiDer.slice(0, 16).toString('hex'));
        }

        // ── 4. signInvoiceXML ─────────────────────────────────────────────────
        log('\n--- signInvoiceXML ---');
        try {
            const { generateUBL21XML } = require('./electron/zatca_utils.cjs');
            const address = {
                street: settings.address_street || 'شارع الملك',
                building: settings.address_building || '1234',
                district: settings.address_district || 'الصحافة',
                city: settings.address_city || 'الرياض',
                postal: settings.address_postal || '12345',
                country: 'SA',
            };
            const ts = new Date().toISOString();
            const xml = generateUBL21XML({
                invoice: `DIAG-${Date.now()}`, timestamp: ts,
                total: '115.00',
                items: [{ Name: 'Test', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
                seller: settings.business_name_ar || 'مؤسسة تجارية',
                vatNo: certDetails.vatNumber || settings.vat_number || '300000000000003',
                vatRate: 0.15, address,
                uuid: crypto.randomUUID(),
                prevHash: 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==',
                icv: 1,
            });

            const { envelope, invoiceHashBase64, signatureBase64, rawSigBase64 } = zatcaPhase2.signInvoiceXML(
                xml, device.private_key_pem, compCertPem, ts
            );
            log('signInvoiceXML: OK');
            log('invoiceHashBase64 len:', invoiceHashBase64?.length);
            log('signatureBase64 len  :', signatureBase64?.length, '← used for TLV tag 7');
            log('rawSigBase64 len     :', rawSigBase64?.length);

            // ── 5. TLV tag inventory ──────────────────────────────────────────
            log('\n--- TLV tag inventory ---');
            const calcTax = (115 - 115 / 1.15).toFixed(2);
            const tlv = zatcaPhase2.generateZatcaTLV9(
                settings.business_name_ar || 'مؤسسة تجارية',
                certDetails.vatNumber || settings.vat_number || '300000000000003',
                ts, '115.00', calcTax,
                invoiceHashBase64, signatureBase64,
                certDetails.pubKeyPem, certDetails.certSignature
            );
            const tlvBuf = Buffer.from(tlv, 'base64');
            log('TLV total bytes:', tlvBuf.length);
            let offset = 0, tc = 0;
            while (offset < tlvBuf.length && tc < 15) {
                const tag = tlvBuf[offset];
                const lb  = tlvBuf[offset + 1];
                let len, vs;
                if (lb & 0x80) { const n = lb & 0x7f; len = 0; for(let i=0;i<n;i++) len=(len<<8)|tlvBuf[offset+2+i]; vs=offset+2+n; }
                else { len = lb; vs = offset + 2; }
                const hex = tlvBuf.slice(vs, vs + Math.min(len, 12)).toString('hex');
                log(`  Tag ${tag}: len=${len}  hex[0:12]=${hex}`);
                offset = vs + len; tc++;
            }

            // ── 6. Key match check ────────────────────────────────────────────
            log('\n--- Key match check (does cert pubkey match device privkey?) ---');
            if (certDetails.pubKeyPem) {
                const certSpkiDer = Buffer.from(certDetails.pubKeyPem.replace(/-----[^\n]+-----/g, '').replace(/\s/g, ''), 'base64');
                log('cert SPKI DER len:', certSpkiDer.length);
                log('cert SPKI hex[0:16]:', certSpkiDer.slice(0,16).toString('hex'));
                // Extract the raw 04-prefixed uncompressed public point from cert SPKI.
                // SPKI for EC: SEQUENCE { SEQUENCE { OID ecPublicKey, OID curve }, BIT STRING { 00, point } }
                // The point starts after the BIT STRING tag+len+pad (00 byte).
                let certPubPoint = null;
                try {
                    // Walk: outer SEQUENCE -> skip AlgorithmIdentifier SEQUENCE -> BIT STRING
                    let p = 0;
                    const rTLV = (b, o) => { const t=b[o],lb=b[o+1]; let l,vs; if(lb&0x80){const n=lb&0x7f;l=0;for(let i=0;i<n;i++)l=(l<<8)|b[o+2+i];vs=o+2+n;}else{l=lb;vs=o+2;} return{t,l,vs,ne:vs+l}; };
                    const outer2 = rTLV(certSpkiDer, 0); p = outer2.vs;
                    const alg = rTLV(certSpkiDer, p); p = alg.ne; // skip AlgorithmIdentifier
                    const bs = rTLV(certSpkiDer, p); // BIT STRING
                    // BIT STRING value: first byte is unused-bits count (always 0 for EC)
                    certPubPoint = certSpkiDer.slice(bs.vs + 1, bs.ne); // 65 bytes: 04 || x || y
                    log('cert pubkey point len:', certPubPoint.length, 'prefix:', certPubPoint[0].toString(16));
                } catch(pe) { log('cert point extraction failed:', pe.message); }

                // Extract device public point via elliptic (bypasses BoringSSL)
                let devPubPoint = null;
                try {
                    const EC = require('elliptic').ec;
                    const ec = new EC('secp256k1');
                    const scalar = zatcaPhase2._pkcs8ToECScalar
                        ? zatcaPhase2._pkcs8ToECScalar(device.private_key_pem)
                        : null;
                    if (scalar && scalar.length === 32) {
                        const kp = ec.keyFromPrivate(scalar);
                        devPubPoint = Buffer.from(kp.getPublic().encode('array', false)); // 65 bytes uncompressed
                        log('device pubkey point len:', devPubPoint.length, 'prefix:', devPubPoint[0].toString(16));
                        log('device pubkey hex[0:16]:', devPubPoint.slice(0,16).toString('hex'));
                    } else {
                        log('device scalar extraction failed or wrong length:', scalar?.length);
                    }
                } catch(ee) { log('device point via elliptic failed:', ee.message); }

                if (certPubPoint && devPubPoint) {
                    const match = certPubPoint.equals(devPubPoint);
                    log('POINT MATCH:', match ? 'YES ✓ — key and cert are consistent' : 'NO ✗ — KEY MISMATCH — signing key does not match compliance cert public key');
                    if (!match) {
                        log('cert  point hex[0:16]:', certPubPoint.slice(0,16).toString('hex'));
                        log('device point hex[0:16]:', devPubPoint.slice(0,16).toString('hex'));
                    }
                }
            }

            // ── 7. Canonical XML dump ─────────────────────────────────────────
            log('\n--- Canonical XML hash source ---');
            try {
                const signedXmlFull = zatcaPhase2.injectUBLExtensions(xml, envelope);
                const c14nFromRaw    = zatcaPhase2.canonicalizeInvoiceXML(xml);
                const c14nFromSigned = zatcaPhase2.canonicalizeInvoiceXML(signedXmlFull);
                const hashFromRaw    = crypto.createHash('sha256').update(Buffer.from(c14nFromRaw,'utf8')).digest('base64');
                const hashFromSigned = crypto.createHash('sha256').update(Buffer.from(c14nFromSigned,'utf8')).digest('base64');
                log('hash(C14N(rawXml))   :', hashFromRaw);
                log('hash(C14N(signedXml)):', hashFromSigned);
                log('invoiceHashBase64    :', invoiceHashBase64);
                log('all three match:', (hashFromRaw === hashFromSigned && hashFromSigned === invoiceHashBase64) ? 'YES ✓' : 'NO ✗');
                log('C14N raw    len:', c14nFromRaw.length, 'first 120 chars:', c14nFromRaw.slice(0,120));
                log('C14N signed len:', c14nFromSigned.length, 'first 120 chars:', c14nFromSigned.slice(0,120));
                if (c14nFromRaw !== c14nFromSigned) {
                    // Find first divergence
                    let diff = -1;
                    for (let i = 0; i < Math.min(c14nFromRaw.length, c14nFromSigned.length); i++) {
                        if (c14nFromRaw[i] !== c14nFromSigned[i]) { diff = i; break; }
                    }
                    log('FIRST DIVERGENCE at char', diff, ':', JSON.stringify(c14nFromRaw.slice(Math.max(0,diff-20), diff+40)), 'vs', JSON.stringify(c14nFromSigned.slice(Math.max(0,diff-20), diff+40)));
                }
            } catch(ce) { log('C14N dump failed:', ce.message); }

        } catch (e) {
            log('signInvoiceXML FAILED:', e.message);
        }

    } catch (e) {
        log('DIAG EXCEPTION:', e.message, e.stack);
    }

    fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
    log('\nLog written to:', logPath);
}

module.exports = { runDiagQR };
