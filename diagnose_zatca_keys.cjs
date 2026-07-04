/**
 * diagnose_zatca_keys.cjs
 * Reads the DB and shows exactly what curve the stored private key and cert use.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

async function main() {
    let initSqlJs;
    try { initSqlJs = require('sql.js'); }
    catch(e) { console.error('sql.js missing: npm install sql.js'); process.exit(1); }

    // Find DB
    const candidates = [];
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    ['smart-touch-pos','Smart Touch POS','SmartTouchPOS','my-pos','pos'].forEach(n => {
        candidates.push(path.join(appData, n, 'pos_data.db'));
    });
    candidates.push(path.join(__dirname, 'pos_data.db'));
    candidates.push(path.join(__dirname, 'pos.db'));

    const dbPath = process.argv[2] || candidates.find(c => fs.existsSync(c));
    if (!dbPath) { console.error('DB not found'); process.exit(1); }
    console.log('DB:', dbPath);

    const SQL = await initSqlJs();
    const db  = new SQL.Database(fs.readFileSync(dbPath));

    const cols = db.exec('PRAGMA table_info(zatca_device)')[0]?.values.map(r => r[1]) || [];
    console.log('\nzatca_device columns:', cols.join(', '));

    const rows = db.exec('SELECT * FROM zatca_device')[0];
    if (!rows || !rows.values.length) { console.log('zatca_device is EMPTY'); return; }

    const crypto = require('crypto');

    rows.values.forEach((row, i) => {
        const rec = Object.fromEntries(rows.columns.map((c, j) => [c, row[j]]));
        console.log('\n══ Row', i+1, '══');
        console.log('onboarding_status:', rec.onboarding_status);

        // ── Private key curve ─────────────────────────────────────────────
        const pk = rec.private_key_pem;
        if (pk) {
            try {
                const key = crypto.createPrivateKey(pk);
                console.log('private_key curve :', key.asymmetricKeyDetails?.namedCurve || '?');
                console.log('private_key type  :', key.asymmetricKeyType);
            } catch(e) {
                console.log('private_key parse FAILED:', e.message.split('\n')[0]);
            }
        } else {
            console.log('private_key_pem   : NULL');
        }

        // ── Compliance cert curve ─────────────────────────────────────────
        const cc = rec.compliance_cert_pem;
        if (cc) {
            try {
                let b64 = cc.replace(/-----BEGIN CERTIFICATE-----/g,'')
                            .replace(/-----END CERTIFICATE-----/g,'')
                            .replace(/[\r\n\s]/g,'');
                const pem = `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
                const x509 = new crypto.X509Certificate(pem);
                console.log('compliance cert curve:', x509.publicKey.asymmetricKeyDetails?.namedCurve || '?');
                console.log('compliance cert subj :', x509.subject.replace(/\n/g, ', '));
            } catch(e) {
                console.log('compliance_cert parse FAILED:', e.message.split('\n')[0]);
            }
        } else {
            console.log('compliance_cert_pem : NULL');
        }

        // ── Production cert curve ─────────────────────────────────────────
        const pc = rec.production_cert_pem;
        if (pc) {
            try {
                let b64 = pc.replace(/-----BEGIN CERTIFICATE-----/g,'')
                            .replace(/-----END CERTIFICATE-----/g,'')
                            .replace(/[\r\n\s]/g,'');
                const pem = `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
                const x509 = new crypto.X509Certificate(pem);
                console.log('production cert curve:', x509.publicKey.asymmetricKeyDetails?.namedCurve || '?');
                console.log('production cert subj :', x509.subject.replace(/\n/g, ', '));
            } catch(e) {
                console.log('production_cert parse FAILED:', e.message.split('\n')[0]);
            }
        } else {
            console.log('production_cert_pem : NULL');
        }
    });

    db.close();
}
main().catch(e => { console.error(e); process.exit(1); });
