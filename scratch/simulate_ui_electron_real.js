const { app } = require('electron');
const bridge = require('../electron/zatca-bridge.cjs');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(async () => {
    try {
        const dbPath = path.join(process.env.APPDATA, 'البصمة الذكية', 'pos_data.db');
        const db = new Database(dbPath);
        
        console.log("Starting onboarding simulation with REAL DB inside Electron...");
        const result = await bridge.onboardDevice(db, {
            otp: '123345',
            environment: 'sandbox'
        });
        console.log("Result:", result);
    } catch (e) {
        console.log("\n[STACK_TRACE]");
        console.log(e.stack || e);
        if (e.response) {
            console.log("Response data:", e.response.data);
        }
    }
    process.exit(0);
});
