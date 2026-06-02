const axios = require('axios');
const db = require('./database.cjs');
const { reportInvoice, clearInvoice } = require('./zatca_phase2.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// ZATCA BACKGROUND REPORTER
// Polls the zatca_queue and submits offline-first invoices to ZATCA
// ─────────────────────────────────────────────────────────────────────────────

let reporterInterval = null;
let isRunning = false;

// ── FIX 3: DB-backed halt flag — survives app restarts ────────────────────────
function _isHalted() {
    try {
        const database = db.getDbInstance();
        const row = database.prepare("SELECT zatca_queue_halted FROM settings LIMIT 1").get();
        return row && row.zatca_queue_halted == 1;
    } catch (e) {
        return false;
    }
}

function _setHalted(val) {
    try {
        const database = db.getDbInstance();
        // Ensure column exists (safe migration)
        try { database.prepare("ALTER TABLE settings ADD COLUMN zatca_queue_halted INTEGER DEFAULT 0").run(); } catch (_) {}
        database.prepare("UPDATE settings SET zatca_queue_halted = ?").run(val ? 1 : 0);
    } catch (e) {
        console.error('[ZATCA] Failed to persist halt flag:', e.message);
    }
}

async function processQueue() {
    if (isRunning) return;
    if (_isHalted()) {
        console.warn('[ZATCA] Queue is HALTED (DB flag) due to previous rejection. Manual intervention required.');
        return;
    }

    isRunning = true;
    try {
        const database = db.getDbInstance();
        
        // Fetch devices to get CSID tokens
        const devices = database.prepare('SELECT * FROM zatca_device').all();
        if (!devices.length) {
            isRunning = false;
            return;
        }
        
        // For simplicity, we assume single device logic here or map by some device id if needed.
        // We'll just grab the first one for now as POS usually runs on 1 device.
        const device = devices[0];
        if (!device.production_csid || !device.production_cert_pem) {
            isRunning = false;
            return; // Not onboarded yet
        }

        const csidData = JSON.parse(device.production_csid);
        const csidToken = csidData.binarySecurityToken;
        const csidSecret = csidData.secret;
        
        const settings = db.getSettings();
        const isSandbox = settings.zatca_env === 'sandbox';

        // Fetch pending items ordered by ICV
        const pending = database.prepare(`
            SELECT * FROM zatca_queue 
            WHERE status = 'pending' OR (status = 'failed' AND attempts < 10)
            ORDER BY icv ASC
            LIMIT 5
        `).all();

        for (const item of pending) {
            // ── FIX 6: ICV sequence gap detection ──────────────────────────────────────
            const icvRow = database.prepare("SELECT MAX(icv) as last_icv FROM zatca_queue WHERE status = 'cleared' OR status = 'reported'").get();
            const lastIcv = icvRow && icvRow.last_icv != null ? icvRow.last_icv : -1;
            if (lastIcv >= 0 && item.icv <= lastIcv) {
                console.error(`[ZATCA] ICV CONFLICT: invoice ${item.invoice_number} has ICV ${item.icv} but last successful ICV was ${lastIcv}. This may indicate a DB restore from backup.`);
                database.prepare("UPDATE zatca_queue SET status = 'icv_conflict' WHERE id = ?").run(item.id);
                _setHalted(true);
                console.error('[ZATCA] QUEUE HALTED due to ICV conflict. Please resolve before re-submitting.');
                break;
            }
            // ────────────────────────────────────────────────────────────────────────

            console.log(`[ZATCA] Submitting Invoice ${item.invoice_number} (ICV: ${item.icv})`);
            database.prepare('UPDATE zatca_queue SET attempts = attempts + 1 WHERE id = ?').run(item.id);

            // [C-1] B2B Standard invoices (subtype 0100000) → Clearance API
            //        B2C Simplified invoices (subtype 0200000) → Reporting API
            const subtype = item.invoice_subtype || '0200000';
            const isB2B = subtype === '0100000';
            const xmlBase64 = Buffer.from(item.signed_xml).toString('base64');

            const response = isB2B
                ? await clearInvoice(item.xml_hash, xmlBase64, item.uuid, csidToken, csidSecret, isSandbox)
                : await reportInvoice(item.xml_hash, xmlBase64, item.uuid, csidToken, csidSecret, isSandbox);

            if (response.error) {
                const statusData = response.data;
                const statusCode = response.status;
                console.error(`[ZATCA] API Error: HTTP ${statusCode}`, JSON.stringify(statusData));
                
                database.prepare('UPDATE zatca_queue SET zatca_response_json = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(JSON.stringify(statusData), item.id);

                if (statusCode === 400 || statusCode === 422) {
                    // Schema Rejection - HALT QUEUE
                    database.prepare("UPDATE zatca_queue SET status = 'rejected' WHERE id = ?").run(item.id);
                    database.prepare("UPDATE sales SET zatca_status = 'rejected' WHERE id = ?").run(item.sale_id);
                    _setHalted(true);
                    console.error('[ZATCA] QUEUE HALTED (persisted to DB) to preserve sequence.');
                    break; 
                } else {
                    database.prepare("UPDATE zatca_queue SET status = 'failed' WHERE id = ?").run(item.id);
                    database.prepare("UPDATE sales SET zatca_status = 'failed' WHERE id = ?").run(item.sale_id);
                }
            } else {
                // Success 200/202
                const reportingStatus = response.reportingStatus || response.clearanceStatus || 'REPORTED';
                console.log(`[ZATCA] Invoice ${item.invoice_number} ${reportingStatus} (${isB2B ? 'CLEARED' : 'REPORTED'})`);

                // [C-1] Decode clearedInvoice XML for B2B clearance responses
                let stampedXml = null;
                if (isB2B && response.clearedInvoice) {
                    try {
                        stampedXml = Buffer.from(response.clearedInvoice, 'base64').toString('utf8');
                    } catch (decodeErr) {
                        console.error('[ZATCA] Failed to decode clearedInvoice:', decodeErr.message);
                    }
                }

                database.prepare("UPDATE zatca_queue SET status = 'reported', zatca_response_json = ?, stamped_xml = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .run(JSON.stringify(response), stampedXml, item.id);

                database.prepare("UPDATE sales SET zatca_status = 'reported' WHERE id = ?").run(item.sale_id);

                // [W-5] Update clearance/reporting status on the sales record for POS UI badges.
                // B2B invoices go through the Clearance API → status 'cleared'.
                // B2C invoices go through the Reporting API → status 'reported'.
                try {
                    const clearanceStatus = isB2B ? 'cleared' : 'reported';
                    database.prepare(
                        'UPDATE sales SET zatca_clearance_status = ?, zatca_cleared_at = CURRENT_TIMESTAMP WHERE id = ?'
                    ).run(clearanceStatus, item.sale_id);
                } catch (csErr) {
                    // Column may not exist yet on older DB schemas — non-fatal, will be added by migration.
                    console.warn('[ZATCA] Could not update zatca_clearance_status (column may be missing):', csErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[ZATCA] Reporter cycle error:', err);
    } finally {
        isRunning = false;
    }
}

function startReporter(intervalMs = 60000) {
    if (reporterInterval) clearInterval(reporterInterval);
    reporterInterval = setInterval(processQueue, intervalMs);
    console.log(`[ZATCA] Background reporter started (Interval: ${intervalMs}ms)`);
    // Run once immediately
    processQueue();
}

function stopReporter() {
    if (reporterInterval) {
        clearInterval(reporterInterval);
        reporterInterval = null;
        console.log('[ZATCA] Background reporter stopped.');
    }
}

function getQueueStatus() {
    try {
        const database = db.getDbInstance();
        const pendingCount = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='pending' OR status='failed'").get().c;
        const rejectedCount = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='rejected'").get().c;
        const reportedCount = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='reported'").get().c;
        const halted = _isHalted();

        // Fetch last rejected invoice for the banner (FIX 4)
        let lastRejectedInvoice = null;
        let lastError = null;
        if (halted) {
            try {
                const rej = database.prepare("SELECT invoice_number, zatca_response_json FROM zatca_queue WHERE status='rejected' ORDER BY id DESC LIMIT 1").get();
                if (rej) {
                    lastRejectedInvoice = rej.invoice_number;
                    if (rej.zatca_response_json) {
                        try {
                            const resp = JSON.parse(rej.zatca_response_json);
                            lastError = resp.errors?.[0]?.message || resp.message || JSON.stringify(resp).slice(0, 120);
                        } catch (_) { lastError = rej.zatca_response_json.slice(0, 120); }
                    }
                }
            } catch (_) {}
        }

        return {
            isRunning: reporterInterval !== null,
            halted,
            isHalted: halted, // backward compat alias
            pendingCount,
            rejectedCount,
            reportedCount,
            lastRejectedInvoice,
            lastError
        };
    } catch (e) {
        return { error: e.message };
    }
}

function retryFailed() {
    _setHalted(false); // Reset persistent halt flag
    processQueue();
    return { success: true };
}

function resumeQueue() {
    _setHalted(false);
    console.log('[ZATCA] Queue RESUMED by merchant action.');
    processQueue();
    return { success: true };
}

module.exports = {
    startReporter,
    stopReporter,
    processQueue,
    getQueueStatus,
    retryFailed,
    resumeQueue
};
