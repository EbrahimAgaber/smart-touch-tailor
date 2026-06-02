const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Hardware Bridge — Handles raw ESC/POS commands and drawer kicking
 * for Windows environments without native node-printer dependencies.
 */

function logToFile(msg) {
    const logPath = path.join(app.getPath('userData'), 'app.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[HW] [${timestamp}] ${msg}\n`);
}

/**
 * kickDrawer
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
            // ESC p 0 25 250 (Standard EPSON Drawer Kick)
            const pulse = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
            const tempFile = path.join(app.getPath('temp'), `kick_${Date.now()}.bin`);
            
            fs.writeFileSync(tempFile, pulse);

            // Use PowerShell to send raw bytes to the printer share
            // Note: This requires the printer to be shared or accessible via its name.
            // A more robust way is using 'Out-Printer' but it doesn't always support raw bytes.
            // We use 'Get-Content -Encoding Byte' (or -AsByte in newer PS) then redirect.
            const command = `powershell -Command "Get-Content -Path '${tempFile}' -AsByte | Out-Printer -Name '${printerName}'"`;
            
            // Fallback for older PowerShell versions:
            // const command = `powershell -Command "Add-Content -Path '${printerName}' -Value ([System.IO.File]::ReadAllBytes('${tempFile}'))"`;

            exec(command, (err, stdout, stderr) => {
                // Cleanup temp file
                try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }

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

module.exports = { kickDrawer };
