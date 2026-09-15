/**
 * ZATCA DIAGNOSTIC SCRIPT
 * =======================
 * Purpose: Compare what the SANDBOX vs SIMULATION production/csids endpoint
 *          actually returns — specifically whether the cert VAT matches the
 *          VAT we put in the CSR, or if it's always 399999999900003.
 *
 * Test A: Sandbox  — compliance on sandbox → production CSID on sandbox
 * Test B: Simulation — compliance on simulation → production CSID on simulation
 *
 * For each test we decode the production cert and print:
 *   - Not Before (was it pre-issued or minted today?)
 *   - UID / VAT in the cert subject
 *   - Serial / device SN
 *   - Whether cert VAT === our CSR VAT
 *
 * Run with:  node diag_simulation_cert.cjs
 */

'use strict';

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const axios        = require('axios');
const crypto       = require('crypto');

// ── Configuration ────────────────────────────────────────────────────────────
const VAT_NUMBER    = '300075585600003';   // your real VAT from settings
const ORG_NAME      = 'Maximum Speed Tech Supply LTD';
const DEVICE_SN     = 'POS-DIAG-01';
const OTP_SANDBOX   = '123456';            // sandbox accepts any OTP
const OTP_SIMULATION= '123456';            // simulation MAY need a real OTP from Fatoora portal
                                           // Try 123456 first; if 400, you need a real one

