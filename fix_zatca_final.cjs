const fs = require('fs');

// 1. Fix main.cjs - remove zatca:getQueueStatus, retryQueue, resumeQueue
let main = fs.readFileSync('electron/main.cjs', 'utf8');
main = main.replace(/ipcMain\.handle\('zatca:getQueueStatus'.*?\n/g, '');
main = main.replace(/ipcMain\.handle\('zatca:retryQueue'.*?\n/g, '');
main = main.replace(/ipcMain\.handle\('zatca:resumeQueue'.*?\n/g, '');
fs.writeFileSync('electron/main.cjs', main, 'utf8');

// 2. Fix zatca-bridge.cjs - add process.env.TEMP_FOLDER
let bridge = fs.readFileSync('electron/zatca-bridge.cjs', 'utf8');
if (!bridge.includes('process.env.TEMP_FOLDER')) {
    bridge = `const path = require('path');\nconst os = require('os');\nprocess.env.TEMP_FOLDER = path.join(os.tmpdir(), path.sep);\n` + bridge;
    fs.writeFileSync('electron/zatca-bridge.cjs', bridge, 'utf8');
}
console.log('Fixed TEMP_FOLDER and leftover handlers');
