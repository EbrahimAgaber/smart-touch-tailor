const express = require('express');
const cors = require('cors');
const localtunnel = require('localtunnel');
const crypto = require('crypto');
const path = require('path');
const http = require('http');

let server = null;
let tunnel = null;
let publicUrl = null;
let tunnelConnected = false;
let tunnelLastError = null;
let mainWindowRef = null;
let dbRef = null;

// Rate limiting state
const rateLimits = new Map(); // tableId -> [{timestamp}]

// Cleanup expired rate limits periodically
setInterval(() => {
    const now = Date.now();
    for (const [tableId, timestamps] of rateLimits.entries()) {
        const valid = timestamps.filter(t => now - t < 10 * 60 * 1000);
        if (valid.length === 0) {
            rateLimits.delete(tableId);
        } else {
            rateLimits.set(tableId, valid);
        }
    }
}, 60 * 1000);

function checkRateLimit(tableId) {
    const now = Date.now();
    const timestamps = rateLimits.get(tableId) || [];
    const valid = timestamps.filter(t => now - t < 10 * 60 * 1000);
    if (valid.length >= 5) {
        return false;
    }
    valid.push(now);
    rateLimits.set(tableId, valid);
    return true;
}

async function startTunnel(port, retryCount = 0) {
    try {
        tunnel = await localtunnel({ port: port });
        publicUrl = tunnel.url;
        tunnelConnected = true;
        tunnelLastError = null;
        
        console.log('Tunnel started:', publicUrl);
        if (mainWindowRef) {
            mainWindowRef.webContents.send('tunnel-url-updated', publicUrl);
        }

        tunnel.on('close', () => {
            tunnelConnected = false;
            if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                mainWindowRef.webContents.send('tunnel-url-updated', null);
            }
            if (server) {
                // Auto-reconnect logic
                const timeouts = [5000, 10000, 30000];
                const delay = timeouts[Math.min(retryCount, timeouts.length - 1)];
                setTimeout(() => startTunnel(port, retryCount + 1), delay);
            }
        });

        tunnel.on('error', (err) => {
            tunnelConnected = false;
            tunnelLastError = err.message;
            console.error('Tunnel error:', err);
        });

    } catch (err) {
        tunnelConnected = false;
        tunnelLastError = err.message;
        console.error('Failed to start tunnel:', err);
        const timeouts = [5000, 10000, 30000];
        const delay = timeouts[Math.min(retryCount, timeouts.length - 1)];
        setTimeout(() => startTunnel(port, retryCount + 1), delay);
    }
}

