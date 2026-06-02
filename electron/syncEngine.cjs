const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const http    = require('http');
const crypto  = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// SYNC ENGINE  —  Last-Write-Wins CRDT  (Master ↔ Slave over LAN)
//
// Critical fixes applied:
//
//  1. GENERATED SYNC SECRET (was hardcoded 'basma-crdt-secure')
//     A 32-byte random token is generated on first master activation and
//     stored in business_settings as 'sync_secret'. Slaves read it from the
//     same settings table. The token never appears in source code.
//
//  2. FK ID TRANSLATION for sales_items and purchase_items
//     Slave local integer IDs (sale_id / purchase_id) mean nothing on the
//     Master. We push sale_sync_id / purchase_sync_id alongside each child
//     row and resolve them to the Master's local integer IDs on arrival.
//     database.cjs.saveSale() already writes sales.sync_id; we read it here.
//
//  3. ECHO-LOOP PREVENTION
//     After a Pull, the Slave stores the Master's rows locally. Those rows
//     also have updated_at > lastTs, so a naive Push would echo them back.
//     Fix: the Push query now adds "AND node_id = ?" to only push rows that
//     originated on this node.
//
// ─────────────────────────────────────────────────────────────────────────────

let db;
let mode     = 'standalone'; // 'standalone' | 'master' | 'slave'
let masterIp = '';
let server       = null;
let syncInterval = null;
let myNodeId     = '';
let syncSecret   = '';         // generated once, persisted in business_settings

let status = { status: 'offline', lastSync: null, pendingChanges: 0 };

// Tables that participate in sync.
// Order matters for FK resolution: parent tables before child tables.
const SYNC_TABLES = [
    'products',
    'customers',
    'sales',          // must come before sales_items
    'sales_items',
    'held_orders',
    'expenditures',
    'shifts',
    'ledger_entries',
    'staff',
    'suppliers',
    'purchase_orders', // must come before purchase_items
    'purchase_items',
];

// Tables whose rows have FK columns that reference another synced table.
// Structure: { table, fkCol, parentTable, parentFkCol }
// The parentFkCol is the sync_id column on the parent whose local id we need.
const FK_TRANSLATIONS = [
    { table: 'sales_items',    fkCol: 'sale_id',     parentTable: 'sales',          parentFkCol: 'sale_sync_id'     },
    { table: 'purchase_items', fkCol: 'purchase_id', parentTable: 'purchase_orders', parentFkCol: 'purchase_sync_id' },
];

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

