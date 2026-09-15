const axios = require('axios');
const db = require('./database.cjs');
const { reportInvoice, clearInvoice } = require('./zatca_phase2_impl.cjs');

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
        const row = database.prepare("SELECT zatca_queue_halted FROM business_settings LIMIT 1").get();
        return row && row.zatca_queue_halted == 1;
    } catch (e) {
        return false;
    }
}

function _setHalted(val) {
    try {
        const database = db.getDbInstance();
        // Ensure column exists (safe migration)
        try { database.prepare("ALTER TABLE business_settings ADD COLUMN zatca_queue_halted INTEGER DEFAULT 0").run(); } catch (_) {}
        database.prepare("UPDATE business_settings SET zatca_queue_halted = ?").run(val ? 1 : 0);
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

        // ── [FIX-DEADLETTER] Sweep exhausted retries into a permanent terminal
        // state before doing anything else. A 'failed' row with attempts >= 10
        // was previously silently dropped from the pending query forever, with
        // no status change, no alert, and no halt — while still being counted
        // as "pending" in getQueueStatus(). That row represents a permanent gap
        // in the gapless ICV/PIH chain, so once found we transition it to
        // 'retry_exhausted', log a loud alert, and halt the queue so nothing
        // with a higher ICV reports past the gap until a human resolves it. ──
        const exhaustedRows = database.prepare(
            "SELECT id, sale_id, invoice_number, icv FROM zatca_queue WHERE status = 'failed' AND attempts >= 10"
        ).all();
        if (exhaustedRows.length > 0) {
            const markExhausted     = database.prepare("UPDATE zatca_queue SET status = 'retry_exhausted' WHERE id = ?");
            const markSaleExhausted = database.prepare("UPDATE sales SET zatca_status = 'retry_exhausted' WHERE id = ?");
            for (const row of exhaustedRows) {
                markExhausted.run(row.id);
                markSaleExhausted.run(row.sale_id);
                console.error(`[ZATCA] ALERT: Invoice ${row.invoice_number} (ICV ${row.icv}) exhausted all 10 retry attempts and has been moved to 'retry_exhausted'. This is a permanent gap in the ICV chain and requires manual resolution (resign/resubmit or contact ZATCA support).`);
            }
            _setHalted(true);
            return; // bail this cycle — queue is now halted
        }

        // Fetch devices to get CSID tokens
        const devices = database.prepare('SELECT * FROM zatca_device').all();
        if (!devices.length) {
            isRunning = false;
            return;
        }
        if (devices.length > 1) {
            console.warn('[ZATCA] WARNING: Multiple active ZATCA devices detected. Phase 2 strictly requires 1 CSID per POS device. Please ensure each device has its own unique CSID.');
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
        const zatcaEnv = settings.zatca_env || 'sandbox';

        // Fetch pending items ordered by ICV. 'retry_exhausted' is a terminal
        // state and is intentionally excluded here (it falls out naturally
        // since its status is no longer 'pending' or 'failed').
        const pending = database.prepare(`
            SELECT * FROM zatca_queue 
            WHERE status = 'pending' OR (status = 'failed' AND attempts < 10)
            ORDER BY icv ASC
            LIMIT 5
        `).all();

        for (const item of pending) {
            const backoffMs = Math.min(60000 * Math.pow(2, item.attempts), 3600000);
            const lastAttemptTime = new Date(item.submitted_at || 0).getTime();
            if (item.attempts > 0 && (Date.now() - lastAttemptTime) < backoffMs) {
                // [FIX-ORDERING] The oldest (lowest-ICV) pending invoice is still
                // inside its backoff window. Previously this used `continue`,
                // which let a LATER (higher-ICV) item submit ahead of it —
                // violating strict ICV/PIH sequential integrity. Pause the
                // entire cycle instead.
                console.log(`[ZATCA] Invoice ${item.invoice_number} (ICV: ${item.icv}) is in backoff — pausing queue to preserve submission order.`);
                break;
            }

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

            // [C-1] B2B Standard invoices (subtype 0100000) → Clearance API
            //        B2C Simplified invoices (subtype 0200000) → Reporting API
            const subtype = item.invoice_subtype || '0200000';
            const isB2B = subtype === '0100000';
            const xmlBase64 = Buffer.from(item.signed_xml).toString('base64');

            // ── [FIX-NETWORK-BOOKKEEPING] Secondary try/catch around the raw
            // network call. reportInvoice()/clearInvoice() return
            // {error:true,...} for HTTP error responses, but RE-THROW for hard
            // transport failures (DNS failure, ECONNREFUSED, socket timeout —
            // no HTTP response at all). Previously that thrown error propagated
            // past all bookkeeping straight to the outer catch, leaving the row
            // silently 'pending' with no recorded failure and aborting the rest
            // of the batch with no DB trace. ──
            let response;
            try {
                response = isB2B
                    ? await clearInvoice(item.xml_hash, xmlBase64, item.uuid, csidToken, csidSecret, zatcaEnv)
                    : await reportInvoice(item.xml_hash, xmlBase64, item.uuid, csidToken, csidSecret, zatcaEnv);
            } catch (networkErr) {
                console.error(`[ZATCA] Network/transport failure submitting invoice ${item.invoice_number} (ICV: ${item.icv}):`, networkErr.message);
                database.prepare(`
                    UPDATE zatca_queue
                    SET attempts = attempts + 1,
                        status = 'failed',
                        zatca_response_json = ?,
                        submitted_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(JSON.stringify({ networkError: true, message: networkErr.message, code: networkErr.code || null }), item.id);
                database.prepare("UPDATE sales SET zatca_status = 'failed' WHERE id = ?").run(item.sale_id);
                break; // graceful stop — never throw out of the cycle, never skip ahead
            }

            if (response.error) {
                const statusData = response.data;
                const statusCode = response.status;
                console.error(`[ZATCA] API Error: HTTP ${statusCode}`, JSON.stringify(statusData));
                
                if (statusData && statusData.validationResults && statusData.validationResults.errorMessages) {
                    statusData._parsed_errors = statusData.validationResults.errorMessages.map(e => `${e.code}: ${e.message}`).join(' | ');
                }

                database.prepare(`
                    UPDATE zatca_queue
                    SET attempts = attempts + 1,
                        zatca_response_json = ?,
                        submitted_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(JSON.stringify(statusData), item.id);

                if (statusCode === 400 || statusCode === 422) {
                    // Schema/Validation Rejection - HALT QUEUE
                    database.prepare("UPDATE zatca_queue SET status = 'rejected' WHERE id = ?").run(item.id);
                    database.prepare("UPDATE sales SET zatca_status = 'rejected' WHERE id = ?").run(item.sale_id);
                    _setHalted(true);
                    console.error('[ZATCA] QUEUE HALTED (persisted to DB) to preserve sequence.');
                    break; 
                } else {
                    // [FIX-ORDERING] 500/503/rate-limit/other transient errors:
                    // mark failed and STOP this cycle immediately. Previously
                    // this fell through to the next (higher-ICV) item, risking
                    // an out-of-order submission.
                    database.prepare("UPDATE zatca_queue SET status = 'failed' WHERE id = ?").run(item.id);
                    database.prepare("UPDATE sales SET zatca_status = 'failed' WHERE id = ?").run(item.sale_id);
                    console.warn(`[ZATCA] Non-validation error (HTTP ${statusCode}) for invoice ${item.invoice_number} (ICV: ${item.icv}) — halting this cycle to preserve submission order. Will retry after backoff.`);
                    break;
                }
            } else {
                // ── [FIX-WARN-VS-REJECT] HTTP 2xx is NOT the same as ZATCA acceptance.
                // ZATCA's Reporting/Clearance API can return HTTP 200/202 with a
                // BODY-LEVEL rejection (reportingStatus: 'NOT_REPORTED' /
                // clearanceStatus: 'NOT_CLEARED'). The old code treated any
                // non-HTTP-error response as success, which would silently advance
                // the ICV/PIH chain past an invoice ZATCA actually rejected — a
                // permanent, undetectable gap. Check the body-level status first.
                const reportingStatus = response.reportingStatus || null;
                const clearanceStatus = response.clearanceStatus || null;
                const bodyStatus = isB2B ? clearanceStatus : reportingStatus;
                const isBodyRejected = bodyStatus === 'NOT_REPORTED' || bodyStatus === 'NOT_CLEARED';

                if (isBodyRejected) {
                    // Parse the failure messages out of validationResults the same way
                    // the HTTP-error branch above does, so the merchant/log sees WHY
                    // ZATCA rejected it, not just the raw JSON blob.
                    let parsedFailureMsg = null;
                    if (response.validationResults && Array.isArray(response.validationResults.errorMessages)) {
                        parsedFailureMsg = response.validationResults.errorMessages.map(e => `${e.code}: ${e.message}`).join(' | ');
                        response._parsed_errors = parsedFailureMsg;
                    }
                    console.error(`[ZATCA] Invoice ${item.invoice_number} (ICV: ${item.icv}) got HTTP 2xx but body status is '${bodyStatus}' — treating as REJECTION, not success.${parsedFailureMsg ? ' Reason: ' + parsedFailureMsg : ''}`);

                    // ── [FIX-WARN-VS-REJECT] Flag as 'failed' (not the harder 'rejected'
                    // terminal state used for HTTP 400/422). This is a body-level
                    // rejection riding on a 2xx status code — same retry semantics as
                    // any other 'failed' row (bounded attempts, backoff, eventual
                    // dead-letter via the [FIX-DEADLETTER] sweep above) rather than an
                    // immediate hard-stop. The queue is still halted below so nothing
                    // with a higher ICV submits out of order while this is unresolved.
                    database.prepare(`
                        UPDATE zatca_queue
                        SET attempts = attempts + 1,
                            status = 'failed',
                            zatca_response_json = ?,
                            submitted_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(JSON.stringify(response), item.id);
                    database.prepare("UPDATE sales SET zatca_status = 'failed' WHERE id = ?").run(item.sale_id);
                    _setHalted(true);
                    console.error('[ZATCA] QUEUE HALTED (body-level rejection under HTTP 2xx) to preserve sequence.');
                    break;
                }

                // ── [FIX-WARN-SURFACE] Non-fatal WARNING — ZATCA accepted the
                // invoice but flagged issues (validationResults.status === 'WARNING').
                // Per ZATCA rules this is NOT a rejection and must NOT halt the
                // queue or be treated as fatal — but it must be visible to the
                // merchant rather than buried inside the raw response JSON blob.
                const warningResults = response.validationResults && (
                    response.validationResults.status === 'WARNING' ||
                    (Array.isArray(response.validationResults.warningMessages) && response.validationResults.warningMessages.length > 0)
                ) ? response.validationResults : null;
                const hasWarnings = !!warningResults;
                let warningMessagesStr = null;
                if (hasWarnings) {
                    const msgs = Array.isArray(warningResults.warningMessages) ? warningResults.warningMessages : [];
                    warningMessagesStr = msgs.length > 0
                        ? JSON.stringify(msgs.map(w => ({ code: w.code || null, message: w.message || String(w) })))
                        : JSON.stringify([{ code: null, message: 'WARNING status with no itemised warningMessages' }]);
                    console.warn(`[ZATCA] Invoice ${item.invoice_number} accepted WITH WARNINGS:`, warningMessagesStr);
                }
                console.log(`[ZATCA] Invoice ${item.invoice_number} ${bodyStatus || 'REPORTED'} (${isB2B ? 'CLEARED' : 'REPORTED'})${hasWarnings ? ' [HAS WARNINGS]' : ''}`);

                // [C-1] Decode clearedInvoice XML for B2B clearance responses
                let stampedXml = null;
                let clearedQr = null;
                if (isB2B && response.clearedInvoice) {
                    try {
                        stampedXml = Buffer.from(response.clearedInvoice, 'base64').toString('utf8');
                        const qrMatch = stampedXml.match(/<cbc:EmbeddedDocumentBinaryObject[^>]*>([\s\S]*?)<\/cbc:EmbeddedDocumentBinaryObject>/);
                        if (qrMatch && qrMatch[1]) {
                            clearedQr = qrMatch[1].trim();
                        }
                    } catch (decodeErr) {
                        console.error('[ZATCA] Failed to decode clearedInvoice:', decodeErr.message);
                    }
                }

                // [M2] B2B clearance → 'cleared'; B2C reporting → 'reported'
                const queueStatus = isB2B ? 'cleared' : 'reported';
                // Safe inline migration — belt-and-suspenders alongside the canonical
                // ALTER TABLE in database.cjs's init migrations; harmless no-op if the
                // columns already exist (older DBs that haven't restarted yet won't crash).
                try { database.prepare("ALTER TABLE zatca_queue ADD COLUMN has_warnings INTEGER DEFAULT 0").run(); } catch (_) {}
                try { database.prepare("ALTER TABLE zatca_queue ADD COLUMN warning_messages TEXT").run(); } catch (_) {}
                database.prepare(`UPDATE zatca_queue SET status = ?, zatca_response_json = ?, stamped_xml = ?, has_warnings = ?, warning_messages = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?`)
                    .run(queueStatus, JSON.stringify(response), stampedXml, hasWarnings ? 1 : 0, warningMessagesStr, item.id);

                database.prepare("UPDATE sales SET zatca_status = 'reported' WHERE id = ?").run(item.sale_id);

                // [W-5] Update clearance/reporting status on the sales record for POS UI badges.
                // B2B invoices go through the Clearance API → status 'cleared'.
                // B2C invoices go through the Reporting API → status 'reported'.
                try {
                    const clearanceStatus = isB2B ? 'cleared' : 'reported';
                    if (isB2B && clearedQr) {
                        database.prepare(
                            'UPDATE sales SET zatca_clearance_status = ?, zatca_cleared_at = CURRENT_TIMESTAMP, hash = ? WHERE id = ?'
                        ).run(clearanceStatus, clearedQr, item.sale_id);
                    } else {
                        database.prepare(
                            'UPDATE sales SET zatca_clearance_status = ?, zatca_cleared_at = CURRENT_TIMESTAMP WHERE id = ?'
                        ).run(clearanceStatus, item.sale_id);
                    }
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
        const pendingCount   = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='pending' OR status='failed'").get().c;
        const rejectedCount  = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='rejected'").get().c;
        const reportedCount  = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='reported'").get().c;
        // [FIX-DEADLETTER] 'retry_exhausted' is a terminal state, never counted
        // as pending/active — it requires manual resolution, not auto-retry.
        const exhaustedCount = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='retry_exhausted'").get().c;
        // [FIX-WARN-SURFACE] Count accepted-but-flagged invoices so the merchant
        // UI can show a non-blocking banner distinct from rejections/exhaustion.
        let warningCount = 0;
        try {
            warningCount = database.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE has_warnings = 1").get().c;
        } catch (_) { /* column not migrated yet on very old DBs — non-fatal */ }
        const halted = _isHalted();

        // Fetch last rejected invoice for the banner (FIX 4)
        let lastRejectedInvoice = null;
        let lastError = null;
        let lastErrorList = [];
        if (halted) {
            try {
                // Including 'failed' as well since body-level rejections are marked 'failed'
                const rej = database.prepare("SELECT invoice_number, zatca_response_json FROM zatca_queue WHERE status IN ('rejected', 'failed') AND zatca_response_json IS NOT NULL ORDER BY id DESC LIMIT 1").get();
                if (rej) {
                    lastRejectedInvoice = rej.invoice_number;
                    if (rej.zatca_response_json) {
                        try {
                            const resp = JSON.parse(rej.zatca_response_json);
                            
                            if (resp._parsed_errors) {
                                // _parsed_errors is "CODE: msg | CODE2: msg2" — split back into structured items
                                lastErrorList = String(resp._parsed_errors).split(' | ').map(seg => {
                                    const m = seg.match(/^([^:]+):\s*(.+)$/);
                                    return m ? { code: m[1].trim(), message: m[2].trim() } : { message: seg };
                                });
                            } else if (resp.validationResults && Array.isArray(resp.validationResults.errorMessages) && resp.validationResults.errorMessages.length > 0) {
                                lastErrorList = resp.validationResults.errorMessages.map(e => ({ code: e.code, message: e.message }));
                            } else if (resp.validationResults && Array.isArray(resp.validationResults.warningMessages) && resp.validationResults.warningMessages.length > 0) {
                                lastErrorList = resp.validationResults.warningMessages.map(w => ({ code: w.code, message: w.message }));
                            } else {
                                lastErrorList.push({ message: `Full JSON Dump: ${JSON.stringify(resp)}` });
                            }

                            lastError = lastErrorList.map(e => e.code ? `${e.code}: ${e.message}` : e.message).join(' | ');
                        } catch (_) { 
                            lastErrorList.push({ message: `Raw Dump: ${rej.zatca_response_json}` });
                            lastError = `Raw Dump: ${rej.zatca_response_json}`; 
                        }
                    }
                }
            } catch (_) {}
        }

        // [FIX-DEADLETTER] Surface the most recently abandoned invoice distinctly
        // from a normal rejection, so the UI can alert the merchant accurately.
        let lastExhaustedInvoice = null;
        if (exhaustedCount > 0) {
            try {
                const exh = database.prepare("SELECT invoice_number, icv FROM zatca_queue WHERE status='retry_exhausted' ORDER BY id DESC LIMIT 1").get();
                if (exh) lastExhaustedInvoice = `${exh.invoice_number} (ICV ${exh.icv})`;
            } catch (_) {}
        }

        // [FIX-WARN-SURFACE] Surface the most recent WARNING invoice with its
        // parsed messages, mirroring the lastRejectedInvoice/lastExhaustedInvoice
        // pattern above, so the UI can render a real banner instead of just a count.
        let lastWarningInvoice = null;
        let lastWarningMessages = null;
        if (warningCount > 0) {
            try {
                const warn = database.prepare(
                    "SELECT invoice_number, icv, warning_messages FROM zatca_queue WHERE has_warnings = 1 ORDER BY id DESC LIMIT 1"
                ).get();
                if (warn) {
                    lastWarningInvoice = `${warn.invoice_number} (ICV ${warn.icv})`;
                    if (warn.warning_messages) {
                        try { lastWarningMessages = JSON.parse(warn.warning_messages); }
                        catch (_) { lastWarningMessages = warn.warning_messages; }
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
            exhaustedCount,
            hasExhaustedInvoices: exhaustedCount > 0,
            warningCount,
            hasWarnings: warningCount > 0,
            lastWarningInvoice,
            lastWarningMessages,
            lastRejectedInvoice,
            lastError,
            lastErrorList,
            lastExhaustedInvoice
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
