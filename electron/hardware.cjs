'use strict';
const { exec }        = require('child_process');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

/**
 * hardware.cjs — My-POS v2
 * ════════════════════════════════════════════════════════════════════
 * Handles:
 *  • kickDrawer          — ESC/POS drawer pulse via PowerShell
 *  • printLabel          — hidden BrowserWindow label print (GDI/CUPS)
 *  • printLabelZPL       — raw ZPL II bytes via PowerShell (Zebra etc.)
 *  • getLabelPrinter /
 *    setLabelPrinter     — separate label printer preference storage
 *  • registerLabelIPC    — registers all print:* IPC handlers in main
 * ════════════════════════════════════════════════════════════════════
 */

// ─── Logging ──────────────────────────────────────────────────────────────────
function logToFile(msg) {
    try {
        const logPath = path.join(app.getPath('userData'), 'app.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[HW] [${timestamp}] ${msg}\n`);
    } catch (_) {}
}

// ─── Persistent label printer preference ──────────────────────────────────────
// Stored in userData/label_printer.json separate from receipt printer setting.
function _labelPrinterFile() {
    return path.join(app.getPath('userData'), 'label_printer.json');
}

function getLabelPrinter() {
    try {
        const raw = fs.readFileSync(_labelPrinterFile(), 'utf8');
        return JSON.parse(raw) || {};
    } catch (_) {
        return {};
    }
}

function setLabelPrinter(data) {
    try {
        fs.writeFileSync(_labelPrinterFile(), JSON.stringify(data || {}), 'utf8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ─── kickDrawer ───────────────────────────────────────────────────────────────
/**
 * Sends the standard ESC/POS drawer kick pulse [27, 112, 0, 25, 250]
 * to the specified printer using a temporary binary file and PowerShell.
 */
async function kickDrawer(printerName) {
    if (!printerName) {
        logToFile('Kick attempted without printer name configured.');
        return { success: false, error: 'PRINTER_NOT_SET' };
    }

    return new Promise((resolve) => {
        try {
            const pulse = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
            const tempFile = path.join(app.getPath('temp'), `kick_${Date.now()}.bin`);
            fs.writeFileSync(tempFile, pulse);

            const command = `powershell -Command "Get-Content -Path '${tempFile}' -AsByte | Out-Printer -Name '${printerName}'"`;

            exec(command, (err) => {
                try { fs.unlinkSync(tempFile); } catch (_) {}
                if (err) {
                    logToFile(`Kick failed for ${printerName}: ${err.message}`);
                    return resolve({ success: false, error: err.message });
                }
                logToFile(`Drawer kicked successfully on ${printerName}`);
                resolve({ success: true });
            });
        } catch (e) {
            logToFile(`Kick Exception: ${e.message}`);
            resolve({ success: false, error: e.message });
        }
    });
}

// ─── printLabelZPL (P8) ───────────────────────────────────────────────────────
/**
 * Sends raw ZPL II bytes directly to the printer via PowerShell,
 * mirroring the kickDrawer pattern but with variable payload.
 * Used when driverType === 'zpl'.
 *
 * @param {string} zplString  - Complete ^XA...^XZ ZPL string
 * @param {string} printerName - Windows printer display name
 */
async function printLabelZPL(zplString, printerName) {
    if (!printerName) {
        logToFile('[ZPL] No printer name supplied.');
        return { success: false, error: 'PRINTER_NOT_SET' };
    }
    if (!zplString || typeof zplString !== 'string') {
        return { success: false, error: 'ZPL_EMPTY' };
    }

    return new Promise((resolve) => {
        try {
            const tempFile = path.join(
                app.getPath('temp'),
                `zpl_${Date.now()}_${Math.random().toString(36).slice(2)}.zpl`
            );
            // Write ZPL as UTF-8 (Zebra firmware handles this for Latin + Arabic via CI28)
            fs.writeFileSync(tempFile, zplString, 'utf8');

            // Two strategies:
            //   1. Direct pipe using [System.IO.File]::ReadAllBytes (works on PS 5+)
            //   2. Fallback: copy /b to a UNC printer share
            // Strategy 1 (preferred):
            const psCmd = [
                `$bytes = [System.IO.File]::ReadAllBytes('${tempFile.replace(/'/g, "''")}');`,
                `$stream = [System.Net.Sockets.TcpClient]::new();`,
                // PowerShell raw print via .NET PrintDocument or Out-Printer
                // Out-Printer works for GDI text; for binary we use a raw port approach.
                // We use the simplest cross-version approach: write to the printer port
                // via a temporary text file read as ASCII bytes.
                // Zebra printers expose themselves as file-writable on Windows.
                `$prt = New-Object -ComObject Scripting.FileSystemObject;`,
            ].join(' ');

            // Simpler, most reliable: use copy /b
            // Works when printer is shared or installed as a Windows printer.
            const copyCmd = `cmd /c copy /b "${tempFile}" "\\\\\\\\localhost\\\\${printerName.replace(/"/g, '')}"`;
            // Even simpler fallback used widely:
            const outPrinterCmd = `powershell -Command "Get-Content -Path '${tempFile.replace(/'/g, "''")}' -Encoding Byte | Out-Printer -Name '${printerName.replace(/'/g, "''")}'"`;

            exec(outPrinterCmd, (err, stdout, stderr) => {
                try { fs.unlinkSync(tempFile); } catch (_) {}

                if (err) {
                    // Fallback: try copy /b to printer share
                    logToFile(`[ZPL] Out-Printer failed, trying copy /b: ${err.message}`);
                    const printerShare = `\\\\\\\\localhost\\\\${printerName}`;
                    exec(`cmd /c copy /b "${tempFile}" "${printerShare}"`, (err2) => {
                        if (err2) {
                            logToFile(`[ZPL] copy /b also failed: ${err2.message}`);
                            return resolve({ success: false, error: err2.message });
                        }
                        logToFile(`[ZPL] Printed via copy /b to ${printerName}`);
                        resolve({ success: true, method: 'copy' });
                    });
                    return;
                }

                logToFile(`[ZPL] Printed via Out-Printer to ${printerName}`);
                resolve({ success: true, method: 'out-printer' });
            });
        } catch (e) {
            logToFile(`[ZPL] Exception: ${e.message}`);
            resolve({ success: false, error: e.message });
        }
    });
}

// ─── printLabelHTML (P3) ──────────────────────────────────────────────────────
/**
 * Spawns a hidden BrowserWindow sized EXACTLY to the label dimensions in
 * device pixels (widthMm × heightMm at targetDPI), then calls
 * webContents.print({ silent: true, pageSize: { width, height } }).
 *
 * This bypasses the A4-scaling bug that occurs when printing from the
 * main window or from a window with a mismatched page size.
 *
 * @param {string} html        - Complete HTML document
 * @param {number} widthMm     - Label width in mm
 * @param {number} heightMm    - Label height in mm
 * @param {string} printerName - Target printer (empty = system default)
 * @param {number} [dpi=203]   - Target DPI for device-pixel sizing
 */
async function printLabelHTML(html, widthMm, heightMm, printerName, dpi = 203) {
    return new Promise((resolve) => {
        const MICRONS_PER_MM = 1000;
        const widthMicrons  = Math.round(widthMm  * MICRONS_PER_MM);
        const heightMicrons = Math.round(heightMm * MICRONS_PER_MM);

        // Device-pixel window size: mm → inches → px @ dpi
        const MM_PER_INCH = 25.4;
        const winW = Math.ceil((widthMm  / MM_PER_INCH) * dpi);
        const winH = Math.ceil((heightMm / MM_PER_INCH) * dpi);

        let win;
        try {
            win = new BrowserWindow({
                width:  Math.max(winW, 50),
                height: Math.max(winH, 50),
                show:   false,   // hidden — no UI flash
                frame:  false,
                skipTaskbar: true,
                webPreferences: {
                    nodeIntegration:     false,
                    contextIsolation:    true,
                    javascript:          true,
                    backgroundThrottling: false,
                },
            });
        } catch (e) {
            logToFile(`[Label] BrowserWindow creation failed: ${e.message}`);
            return resolve({ success: false, error: e.message });
        }

        // Write HTML to a temp file so Electron can load it with full CSS support
        const tmpHtml = path.join(
            os.tmpdir(),
            `lbl_${Date.now()}_${Math.random().toString(36).slice(2)}.html`
        );
        try {
            fs.writeFileSync(tmpHtml, html, 'utf8');
        } catch (e) {
            win.destroy();
            return resolve({ success: false, error: `Cannot write temp file: ${e.message}` });
        }

        win.loadFile(tmpHtml).catch((e) => {
            logToFile(`[Label] loadFile error: ${e.message}`);
        });

        win.webContents.once('did-finish-load', () => {
            const printOptions = {
                silent:  true,
                color:   false,
                margins: { marginType: 'none' },
                pageSize: {
                    width:  widthMicrons,
                    height: heightMicrons,
                },
            };

            // Attach printer if specified and not empty
            if (printerName && printerName.trim()) {
                printOptions.deviceName = printerName.trim();
            }

            win.webContents.print(printOptions, (success, errorType) => {
                // Cleanup
                try { fs.unlinkSync(tmpHtml); } catch (_) {}
                win.destroy();

                if (!success) {
                    logToFile(`[Label] webContents.print failed: ${errorType}`);
                    return resolve({ success: false, error: errorType || 'PRINT_FAILED' });
                }

                logToFile(`[Label] Printed ${widthMm}×${heightMm}mm on "${printerName || 'default'}"`);
                resolve({ success: true });
            });
        });

        // Safety timeout: destroy window if it hangs
        setTimeout(() => {
            if (!win.isDestroyed()) {
                win.destroy();
                try { fs.unlinkSync(tmpHtml); } catch (_) {}
                logToFile('[Label] Print window timed out after 30 s');
                resolve({ success: false, error: 'PRINT_TIMEOUT' });
            }
        }, 30000);
    });
}

// ─── IPC Registration (call once from main.cjs after app is ready) ───────────
/**
 * Registers all label-printing IPC handlers.
 * Must be called after ipcMain is available and app is ready.
 *
 * @param {object} db - The initialized database module (electron/database.cjs)
 */
function registerLabelIPC(db) {

    // ── hw:getPrinters ─────────────────────────────────────────
    // Returns the list of installed system printers so the renderer can
    // populate the printer-selector dropdown in LabelPrintSettings.
    ipcMain.handle('hw:getPrinters', async (event) => {
        try {
            // BrowserWindow.webContents.getPrintersAsync() is the modern API
            const list = await event.sender.getPrintersAsync();
            return list.map(p => ({ name: p.name, isDefault: p.isDefault || false }));
        } catch (e) {
            logToFile(`[IPC:hw:getPrinters] ${e.message}`);
            return [];
        }
    });

    // ── printLabelZPL (direct channel alias for renderer convenience) ────────
    // Payload: { zpl: string, printerName: string }
    ipcMain.handle('printLabelZPL', async (_event, payload) => {
        try {
            const { zpl = '', printerName = '' } = payload || {};
            return await printLabelZPL(zpl, printerName);
        } catch (e) {
            logToFile(`[IPC:printLabelZPL] ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // ── print:label ────────────────────────────────────────────────────────
    // Dispatches to ZPL or BrowserWindow path based on driverType in payload.
    // Payload: { html, widthMm, heightMm, printerName, driverType?, zpl?, dpi? }
    ipcMain.handle('print:label', async (_event, payload) => {
        try {
            const {
                html        = '',
                widthMm     = 58,
                heightMm    = 40,
                printerName = '',
                driverType  = 'gdi',
                zpl         = '',
                dpi         = 203,
            } = payload || {};

            // ZPL path: bypass BrowserWindow entirely
            if (driverType === 'zpl' && zpl) {
                return await printLabelZPL(zpl, printerName);
            }

            // Standard HTML path: hidden BrowserWindow
            return await printLabelHTML(html, widthMm, heightMm, printerName, dpi);
        } catch (e) {
            logToFile(`[IPC:print:label] ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // ── print:getLabelPrinter ──────────────────────────────────────────────
    ipcMain.handle('print:getLabelPrinter', async () => {
        return getLabelPrinter();
    });

    // ── print:setLabelPrinter ──────────────────────────────────────────────
    ipcMain.handle('print:setLabelPrinter', async (_event, data) => {
        return setLabelPrinter(data);
    });

    // ── logLabelPrint ─────────────────────────────────────────────────────
    // Writes a row to label_print_log via the database module.
    ipcMain.handle('logLabelPrint', async (_event, data) => {
        try {
            return db.logLabelPrint(data);
        } catch (e) {
            logToFile(`[IPC:logLabelPrint] ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // ── label:getLabelPrintLog ─────────────────────────────────────────────
    ipcMain.handle('label:getLabelPrintLog', async (_event, filters) => {
        try {
            return db.getLabelPrintLog(filters || {});
        } catch (e) {
            return [];
        }
    });

    // ── label:getLabelTemplates ────────────────────────────────────────────
    ipcMain.handle('label:getLabelTemplates', async (_event, filters) => {
        try {
            return db.getLabelTemplates(filters || {});
        } catch (e) {
            return [];
        }
    });

    // ── label:saveLabelTemplate ────────────────────────────────────────────
    ipcMain.handle('label:saveLabelTemplate', async (_event, tpl) => {
        try {
            return db.saveLabelTemplate(tpl);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // ── label:deleteLabelTemplate ──────────────────────────────────────────
    ipcMain.handle('label:deleteLabelTemplate', async (_event, id) => {
        try {
            return db.deleteLabelTemplate(id);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    logToFile('[Label] IPC handlers registered.');
}

module.exports = {
    kickDrawer,
    printLabelHTML,
    printLabelZPL,
    getLabelPrinter,
    setLabelPrinter,
    registerLabelIPC,
};
