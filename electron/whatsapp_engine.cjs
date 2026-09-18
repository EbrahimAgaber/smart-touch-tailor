const path = require('path');
const fs = require('fs');

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, makeInMemoryStore, fetchLatestBaileysVersion } = baileys;
const pino = require('pino');

let sock = null;
let currentQr = null;
let isConnected = false;
let store = null;
let eventEmitter = null; // Emits to BrowserWindow webContents
let authPath = null;
let reconnectTimer = null;

/**
 * Sanitize phone number to international E.164 without leading '+'
 * Defaults to Saudi Arabia (966) for local numbers.
 */
function sanitizePhone(phone) {
    if (!phone) return '';
    let cleaned = String(phone).trim().replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('05')) {
        // Saudi local: 05xxxxxxxx -> 9665xxxxxxxx
        cleaned = '966' + cleaned.substring(1);
    } else if (cleaned.startsWith('01')) {
        // Egypt local: 01xxxxxxxxx -> 201xxxxxxxxx
        cleaned = '20' + cleaned.substring(1);
    } else if (cleaned.startsWith('5') && cleaned.length === 9) {
        cleaned = '966' + cleaned;
    }

    return cleaned.replace(/\D/g, '');
}

async function getWaVersion() {
    try {
        const v = await fetchLatestBaileysVersion();
        if (v && v.version && Array.isArray(v.version)) {
            return v.version;
        }
    } catch (err) {
        console.warn('[WhatsApp] fetchLatestBaileysVersion failed, using fallback version:', err.message);
    }
    // Reliable modern WA Web version fallback
    return [2, 3000, 1043857760];
}

async function initBaileys(appDataPath, emitToRenderer) {
    if (emitToRenderer) {
        eventEmitter = emitToRenderer;
    }
    authPath = path.join(appDataPath, 'whatsapp_auth');

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    if (!store) {
        try {
            store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
            const storeFile = path.join(appDataPath, 'baileys_store.json');
            if (fs.existsSync(storeFile)) {
                store.readFromFile(storeFile);
            }
            setInterval(() => {
                try {
                    store?.writeToFile(storeFile);
                } catch (e) {
                    // Ignore store write errors
                }
            }, 30_000);
        } catch (e) {
            console.warn('[WhatsApp] Store setup notice:', e.message);
        }
    }

    const connectToWhatsApp = async () => {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        try {
            const version = await getWaVersion();
            console.log(`[WhatsApp] Connecting with version ${version.join('.')}...`);

            sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: ['Smart Touch POS', 'Electron', '1.0'],
                connectTimeoutMs: 30_000,
                defaultQueryTimeoutMs: 60_000,
                keepAliveIntervalMs: 25_000
            });

            if (store) {
                try {
                    store.bind(sock.ev);
                } catch (e) {
                    console.warn('[WhatsApp] Failed to bind store to socket events:', e.message);
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    currentQr = qr;
                    console.log('[WhatsApp] New QR code generated');
                    if (eventEmitter) {
                        eventEmitter('whatsapp:qr', qr);
                        eventEmitter('whatsapp:status', { connected: false, qr });
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                    console.log(`[WhatsApp] Connection closed (code: ${statusCode || 'unknown'}). isLoggedOut: ${isLoggedOut}`);

                    isConnected = false;
                    if (eventEmitter) {
                        eventEmitter('whatsapp:status', { connected: false, qr: currentQr });
                    }

                    if (isLoggedOut) {
                        currentQr = null;
                        if (eventEmitter) {
                            eventEmitter('whatsapp:qr', null);
                            eventEmitter('whatsapp:status', { connected: false, qr: null });
                        }
                        try {
                            fs.rmSync(authPath, { recursive: true, force: true });
                        } catch (e) {}
                        // Re-initialize for a fresh pairing session
                        reconnectTimer = setTimeout(() => initBaileys(appDataPath, eventEmitter), 2000);
                    } else {
                        // Reconnect on transient disconnections
                        reconnectTimer = setTimeout(connectToWhatsApp, 5000);
                    }
                } else if (connection === 'open') {
                    console.log('[WhatsApp] Connected Successfully!');
                    isConnected = true;
                    currentQr = null;
                    if (eventEmitter) {
                        eventEmitter('whatsapp:status', { connected: true, qr: null });
                        eventEmitter('whatsapp:qr', null);
                    }
                }
            });
        } catch (err) {
            console.error('[WhatsApp] Failed to initiate connection:', err);
            reconnectTimer = setTimeout(connectToWhatsApp, 5000);
        }
    };

    await connectToWhatsApp();
}

function getStatus() {
    return {
        connected: isConnected,
        qr: currentQr
    };
}

async function logout(appDataPath) {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    try {
        if (sock) {
            await sock.logout();
            sock = null;
        }
    } catch (e) {
        console.warn('[WhatsApp] Socket logout notice:', e.message);
    }

    isConnected = false;
    currentQr = null;
    const targetAuth = authPath || path.join(appDataPath, 'whatsapp_auth');
    try {
        fs.rmSync(targetAuth, { recursive: true, force: true });
    } catch (e) {}

    if (eventEmitter) {
        eventEmitter('whatsapp:status', { connected: false, qr: null });
        eventEmitter('whatsapp:qr', null);
    }

    // Restart process to obtain a fresh QR code
    await initBaileys(appDataPath, eventEmitter);

    return { success: true };
}

/**
 * Send a message via WhatsApp
 * @param {string} phone - Target phone number
 * @param {string} text - Message text
 * @param {Buffer} pdfBuffer - Optional PDF buffer to attach
 */
async function sendMessage(phone, text, pdfBuffer = null) {
    if (!sock || !isConnected) {
        throw new Error('WhatsApp is not connected.');
    }

    const cleanNumber = sanitizePhone(phone);
    if (!cleanNumber || cleanNumber.length < 8) {
        throw new Error(`Invalid phone number: "${phone}"`);
    }

    let jid = `${cleanNumber}@s.whatsapp.net`;

    // Verify number is registered on WhatsApp
    try {
        const [result] = await sock.onWhatsApp(jid);
        if (!result || !result.exists) {
            throw new Error(`Phone number ${cleanNumber} is not registered on WhatsApp.`);
        }
        if (result.jid) {
            jid = result.jid;
        }
    } catch (err) {
        console.warn('[WhatsApp] onWhatsApp check failed, attempting direct send to', jid, err.message);
    }

    if (pdfBuffer) {
        await sock.sendMessage(jid, {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: 'Invoice.pdf',
            caption: text || ''
        });
    } else {
        await sock.sendMessage(jid, { text: text || '' });
    }

    return { success: true };
}

module.exports = {
    initBaileys,
    getStatus,
    logout,
    sendMessage,
    sanitizePhone
};

