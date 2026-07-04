const { app } = require('electron');
app.whenReady().then(async () => {
    try {
        const db = require('../electron/database.cjs');
        db.initDatabase('C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية');
        const d = db.getZatcaDevice();
        const c = JSON.parse(d.compliance_csid);
        console.log('CSID:', c.binarySecurityToken.substring(0, 100));
        app.quit();
    } catch(e) {
        console.error(e);
        app.quit();
    }
});