function startMenuServer(mainWindow, db) {
    mainWindowRef = mainWindow;
    dbRef = db;
    const app = express();
    app.use(cors());
    app.use(express.json());

    // API Routes must come BEFORE the static/proxy middleware


    app.get('/api/settings/public', (req, res) => {
        try {
            const settings = dbRef.getSettings();
            res.json({
                success: true,
                businessName: settings.business_name || 'مطعم / كافيه',
                currency: 'SAR'
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/menu', (req, res) => {
        try {
            const menuData = dbRef.getPublicMenu();
            const settings = dbRef.getSettings();
            res.json({ 
                success: true, 
                data: menuData,
                settings: { businessName: settings.business_name || 'مطعم / كافيه' }
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/order/:id', (req, res) => {
        try {
            const order = dbRef.getWebOrderById(req.params.id);
            if (!order) {
                return res.status(404).json({ success: false, error: 'Order not found' });
            }
            res.json({ success: true, order });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/order', (req, res) => {
        try {
            const { tableId, items, idempotencyKey, notes } = req.body;
            
            // Validation
            if (!tableId || typeof tableId !== 'number') {
                return res.status(400).json({ success: false, error: 'Invalid tableId' });
            }
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: 'Items must be a non-empty array' });
            }

            // Rate limit check
            if (!checkRateLimit(tableId)) {
                return res.status(429).json({ success: false, error: 'Too many orders. Please wait a few minutes.' });
            }

            // Idempotency check
            if (idempotencyKey) {
                const existing = dbRef.getWebOrderByIdempotencyKey(idempotencyKey);
                if (existing) {
                    return res.json({ success: true, order: existing });
                }
            }

            let serverTotal = 0;
            const validatedItems = [];
            
            // Validate items & calculate total & check stock
            for (const item of items) {
                if (!item.id || typeof item.id !== 'number') {
                    return res.status(400).json({ success: false, error: 'Invalid item id' });
                }
                if (!item.qty || typeof item.qty !== 'number' || item.qty <= 0 || item.qty > 50) {
                    return res.status(400).json({ success: false, error: 'Invalid item quantity' });
                }

                const dbItem = dbRef.getDbInstance().prepare('SELECT * FROM products WHERE id = ?').get(item.id);
                if (!dbItem) {
                    return res.status(400).json({ success: false, error: `Item ${item.id} not found` });
                }
                if (dbItem.is_service === 1) {
                    return res.status(400).json({ success: false, error: `Item ${dbItem.name} cannot be ordered online` });
                }
                if (dbItem.stock < item.qty) {
                    return res.status(400).json({ success: false, error: `Not enough stock for ${dbItem.name}` });
                }

                let itemPrice = dbItem.price;
                const validatedMods = [];
                if (Array.isArray(item.modifiers)) {
                    for (const mod of item.modifiers) {
                        const dbMod = dbRef.getDbInstance().prepare('SELECT * FROM modifiers WHERE id = ?').get(mod.id);
                        if (dbMod && dbMod.product_id === dbItem.id) {
                            itemPrice += dbMod.price;
                            validatedMods.push({ id: dbMod.id, name: dbMod.name, price: dbMod.price });
                        }
                    }
                }

                serverTotal += (itemPrice * item.qty);
                validatedItems.push({
                    id: dbItem.id,
                    name: dbItem.name, // keep for convenience
                    qty: item.qty,
                    price: itemPrice,
                    modifiers: validatedMods,
                    note: item.note || ''
                });
            }

            const orderId = 'W-' + crypto.randomUUID().slice(0,8).toUpperCase();
            
            const newOrder = dbRef.createWebOrder({
                id: orderId,
                tableId,
                items: validatedItems,
                serverTotal,
                idempotencyKey: idempotencyKey || null,
                notes: notes || ''
            });

            if (mainWindowRef) {
                mainWindowRef.webContents.send('incoming-web-order', newOrder);
            }

            res.json({ success: true, order: newOrder });

        } catch (err) {
            console.error('Error placing order:', err);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });

    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    if (isDev) {
        app.use((req, res, next) => {
            if (req.path.startsWith('/api')) return next();
            
            const options = {
                hostname: '127.0.0.1',
                port: 3000,
                path: req.originalUrl,
                method: req.method,
                headers: { ...req.headers, host: '127.0.0.1:3000' }
            };
            
            const proxyReq = http.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            });
            
            req.pipe(proxyReq, { end: true });
            
            proxyReq.on('error', (err) => {
                console.error('Proxy Error:', err);
                res.status(502).send('Vite server not reachable. Ensure npm run dev is running.');
            });
        });
    } else {
        const distPath = path.join(__dirname, '../dist');
        app.use(express.static(distPath));
        
        // Handle SPA routing
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(distPath, 'index.html'));
            }
        });
    }

    server = app.listen(0, () => {
        const port = server.address().port;
        console.log(`Menu server running dynamically on port ${port}`);
        startTunnel(port);
    });
}

function stopMenuServer() {
    if (tunnel) {
        tunnel.close();
        tunnel = null;
    }
    if (server) {
        server.close();
        server = null;
    }
    tunnelConnected = false;
    publicUrl = null;
}

function getPublicUrl() {
    return publicUrl;
}

function getTunnelStatus() {
    return {
        url: publicUrl,
        connected: tunnelConnected,
        lastError: tunnelLastError
    };
}

module.exports = {
    startMenuServer,
    stopMenuServer,
    getPublicUrl,
    getTunnelStatus
};
