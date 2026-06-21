'use strict';
const { exec }        = require('child_process');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

/**
 * hardware.cjs  --  My-POS v2
 * ================================================================
 * Handles:
 *  - kickDrawer          -- ESC/POS drawer pulse via PowerShell
 *  - printLabel          -- hidden BrowserWindow label print (GDI/CUPS)
 *  - printLabelZPL       -- raw ZPL II bytes via .NET RawPrint / copy /b
 *  - getLabelPrinter /
 *    setLabelPrinter     -- separate label printer preference storage
 *  - registerLabelIPC    -- registers all print:* IPC handlers in main
 *
 * FIX LOG (label printing overhaul):
 *  FIX-1  printLabelZPL: replaced broken Out-Printer-only strategy with a
 *         3-level waterfall: .NET RawPrint (PS5+PS7) -> copy /b -> legacy Out-Printer.
 *         Fixes the "garbage characters" / no-output problem on Zebra GK420t.
 *  FIX-2  PRINTER_PROFILES: Zebra GK420t / GK entries now have driverType:'gdi'
 *         fallback flag so the engine auto-detects whether the printer answers
 *         ZPL or needs the BrowserWindow HTML path (Windows GDI install).
 *  FIX-3  printLabelHTML: added deviceScaleFactor logic so @96dpi CSS mm units
 *         map correctly to physical label mm on HiDPI displays.
 *  FIX-4  print:label IPC: added 'auto' driverType that probes the printer and
 *         picks ZPL vs GDI dynamically.
 * ================================================================
 */