const URLS = {
    sandbox: {
        compliance : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance',
        production : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/production/csids',
    },
    simulation: {
        compliance : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance',
        production : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/production/csids',
    },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(label, msg) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${label}] ${msg}`);
}

function _resolveOpenSSL() {
    const candidates = [
        path.join(__dirname, 'electron', 'vendor', 'openssl', 'openssl.exe'),
        'openssl',
        'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
        'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
    ];
    for (const c of candidates) {
        try { execSync(`"${c}" version`, { stdio: 'pipe' }); return `"${c}"`; } catch (_) {}
    }
    throw new Error('openssl not found — install Git for Windows or OpenSSL');
}

function generateCSR(vatNumber, orgName, deviceSn, env = 'sandbox') {
    const opensslCmd = _resolveOpenSSL();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zatca-diag-'));

    try {
        const certTypeExt = (env === 'sandbox' || env === 'simulation')
            ? 'TSTZATCA-Code-Signing'
            : 'ZATCA-Code-Signing';

        const serial = `1-SmartTouch|2-POS|3-${deviceSn}`;
        const ou     = vatNumber.substring(0, 10);

        const conf = [
            'oid_section = OIDs',
            '[OIDs]',
            'certificateTemplateName = 1.3.6.1.4.1.311.20.2',
            '',
            '[req]',
            'default_bits = 2048',
            'req_extensions = v3_req',
            'distinguished_name = dn',
            'prompt = no',
            '',
            '[dn]',
            'C = SA',
            `OU = ${ou}`,
            `O = ${orgName}`,
            'CN = ZATCA-EGS',
            '',
            '[v3_req]',
            `certificateTemplateName = ASN1:PRINTABLESTRING:${certTypeExt}`,
            'subjectAltName = dirName:alt_names',
            '',
            '[alt_names]',
            `SN = ${serial}`,
            `UID = ${vatNumber}`,
            'title = 1100',
            'registeredAddress = Riyadh',
            'businessCategory = Retail',
        ].join('\n');

        const confPath = path.join(tmpDir, 'csr.cnf');
        const keyPath  = path.join(tmpDir, 'key.pem');
        const csrPath  = path.join(tmpDir, 'csr.pem');

        fs.writeFileSync(confPath, conf, 'utf8');

        execSync(`${opensslCmd} ecparam -name secp256k1 -genkey -noout -out "${keyPath}"`, { stdio: 'pipe' });
        execSync(`${opensslCmd} req -new -sha256 -key "${keyPath}" -extensions v3_req -config "${confPath}" -out "${csrPath}"`, { stdio: 'pipe' });

        const csrPem     = fs.readFileSync(csrPath, 'utf8');
        const csrBase64  = Buffer.from(csrPem.trim()).toString('base64');
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        console.log(`  ✓ CSR generated with UID=${vatNumber}`);
        return { csrBase64, csrPem, privateKey };
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
}

function decodeCert(binarySecurityToken) {
    // Token is double-base64: first decode → inner base64 PEM string
    let inner;
    try {
        inner = Buffer.from(binarySecurityToken, 'base64').toString('ascii').trim();
    } catch (_) {
        return { error: 'Failed first base64 decode' };
    }

    // Strip PEM headers if present, get raw base64
    let certB64 = inner
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/[\r\n\s]/g, '');

    // If inner looks like another base64 layer
    if (!inner.startsWith('MII') && !inner.startsWith('-----')) {
        // already raw b64 from the outer decode
        certB64 = binarySecurityToken;
    }

    let x509;
    try {
        x509 = new crypto.X509Certificate(Buffer.from(certB64, 'base64'));
    } catch (e) {
        // Try the inner string directly as DER
        try {
            x509 = new crypto.X509Certificate(Buffer.from(inner, 'base64'));
        } catch (e2) {
            return { error: `Cannot parse cert: ${e.message}` };
        }
    }

    // Extract VAT from subject
    let vatNumber = '';
    for (const line of x509.subject.split('\n')) {
        const m = line.match(/^(?:UID|2\.5\.4\.45)=(.+)$/);
        if (m) { vatNumber = m[1].trim(); break; }
    }
    if (!vatNumber) {
        const m = x509.subject.match(/\d{15}/);
        if (m) vatNumber = m[0];
    }

    // Extract SN (device serial)
    let deviceSerial = '';
    for (const line of (x509.subjectAltName || '').split(',')) {
        const m = line.trim().match(/^(?:othername|dirName|SN).*?([1-9]-[A-Za-z]+\|[0-9]-[A-Za-z]+\|[0-9]-.+)$/i);
        if (m) { deviceSerial = m[1]; break; }
    }

    return {
        subject    : x509.subject,
        issuer     : x509.issuer,
        validFrom  : x509.validFrom,
        validTo    : x509.validTo,
        serialNo   : x509.serialNumber,
        subjectAltName: x509.subjectAltName || '',
        vatNumber,
        deviceSerial,
    };
}

async function runTest(envName, otp) {
    log(envName.toUpperCase(), `Starting test against ${envName} environment`);
    const urls = URLS[envName];

    // Step 1: Generate CSR
    console.log(`\n[1] Generating CSR with VAT=${VAT_NUMBER}...`);
    const { csrBase64 } = generateCSR(VAT_NUMBER, ORG_NAME, DEVICE_SN, envName);

    // Step 2: Compliance CSID
    console.log(`\n[2] Calling Compliance CSID: ${urls.compliance}`);
    let complianceData;
    try {
        const res = await axios.post(urls.compliance, { csr: csrBase64 }, {
            headers: {
                'OTP'            : otp,
                'Accept-Version' : 'V2',
                'Accept-Language': 'en',
                'Content-Type'   : 'application/json',
            },
            timeout: 30000,
        });
        complianceData = res.data;
        console.log(`  ✓ HTTP ${res.status} — requestID: ${complianceData.requestID || complianceData.requestId}`);
        console.log(`  dispositionMessage: ${complianceData.dispositionMessage}`);
    } catch (err) {
        const status = err.response?.status;
        const body   = JSON.stringify(err.response?.data || err.message);
        console.error(`  ✗ Compliance CSID FAILED — HTTP ${status}: ${body.slice(0, 300)}`);
        if (envName === 'simulation' && status === 400) {
            console.error('\n  ⚠️  SIMULATION NOTE: The simulation endpoint requires a real OTP');
            console.error('     generated from https://fatoora.zatca.gov.sa/simulation');
            console.error('     Log in with ERAD credentials → "Onboard New Solution Unit" → Generate OTP');
            console.error('     Then re-run this script with that OTP in OTP_SIMULATION constant above.');
        }
        return { error: `Compliance failed: HTTP ${status}` };
    }

    // Decode compliance cert for reference
    if (complianceData.binarySecurityToken) {
        const compCert = decodeCert(complianceData.binarySecurityToken);
        console.log(`\n  COMPLIANCE CERT:`);
        console.log(`    VAT in cert:  ${compCert.vatNumber || '(not found)'}`);
        console.log(`    Not Before:   ${compCert.validFrom}`);
        console.log(`    Subject:      ${compCert.subject?.replace(/\n/g, ', ')}`);
        console.log(`    VAT matches CSR? ${compCert.vatNumber === VAT_NUMBER ? '✅ YES' : '❌ NO — MISMATCH'}`);
    }

    // Step 3: Production CSID
    const requestId = complianceData.requestID || complianceData.requestId;
    const token     = complianceData.binarySecurityToken;
    const secret    = complianceData.secret;
    const auth      = Buffer.from(`${token}:${secret}`).toString('base64');

    console.log(`\n[3] Calling Production CSID: ${urls.production}`);
    console.log(`    compliance_request_id: ${requestId}`);

    let productionData;
    try {
        const res = await axios.post(urls.production,
            { compliance_request_id: requestId },
            {
                headers: {
                    'Authorization'  : `Basic ${auth}`,
                    'Accept-Version' : 'V2',
                    'Accept-Language': 'en',
                    'Content-Type'   : 'application/json',
                },
                timeout: 30000,
            }
        );
        productionData = res.data;
        console.log(`  ✓ HTTP ${res.status} — dispositionMessage: ${productionData.dispositionMessage}`);
    } catch (err) {
        const status = err.response?.status;
        const body   = JSON.stringify(err.response?.data || err.message);
        console.error(`  ✗ Production CSID FAILED — HTTP ${status}: ${body.slice(0, 300)}`);
        return { error: `Production failed: HTTP ${status}` };
    }

    // Step 4: Decode production cert — THE KEY CHECK
    console.log('\n[4] DECODING PRODUCTION CERTIFICATE...');
    const prodCert = decodeCert(productionData.binarySecurityToken);

    const today      = new Date().toISOString().slice(0, 10);
    const certDate   = prodCert.validFrom ? new Date(prodCert.validFrom).toISOString().slice(0, 10) : '?';
    const isToday    = certDate === today;
    const vatMatches = prodCert.vatNumber === VAT_NUMBER;

    console.log('\n' + '═'.repeat(60));
    console.log(`  ENVIRONMENT:      ${envName.toUpperCase()}`);
    console.log(`  CSR VAT (input):  ${VAT_NUMBER}`);
    console.log(`  CERT VAT (output):${prodCert.vatNumber || '(not found)'}`);
    console.log(`  VAT matches?      ${vatMatches ? '✅ YES — cert is personalized to your VAT' : '❌ NO — cert has a DIFFERENT VAT (static/canned cert?)'}`);
    console.log(`  Not Before:       ${prodCert.validFrom}`);
    console.log(`  Minted today?     ${isToday ? '✅ YES — fresh cert' : '❌ NO — pre-existing cert (date: ' + certDate + ')'}`);
    console.log(`  Subject:          ${prodCert.subject?.replace(/\n/g, ', ')}`);
    console.log(`  Issuer:           ${prodCert.issuer?.replace(/\n/g, ', ')}`);
    console.log(`  Serial No:        ${prodCert.serialNo}`);
    console.log('═'.repeat(60));

    return {
        env        : envName,
        vatInput   : VAT_NUMBER,
        vatInCert  : prodCert.vatNumber,
        vatMatches,
        certDate,
        isToday,
        subject    : prodCert.subject,
        issuer     : prodCert.issuer,
        raw        : productionData,
    };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ZATCA PRODUCTION CERT DIAGNOSTIC                      ║');
    console.log('║   Comparing: SANDBOX vs SIMULATION                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\nTimestamp: ${new Date().toISOString()}`);
    console.log(`VAT under test: ${VAT_NUMBER}`);

    // TEST A: Sandbox
    const sandboxResult = await runTest('sandbox', OTP_SANDBOX);

    // TEST B: Simulation
    const simResult = await runTest('simulation', OTP_SIMULATION);

    // ── VERDICT ──────────────────────────────────────────────────────────────
    console.log('\n\n' + '▓'.repeat(60));
    console.log('FINAL VERDICT');
    console.log('▓'.repeat(60));

    if (sandboxResult.error) {
        console.log(`Sandbox:    ERROR — ${sandboxResult.error}`);
    } else {
        console.log(`Sandbox:    VAT matches=${sandboxResult.vatMatches ? 'YES ✅' : 'NO ❌'}  |  Fresh cert=${sandboxResult.isToday ? 'YES ✅' : 'NO ❌'}  |  Cert VAT=${sandboxResult.vatInCert}`);
    }

    if (simResult.error) {
        console.log(`Simulation: ERROR — ${simResult.error}`);
    } else {
        console.log(`Simulation: VAT matches=${simResult.vatMatches ? 'YES ✅' : 'NO ❌'}  |  Fresh cert=${simResult.isToday ? 'YES ✅' : 'NO ❌'}  |  Cert VAT=${simResult.vatInCert}`);
    }

    console.log('\nINTERPRETATION:');

    if (!sandboxResult.error && !sandboxResult.vatMatches && !sandboxResult.isToday) {
        console.log('  Sandbox → returns a PRE-EXISTING STATIC cert (VAT does not match your CSR).');
        console.log('  This CONFIRMS the root cause of your production failures.');
    }
    if (!simResult.error && simResult.vatMatches && simResult.isToday) {
        console.log('  Simulation → returns a PERSONALIZED cert (VAT matches your CSR, minted today).');
        console.log('  ✅ SOLUTION: Change zatca_env to "simulation" and re-onboard.');
    }
    if (!simResult.error && !simResult.vatMatches) {
        console.log('  Simulation → ALSO returns a static cert. Both tiers use shared certs.');
        console.log('  This means the issue is deeper — a real Fatoora OTP may be required.');
    }
    if (simResult.error) {
        console.log('  Simulation failed. Most likely the OTP 123456 was rejected.');
        console.log('  ACTION: Generate a real OTP from https://fatoora.zatca.gov.sa/simulation');
        console.log('  Then update OTP_SIMULATION in this script and re-run.');
    }

    console.log('\n' + '▓'.repeat(60));
})().catch(err => {
    console.error('\nFATAL:', err.message);
    process.exit(1);
});
