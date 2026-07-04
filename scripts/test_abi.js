const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('[Test ABI] Checking for built executable...');
const distPath = path.join(__dirname, '../dist-electron');
let exePath = null;

if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    for (const folder of files) {
        if (folder.includes('win-unpacked')) {
            const exeFile = path.join(distPath, folder, 'smart-touch-pos.exe');
            if (fs.existsSync(exeFile)) {
                exePath = exeFile;
                break;
            }
        }
    }
}

// Fallback to electron binary if dist is not unpacked properly or name differs
if (!exePath && fs.existsSync(path.join(distPath, 'win-unpacked', 'smart-touch-pos.exe'))) {
    exePath = path.join(distPath, 'win-unpacked', 'smart-touch-pos.exe');
}

if (!exePath) {
    console.log('[Test ABI] WARNING: Could not find the unpacked executable (expected at dist-electron/win-unpacked/smart-touch-pos.exe). Build may be missing or named differently.');
    console.log('[Test ABI] Falling back to testing via electron directly...');
    const electronExe = path.join(__dirname, '../node_modules/.bin/electron.cmd');
    if (fs.existsSync(electronExe)) {
        exePath = electronExe;
    } else {
        console.error('[Test ABI] ERROR: Could not find local electron binary.');
        process.exit(1);
    }
}

const args = exePath.includes('electron.cmd') ? ['.', '--verify-abi'] : ['--verify-abi'];

console.log(`[Test ABI] Executing: ${exePath} ${args.join(' ')}`);

const child = spawnSync(exePath, args, {
    stdio: 'inherit',
    windowsHide: false,
    cwd: path.join(__dirname, '..'),
    shell: exePath.endsWith('.cmd')
});

if (child.error) {
    console.error('[Test ABI] ERROR spawning executable:', child.error);
    process.exit(1);
}

if (child.status !== 0) {
    console.error(`[Test ABI] FAILED! Executable exited with code ${child.status}. This usually indicates a native module ABI mismatch (better-sqlite3) or an initialization crash.`);
    process.exit(1);
}

console.log('[Test ABI] SUCCESS! ABI compatibility verified on target OS.');
process.exit(0);
