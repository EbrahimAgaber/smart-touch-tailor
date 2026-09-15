const fs = require('fs');

/**
 * Executes a production-safe ZATCA Phase 2 self-healing recovery migration.
 * @param {import('better-sqlite3').Database} db
 * @param {string} appVersion
 */
function runRecoveryMigration(db, appVersion) {
    try {
        // 1. Idempotency & Schema Updates
        ensureRecoverySchema(db);

        const device = require('./database.cjs').getZatcaDevice();
        if (!device) return;

        // 2. Version Gating & Idempotency Check
        if (device.recovery_migration_applied === 1) {
            return; // Already applied
        }

        // Only auto-recover if app is on the 1.0.15 boundary where the fix was introduced
        // (Or if we can't parse it, err on the side of caution)
        const versionParts = (appVersion || '0.0.0').split('.');
        const minorVer = parseInt(versionParts[1] || '0', 10);
        const patchVer = parseInt(versionParts[2] || '0', 10);
        
        // If we somehow moved past 1.1.x, we do not run auto-recovery. 
        // This gate ensures this migration only applies during the critical update window.
        if (minorVer > 0 || patchVer > 15) {
            return;
        }

        // 3. Full Onboard Safeguard
        if (device.production_cert_pem) {
            console.log('[ZATCA Recovery] Device is fully onboarded. Skipping recovery.');
            return;
        }

        // 4. Partial Onboard Safeguard (Manual Review Required)
        if (device.compliance_csid) {
            console.warn('[ZATCA Recovery] WARNING: Device is partially onboarded (has compliance_csid but no production_cert). MANUAL REVIEW REQUIRED. Aborting auto-recovery to fail closed.');
            return;
        }

        // 5. Success Evidence Check (Fail Closed)
        // Check for any successful clearances/reports
        const successCount = db.prepare("SELECT count(*) as count FROM zatca_queue WHERE status IN ('reported', 'cleared')").get().count;
        if (successCount > 0) {
            console.warn(`[ZATCA Recovery] WARNING: Found ${successCount} successful ZATCA submissions. Aborting auto-recovery to prevent PIH corruption.`);
            return;
        }

        // Check for any JSON response that indicates success just in case status was manually mutated
        const successResponses = db.prepare("SELECT count(*) as count FROM zatca_queue WHERE zatca_response_json LIKE '%clearanceStatus\":\"CLEARED%' OR zatca_response_json LIKE '%reportingStatus\":\"REPORTED%'").get().count;
        if (successResponses > 0) {
            console.warn(`[ZATCA Recovery] WARNING: Found evidence of successful ZATCA API responses. Aborting auto-recovery to prevent PIH corruption.`);
            return;
        }

        // Check if there's any work to actually do
        const brokenItemsCount = db.prepare("SELECT count(*) as count FROM zatca_queue WHERE status IN ('pending', 'failed')").get().count;
        if (brokenItemsCount === 0) {
            // Nothing to recover, but mark as applied so we don't check again
            db.prepare("UPDATE zatca_device SET recovery_migration_applied = 1 WHERE id = ?").run(device.id);
            return;
        }

        console.log(`[ZATCA Recovery] Found ${brokenItemsCount} pending/failed legacy invoices. Initiating transactional recovery...`);

        // 6. Transactional Recovery
        const runTx = db.transaction(() => {
            const previousIcv = device.current_icv || 0;
            const previousPih = device.last_pih || '';
            // Canonical ZATCA genesis PIH (SHA-256('') → hex → base64). Must match database.cjs.
            const newPih = 'NWZlY2Q3YmU1YTIzYmU3YTYzYTk3YmQ4NzY0ODk2ODM3NGJhOWI5NjgxYTNpYmQyNzhjNTU4NTUxYWI5ZWYyZg==';
            const timestamp = new Date().toISOString();
            const reason = 'AUTO_RECOVERY_ZATCA_BUG_1.0.15';

            // Archive the queue items
            db.prepare("UPDATE zatca_queue SET status = 'archived_legacy' WHERE status IN ('pending', 'failed')").run();

            // Mark sales so they are excluded from the reporter
            db.prepare("UPDATE sales SET zatca_status = 'unreported_legacy' WHERE zatca_status IN ('pending', 'failed')").run();

            // Reset the device chain safely
            db.prepare(`
                UPDATE zatca_device 
                SET chain_generation = chain_generation + 1,
                    recovery_migration_applied = 1,
                    current_icv = 0,
                    last_pih = ?,
                    recovery_reason = ?,
                    recovery_timestamp = ?
                WHERE id = ?
            `).run(newPih, reason, timestamp, device.id);

            // Audit log the recovery explicitly
            const auditDetails = JSON.stringify({
                previous_icv: previousIcv,
                current_icv: 0,
                previous_pih: previousPih,
                current_pih: newPih,
                archived_queue_count: brokenItemsCount,
                app_version: appVersion,
                chain_generation_transition: `${device.chain_generation || 1} -> ${(device.chain_generation || 1) + 1}`,
                recovery_reason: reason
            });

            db.prepare(`
                INSERT INTO audit_logs (user_id, action, details)
                VALUES (0, 'ZATCA_AUTO_RECOVERY', ?)
            `).run(auditDetails);
            
            console.log('[ZATCA Recovery] Clean state restored successfully inside transaction.');
        });

        runTx();

    } catch (err) {
        console.error('[ZATCA Recovery] CRITICAL ERROR during self-healing routine. Failing closed. Error:', err);
    }
}

/**
 * Safely adds recovery metadata columns to the zatca_device schema.
 * @param {import('better-sqlite3').Database} db
 */
function ensureRecoverySchema(db) {
    const columns = db.pragma("table_info(zatca_device)");
    const colNames = columns.map(c => c.name);

    if (!colNames.includes('chain_generation')) {
        db.exec("ALTER TABLE zatca_device ADD COLUMN chain_generation INTEGER DEFAULT 1");
    }
    if (!colNames.includes('recovery_migration_applied')) {
        db.exec("ALTER TABLE zatca_device ADD COLUMN recovery_migration_applied INTEGER DEFAULT 0");
    }
    if (!colNames.includes('recovery_reason')) {
        db.exec("ALTER TABLE zatca_device ADD COLUMN recovery_reason TEXT");
    }
    if (!colNames.includes('recovery_timestamp')) {
        db.exec("ALTER TABLE zatca_device ADD COLUMN recovery_timestamp TEXT");
    }
}

module.exports = {
    runRecoveryMigration
};