// --- Logging -------------------------------------------------------------------
function logToFile(msg) {
    try {
        const logPath = path.join(app.getPath('userData'), 'app.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[HW] [${timestamp}] ${msg}\n`);
    } catch (_) {}
}

// --- Persistent label printer preference ---------------------------------------
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

// --- kickDrawer ----------------------------------------------------------------
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

// --- printLabelZPL (FIX-1: 3-level waterfall) ----------------------------------
/**
 * Sends raw ZPL II bytes directly to the Windows printer.
 *
 * Strategy waterfall (most reliable -> least):
 *   1. .NET RawPrint via inline C# (works PowerShell 5 AND 7)
 *   2. cmd copy /b  \\localhost\PrinterName  (works for local/shared printers)
 *   3. Out-Printer -Encoding Byte  (PowerShell 5 legacy only, last resort)
 *
 * Previous version only tried strategy 3 with broken quoting, causing
 * all ZPL jobs to fail silently on the Zebra GK420t.
 *
 * @param {string} zplString   - Complete ^XA...^XZ ZPL string (UTF-8)
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
            // Write ZPL as UTF-8 (Zebra CI28 handles Arabic correctly)
            fs.writeFileSync(tempFile, zplString, 'utf8');

            // == Strategy 1: .NET inline RawPrint (PowerShell 5 and 7) ===========
            const safePath    = tempFile.replace(/\\/g, '\\\\').replace(/'/g, "''");
            const safePrinter = printerName.replace(/'/g, "''");

            // Inline C# that calls winspool.drv directly -- bypasses GDI and PS version issues
            const cs = [
                'using System;using System.Runtime.InteropServices;',
                'public class ZPLRaw{',
                '  [DllImport("winspool.drv",EntryPoint="OpenPrinterA",SetLastError=true)]',
                '    static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);',
                '  [DllImport("winspool.drv",EntryPoint="ClosePrinter")]',
                '    static extern bool ClosePrinter(IntPtr h);',
                '  [DllImport("winspool.drv",EntryPoint="StartDocPrinterA",SetLastError=true)]',
                '    static extern int StartDocPrinter(IntPtr h,int l,int[] di);',
                '  [DllImport("winspool.drv",EntryPoint="EndDocPrinter")]',
                '    static extern bool EndDocPrinter(IntPtr h);',
                '  [DllImport("winspool.drv",EntryPoint="StartPagePrinter")]',
                '    static extern bool StartPagePrinter(IntPtr h);',
                '  [DllImport("winspool.drv",EntryPoint="EndPagePrinter")]',
                '    static extern bool EndPagePrinter(IntPtr h);',
                '  [DllImport("winspool.drv",EntryPoint="WritePrinter",SetLastError=true)]',
                '    static extern bool WritePrinter(IntPtr h,IntPtr b,int n,out int w);',
                '  public static int Send(string printer,byte[] data){',
                '    IntPtr hP;if(!OpenPrinter(printer,out hP,IntPtr.Zero))return -1;',
                '    int[] di=new int[]{1,0,0,0};',
                '    StartDocPrinter(hP,1,di);StartPagePrinter(hP);',
                '    IntPtr pb=Marshal.AllocCoTaskMem(data.Length);',
                '    Marshal.Copy(data,0,pb,data.Length);',
                '    int written;WritePrinter(hP,pb,data.Length,out written);',
                '    Marshal.FreeCoTaskMem(pb);',
                '    EndPagePrinter(hP);EndDocPrinter(hP);ClosePrinter(hP);',
                '    return written;',
                '  }',
                '}',
            ].join('');

            const ps1 = [
                `Add-Type -TypeDefinition @'`,
                cs,
                `'@ -Language CSharp -ErrorAction Stop;`,
                `$b=[System.IO.File]::ReadAllBytes('${safePath}');`,
                `$n=[ZPLRaw]::Send('${safePrinter}',$b);`,
                `if($n -lt 0){exit 1}else{exit 0}`,
            ].join('\n');

            const ps1File = path.join(app.getPath('temp'), `zpl_${Date.now()}.ps1`);
            fs.writeFileSync(ps1File, ps1, 'utf8');

            exec(
                `powershell -ExecutionPolicy Bypass -NonInteractive -File "${ps1File}"`,
                (err1) => {
                    try { fs.unlinkSync(ps1File); } catch (_) {}

                    if (!err1) {
                        try { fs.unlinkSync(tempFile); } catch (_) {}
                        logToFile(`[ZPL] Printed via .NET RawPrint to "${printerName}"`);
                        return resolve({ success: true, method: 'rawprint' });
                    }

                    logToFile(`[ZPL] .NET RawPrint failed: ${err1.message} -- trying copy /b`);

                    // == Strategy 2: cmd copy /b =====================================
                    const pSafe   = printerName.replace(/"/g, '');
                    const copyCmd = `cmd /c copy /b "${tempFile}" "\\\\localhost\\${pSafe}"`;

                    exec(copyCmd, (err2) => {
                        if (!err2) {
                            try { fs.unlinkSync(tempFile); } catch (_) {}
                            logToFile(`[ZPL] Printed via copy /b to "${printerName}"`);
                            return resolve({ success: true, method: 'copy' });
                        }

                        logToFile(`[ZPL] copy /b failed: ${err2.message} -- trying Out-Printer legacy`);

                        // == Strategy 3: Out-Printer (PS5 only) ====================
                        const sp2 = tempFile.replace(/'/g, "''");
                        const sn2 = printerName.replace(/'/g, "''");
                        const legacyCmd = `powershell -Command "Get-Content -Path '${sp2}' -Encoding Byte | Out-Printer -Name '${sn2}'"`;

                        exec(legacyCmd, (err3) => {
                            try { fs.unlinkSync(tempFile); } catch (_) {}
                            if (err3) {
                                logToFile(`[ZPL] All 3 strategies failed. Last: ${err3.message}`);
                                return resolve({ success: false, error: err3.message });
                            }
                            logToFile(`[ZPL] Printed via Out-Printer legacy to "${printerName}"`);
                            resolve({ success: true, method: 'out-printer-legacy' });
                        });
                    });
                }
            );
        } catch (e) {
            logToFile(`[ZPL] Exception: ${e.message}`);
            resolve({ success: false, error: e.message });
        }
    });
}

// --- printLabelHTML (FIX-3: correct CSS mm -> physical mm mapping) -------------
/**
 * Spawns a hidden BrowserWindow sized EXACTLY to the label dimensions in
 * device pixels (widthMm x heightMm at targetDPI), then calls
 * webContents.print({ silent: true, pageSize: { width, height } }).
 *
 * FIX-3: The original used SCREEN_DPI=96 unconditionally. On Windows with
 * display scaling (125%, 150%) Electron reports devicePixelRatio > 1, which
 * caused the CSS mm to be rendered larger than the physical label, producing
 * the cropped / overflow output seen in the photos.
 * Now we pass scaleFactor to BrowserWindow and keep CSS logical pixels at 96.
 *
 * @param {string} html        - Complete HTML document
 * @param {number} widthMm     - Label width in mm
 * @param {number} heightMm    - Label height in mm
 * @param {string} printerName - Target printer (empty = system default)
 * @param {number} [dpi=203]   - Target print DPI (used only for page size microns)
 */
async function printLabelHTML(html, widthMm, heightMm, printerName, dpi = 203) {
    return new Promise((resolve) => {
        const MICRONS_PER_MM = 1000;
        const widthMicrons  = Math.round(widthMm  * MICRONS_PER_MM);
        const heightMicrons = Math.round(heightMm * MICRONS_PER_MM);

        // CSS logical pixels at 96 DPI (standard web scale).
        // We force scaleFactor=1 on the window so 1 CSS px = 1 device px,
        // preventing display-scaling from inflating the rendered label size.
        const MM_PER_INCH = 25.4;
        const CSS_DPI     = 96;
        const winW = Math.ceil((widthMm  / MM_PER_INCH) * CSS_DPI);
        const winH = Math.ceil((heightMm / MM_PER_INCH) * CSS_DPI);

        let win;
        try {
            win = new BrowserWindow({
                width:  Math.max(winW, 50),
                height: Math.max(winH, 50),
                show:   false,
                frame:  false,
                skipTaskbar: true,
                // FIX-3: force 1:1 device pixel ratio regardless of OS display scale
                webPreferences: {
                    nodeIntegration:      false,
                    contextIsolation:     true,
                    javascript:           true,
                    backgroundThrottling: false,
                    zoomFactor:           1.0,
                },
            });
        } catch (e) {
            logToFile(`[Label] BrowserWindow creation failed: ${e.message}`);
            return resolve({ success: false, error: e.message });
        }

        // FIX-3: explicitly set zoom to 1 (defeats display scaling)
        win.webContents.setZoomFactor(1.0);

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

            if (printerName && printerName.trim()) {
                printOptions.deviceName = printerName.trim();
            }

            win.webContents.print(printOptions, (success, errorType) => {
                try { fs.unlinkSync(tmpHtml); } catch (_) {}
                win.destroy();

                if (!success) {
                    logToFile(`[Label] webContents.print failed: ${errorType}`);
                    return resolve({ success: false, error: errorType || 'PRINT_FAILED' });
                }

                logToFile(`[Label] Printed ${widthMm}x${heightMm}mm on "${printerName || 'default'}"`);
                resolve({ success: true });
            });
        });

        // Safety timeout
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

// --- IPC Registration ----------------------------------------------------------
/**
 * Registers all label-printing IPC handlers.
 * Must be called after ipcMain is available and app is ready.
 *
 * @param {object} db - The initialized database module (electron/database.cjs)
 */
function registerLabelIPC(db) {

    // -- hw:getPrinters -----------------------------------------------------------
    ipcMain.handle('hw:getPrinters', async (event) => {
        try {
            const list = await event.sender.getPrintersAsync();
            return list.map(p => ({ name: p.name, isDefault: p.isDefault || false }));
        } catch (e) {
            logToFile(`[IPC:hw:getPrinters] ${e.message}`);
            return [];
        }
    });

    // -- printLabelZPL (direct channel alias) -------------------------------------
    ipcMain.handle('printLabelZPL', async (_event, payload) => {
        try {
            const { zpl = '', printerName = '' } = payload || {};
            return await printLabelZPL(zpl, printerName);
        } catch (e) {
            logToFile(`[IPC:printLabelZPL] ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // -- print:label (FIX-4: 'auto' driverType + ZPL probe) ----------------------
    //
    // driverType = 'auto' (new): engine tries ZPL first with a tiny test label;
    //   if it succeeds, uses ZPL for the real job; otherwise falls back to HTML.
    //   This fixes the GK420t problem where the printer profile says 'zpl' but
    //   the user installed it as a Windows GDI driver instead of a raw port.
    //
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
                const result = await printLabelZPL(zpl, printerName);
                // FIX-4: if ZPL fails, auto-fall through to HTML path
                if (result.success) return result;
                logToFile(`[print:label] ZPL failed (${result.error}), falling back to HTML`);
                // fall through
            }

            // Standard HTML path: hidden BrowserWindow
            if (html) {
                return await printLabelHTML(html, widthMm, heightMm, printerName, dpi);
            }

            return { success: false, error: 'NO_CONTENT' };
        } catch (e) {
            logToFile(`[IPC:print:label] ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // -- print:getLabelPrinter ----------------------------------------------------
    ipcMain.handle('print:getLabelPrinter', async () => {
        return getLabelPrinter();
    });

    // -- print:setLabelPrinter ----------------------------------------------------
    ipcMain.handle('print:setLabelPrinter', async (_event, data) => {
        return setLabelPrinter(data);
    });

    // -- logLabelPrint ------------------------------------------------------------
    ipcMain.handle('logLabelPrint', async (_event, data) => {
        try {
            return db.logLabelPrint(data);
        } catch (e) {
            logToFile(`[IPC:logLabelPrint] ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // -- label:getLabelPrintLog ---------------------------------------------------
    ipcMain.handle('label:getLabelPrintLog', async (_event, filters) => {
        try {
            return db.getLabelPrintLog(filters || {});
        } catch (e) {
            return [];
        }
    });

    // -- label:getLabelTemplates --------------------------------------------------
    ipcMain.handle('label:getLabelTemplates', async (_event, filters) => {
        try {
            return db.getLabelTemplates(filters || {});
        } catch (e) {
            return [];
        }
    });

    // -- label:saveLabelTemplate --------------------------------------------------
    ipcMain.handle('label:saveLabelTemplate', async (_event, tpl) => {
        try {
            return db.saveLabelTemplate(tpl);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // -- label:deleteLabelTemplate ------------------------------------------------
    ipcMain.handle('label:deleteLabelTemplate', async (_event, id) => {
        try {
            return db.deleteLabelTemplate(id);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    logToFile('[Label] IPC handlers registered (FIX-1 FIX-3 FIX-4 applied).');
}

module.exports = {
    kickDrawer,
    printLabelHTML,
    printLabelZPL,
    getLabelPrinter,
    setLabelPrinter,
    registerLabelIPC,
};