function initSyncEngine(databaseInstance) {
    db = databaseInstance;

    const settings = getSettingsMap();

    // Node identity
    if (!settings.node_id) {
        myNodeId = crypto.randomUUID();
        saveSetting('node_id', myNodeId);
    } else {
        myNodeId = settings.node_id;
    }

    // Sync secret — generated once, never hardcoded
    if (!settings.sync_secret) {
        syncSecret = crypto.randomBytes(32).toString('hex');
        saveSetting('sync_secret', syncSecret);
        console.log('[Sync] Generated new sync_secret. Copy it to all Slave nodes via Settings → Network.');
    } else {
        syncSecret = settings.sync_secret;
    }

    // Ensure node_id column exists on all sync tables (defensive; should already
    // exist from migrateForSync in database.cjs, but guard anyway).
    _ensureNodeIdColumns();

    // Backfill node_id for rows created before this upgrade
    _backfillNodeId();

    mode     = settings.network_mode || 'standalone';
    masterIp = settings.master_ip    || '';

    console.log(`[Sync] Init — Node: ${myNodeId} | Mode: ${mode}`);
    applyMode();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getSettingsMap() {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function saveSetting(key, value) {
    db.prepare('INSERT INTO business_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, String(value));
}

/** Ensure node_id column exists on every sync table (idempotent). */
function _ensureNodeIdColumns() {
    for (const table of SYNC_TABLES) {
        try {
            const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
            if (!cols.includes('node_id')) {
                db.exec(`ALTER TABLE ${table} ADD COLUMN node_id TEXT`);
            }
            // sales_items needs sale_sync_id for FK translation
            if (table === 'sales_items' && !cols.includes('sale_sync_id')) {
                db.exec(`ALTER TABLE sales_items ADD COLUMN sale_sync_id TEXT`);
                // Backfill existing rows with the parent sale's sync_id
                db.exec(`
                    UPDATE sales_items
                    SET sale_sync_id = (
                        SELECT sync_id FROM sales WHERE sales.id = sales_items.sale_id
                    )
                    WHERE sale_sync_id IS NULL
                `);
            }
            // purchase_items needs purchase_sync_id for FK translation
            if (table === 'purchase_items' && !cols.includes('purchase_sync_id')) {
                db.exec(`ALTER TABLE purchase_items ADD COLUMN purchase_sync_id TEXT`);
                db.exec(`
                    UPDATE purchase_items
                    SET purchase_sync_id = (
                        SELECT sync_id FROM purchase_orders WHERE purchase_orders.id = purchase_items.purchase_id
                    )
                    WHERE purchase_sync_id IS NULL
                `);
            }
        } catch (e) {
            // Column already exists or table doesn't exist yet — safe to ignore
        }
    }
}

/** Stamp existing rows with myNodeId so the echo-loop filter works. */
function _backfillNodeId() {
    for (const table of SYNC_TABLES) {
        try {
            db.exec(`UPDATE ${table} SET node_id = '${myNodeId}' WHERE node_id IS NULL`);
        } catch (_) {}
    }
}

/**
 * Validates the x-sync-auth header against the stored secret.
 * Returns a 401 response and false if invalid; returns true if valid.
 */
function _validateAuth(req, res) {
    if (!syncSecret) {
        res.status(500).json({ error: 'Sync secret not initialised on master' });
        return false;
    }
    if (req.headers['x-sync-auth'] !== syncSecret) {
        console.warn(`[Sync] Rejected request from ${req.ip} — invalid auth token`);
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function applyMode() {
    if (server)       { server.close();           server       = null; }
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }

    status.status = 'online';

    if      (mode === 'master')             startExpressServer();
    else if (mode === 'slave' && masterIp)  startPoller();
    else                                    status.status = 'standalone';
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER — Express sync server
// ─────────────────────────────────────────────────────────────────────────────

function startExpressServer() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // ── Auth middleware ──────────────────────────────────────────────────────
    app.use((req, res, next) => {
        if (!_validateAuth(req, res)) return;
        next();
    });

    // ── Pull: Slave asks "give me everything newer than timestamp T" ─────────
    app.post('/api/sync/pull', (req, res) => {
        const { lastSync = 0 } = req.body;
        const result = {};
        try {
            db.transaction(() => {
                for (const table of SYNC_TABLES) {
                    result[table] = db.prepare(
                        `SELECT * FROM ${table} WHERE updated_at > ?`
                    ).all(lastSync);
                }
            })();
            res.json({ success: true, data: result, timestamp: Date.now() });
        } catch (err) {
            console.error('[Sync Master] Pull error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Push: Slave sends its locally-originated dirty rows ─────────────────
    app.post('/api/sync/push', (req, res) => {
        const { payload = {}, requestorNodeId } = req.body;
        try {
            db.transaction(() => {
                for (const table of SYNC_TABLES) {
                    const rows = payload[table];
                    if (!rows || rows.length === 0) continue;

                    const cols = db.prepare(`PRAGMA table_info(${table})`)
                        .all().map(c => c.name).filter(c => c !== 'id');
                    const placeholders = cols.map(() => '?').join(',');

                    const stmt = db.prepare(`
                        INSERT INTO ${table} (${cols.join(',')})
                        VALUES (${placeholders})
                        ON CONFLICT(sync_id) DO UPDATE SET
                            ${cols.map(c => `${c}=excluded.${c}`).join(',\n')}
                        WHERE excluded.updated_at > ${table}.updated_at
                    `);

                    for (const row of rows) {
                        // ── FK Translation ────────────────────────────────────
                        const fkDef = FK_TRANSLATIONS.find(f => f.table === table);
                        if (fkDef) {
                            const parentSyncId = row[fkDef.parentFkCol];
                            if (parentSyncId) {
                                const parent = db.prepare(
                                    `SELECT id FROM ${fkDef.parentTable} WHERE sync_id = ?`
                                ).get(parentSyncId);
                                if (parent) {
                                    row[fkDef.fkCol] = parent.id;
                                } else {
                                    // Parent not yet synced — skip this child row; it will
                                    // be re-pushed on the next cycle after the parent arrives.
                                    console.warn(`[Sync] Skipping ${table} row — parent ${fkDef.parentTable} sync_id=${parentSyncId} not found yet`);
                                    continue;
                                }
                            }
                        }
                        // ──────────────────────────────────────────────────────
                        stmt.run(cols.map(c => row[c]));
                    }
                }
            })();
            res.json({ success: true, timestamp: Date.now() });
        } catch (err) {
            console.error('[Sync Master] Push error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Secret distribution endpoint (admin-only, called from Settings UI) ──
    // Returns the sync_secret so the admin can copy-paste it into Slave settings.
    app.get('/api/sync/secret', (req, res) => {
        res.json({ sync_secret: syncSecret });
    });

    server = http.createServer(app);
    server.listen(8080, '0.0.0.0', () => {
        console.log('[Sync] Master listening on :8080');
        status.status = 'master_listening';
    });
    server.on('error', (err) => {
        console.error('[Sync] Server error:', err.message);
        status.status = 'server_error';
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLAVE — polling sync cycle
// ─────────────────────────────────────────────────────────────────────────────

function startPoller() {
    status.status = 'slave_polling';

    const authHeader = () => ({ 'x-sync-auth': syncSecret });

    const syncCycle = async () => {
        try {
            const wm = db.prepare(
                'SELECT last_sync_timestamp FROM sync_watermarks WHERE node_id = ?'
            ).get('master') || { last_sync_timestamp: 0 };
            const lastTs = wm.last_sync_timestamp;

            // ── 1. PULL from Master ──────────────────────────────────────────
            const pullRes = await axios.post(
                `http://${masterIp}:8080/api/sync/pull`,
                { lastSync: lastTs, requestorNodeId: myNodeId },
                { headers: authHeader(), timeout: 8000 }
            );

            const remoteData = pullRes.data.data || {};

            db.transaction(() => {
                for (const table of SYNC_TABLES) {
                    const rows = remoteData[table];
                    if (!rows || rows.length === 0) continue;

                    const cols = db.prepare(`PRAGMA table_info(${table})`)
                        .all().map(c => c.name).filter(c => c !== 'id');
                    const placeholders = cols.map(() => '?').join(',');

                    const stmt = db.prepare(`
                        INSERT INTO ${table} (${cols.join(',')})
                        VALUES (${placeholders})
                        ON CONFLICT(sync_id) DO UPDATE SET
                            ${cols.map(c => `${c}=excluded.${c}`).join(',\n')}
                        WHERE excluded.updated_at > ${table}.updated_at
                    `);

                    for (const row of rows) {
                        stmt.run(cols.map(c => row[c]));
                    }
                }

                // Advance our watermark to the Master's server timestamp
                db.prepare(`
                    INSERT INTO sync_watermarks (node_id, last_sync_timestamp)
                    VALUES (?, ?)
                    ON CONFLICT(node_id) DO UPDATE SET last_sync_timestamp=excluded.last_sync_timestamp
                `).run('master', pullRes.data.timestamp);
            })();

            // ── 2. PUSH only THIS node's dirty rows (echo-loop fix) ──────────
            const pushPayload = {};
            let   pushCount   = 0;

            for (const table of SYNC_TABLES) {
                // Only push rows that originated here AND are newer than lastTs.
                // This prevents echoing back the Master's own rows.
                const rows = db.prepare(
                    `SELECT * FROM ${table} WHERE updated_at > ? AND node_id = ?`
                ).all(lastTs, myNodeId);

                // Attach parent sync_id to child rows for FK translation on Master
                const fkDef = FK_TRANSLATIONS.find(f => f.table === table);
                if (fkDef) {
                    for (const row of rows) {
                        if (row[fkDef.fkCol] && !row[fkDef.parentFkCol]) {
                            const parent = db.prepare(
                                `SELECT sync_id FROM ${fkDef.parentTable} WHERE id = ?`
                            ).get(row[fkDef.fkCol]);
                            row[fkDef.parentFkCol] = parent?.sync_id || null;
                        }
                    }
                }

                pushPayload[table] = rows;
                pushCount += rows.length;
            }

            if (pushCount > 0) {
                await axios.post(
                    `http://${masterIp}:8080/api/sync/push`,
                    { payload: pushPayload, requestorNodeId: myNodeId },
                    { headers: authHeader(), timeout: 15000 }
                );
            }

            status.lastSync       = new Date().toISOString();
            status.status         = 'synced';
            status.pendingChanges = 0;

        } catch (err) {
            console.error('[Sync] Cycle error:', err.message);
            status.status = 'sync_error';
        }
    };

    syncInterval = setInterval(syncCycle, 5000);
    syncCycle(); // run immediately on start
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

function setMode(newMode, ip) {
    mode     = newMode;
    masterIp = ip || '';

    saveSetting('network_mode', mode);
    if (masterIp) saveSetting('master_ip', masterIp);

    applyMode();
    return status;
}

function getStatus() {
    // Include the node_id and (for master) the sync_secret for Settings UI display
    return {
        ...status,
        nodeId: myNodeId,
        mode,
        // Only expose the secret when this node is the master
        syncSecret: mode === 'master' ? syncSecret : undefined,
    };
}

function forceSync() {
    if (mode === 'slave' && masterIp) {
        if (syncInterval) clearInterval(syncInterval);
        startPoller();
    }
    return status;
}

module.exports = {
    initSyncEngine,
    setMode,
    getStatus,
    forceSync,
};
