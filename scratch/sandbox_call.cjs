/**
 * ZATCA Sandbox — End-to-End Standalone Test (v2)
 * 
 * Generates key pair + CSR using the ZATCA SDK, then calls the
 * Sandbox Compliance CSID API with dummy OTP 123456.
 * 
 * Added: Accept header per ZATCA API docs
 * 
 * Usage:  node scratch/sandbox_call.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const axios = require('axios');

// ── Config ──────────────────────────────────────────────────────────────────
const SDK_PATH = path.join(__dirname, '..', 'zatca-einvoicing-sdk-Java-238-R3.4.8', 'Apps');
const FATOORA_BAT = path.join(SDK_PATH, 'fatoora.bat');
const SANDBOX_COMPLIANCE_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance';
const OTP = '123456'; // Sandbox always accepts this dummy OTP

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ZATCA Sandbox — End-to-End Compliance CSID Test v2    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ── Step 1: Create CSR config properties ────────────────────────────────
    console.log('▶ Step 1: Creating CSR config properties...');

    const uniqueSerial = '1-TST|2-TST|3-SN-' + Date.now();
    const csrConfig = [
        'csr.common.name=TST-886431145-399999999900003',
        `csr.serial.number=${uniqueSerial}`,
        'csr.organization.identifier=399999999900003',
        'csr.organization.unit.name=Riyadh Branch',
        'csr.organization.name=Maximum Speed Tech Supply LTD',
        'csr.country.name=SA',
        'csr.invoice.type=1100',
        'csr.location.address=RRRD2929',
        'csr.industry.business.category=Supply activities',
    ].join('\n');

    const tempDir = os.tmpdir();
    const configPath = path.join(tempDir, 'sandbox_csr_config.properties');
    const keyPath = path.join(tempDir, 'sandbox_privkey.pem');
    const csrPath = path.join(tempDir, 'sandbox_csr.csr');

    fs.writeFileSync(configPath, csrConfig, 'utf8');
    console.log(`  ✔ Config written to: ${configPath}\n`);

    // ── Step 2: Generate Key Pair + Signed CSR via ZATCA SDK ────────────────
    console.log('▶ Step 2: Generating Key Pair + Signed CSR via ZATCA SDK...');

    // Clean old outputs
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);

    const cmd = `"${FATOORA_BAT}" -csr -csrConfig "${configPath}" -privateKey "${keyPath}" -generatedCsr "${csrPath}" -pem -nonprod`;
    console.log(`  Command: ${cmd}\n`);

    try {
        const output = execSync(cmd, {
            cwd: SDK_PATH,
            env: { ...process.env, FATOORA_HOME: SDK_PATH },
            encoding: 'utf8',
            timeout: 30000,
        });
        if (output.trim()) console.log(`  SDK Output:\n${output}`);
    } catch (err) {
        console.error('  ✖ SDK execution failed:', err.message);
        process.exit(1);
    }

    if (!fs.existsSync(csrPath) || !fs.existsSync(keyPath)) {
        console.error('  ✖ SDK did not produce output files.');
        process.exit(1);
    }

    const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
    const csrPem = fs.readFileSync(csrPath, 'utf8');

    // Extract raw base64 from PEM — strip headers and ALL whitespace
    const csrBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n\s]/g, '')
        .trim();

    console.log('  ✔ Private Key generated (first line):', privateKeyPem.split('\n')[0]);
    console.log('  ✔ CSR generated, base64 length:', csrBase64.length, 'chars\n');

    // ── Step 3: Call Sandbox Compliance CSID API ────────────────────────────
    console.log('▶ Step 3: Calling Sandbox Compliance CSID API...');
    console.log(`  URL: ${SANDBOX_COMPLIANCE_URL}`);
    console.log(`  OTP: ${OTP}`);
    console.log(`  CSR: ${csrBase64.substring(0, 60)}...`);
    console.log();

    try {
        const response = await axios.post(
            SANDBOX_COMPLIANCE_URL,
            { csr: csrBase64 },
            {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Version': 'V2',
                    'Accept-Language': 'en',
                    'Content-Type': 'application/json',
                    'OTP': OTP,
                },
                timeout: 30000,
            }
        );

        console.log('  ╔═══════════════════════════════════════╗');
        console.log('  ║   ✅  SUCCESS — Compliance CSID       ║');
        console.log('  ╚═══════════════════════════════════════╝\n');
        console.log('  Request ID:', response.data.requestID);
        console.log('  Disposition:', response.data.dispositionMessage);
        console.log('  Token (first 60):', (response.data.binarySecurityToken || '').substring(0, 60) + '...');
        console.log('  Secret:', response.data.secret ? '***present***' : 'MISSING');
        console.log('\n  Full response:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('  ╔═══════════════════════════════════════╗');
        console.error('  ║   ❌  FAILED — API Error              ║');
        console.error('  ╚═══════════════════════════════════════╝\n');
        if (err.response) {
            console.error('  HTTP Status:', err.response.status);
            console.error('  Content-Type:', err.response.headers['content-type']);
            console.error('  Response Data:', typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data, null, 2)
                : err.response.data
            );
        } else {
            console.error('  Error:', err.message);
        }
    }
}

main();
