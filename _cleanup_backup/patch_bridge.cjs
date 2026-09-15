const fs = require('fs');
let c = fs.readFileSync('electron/zatca-bridge.cjs', 'utf8');
c = c.replace(
    "const otp = settingsData.zatcaOTP || businessSettings.zatcaOTP;",
    "const otp = settingsData.otp || settingsData.zatcaOTP || businessSettings.zatcaOTP;"
);
fs.writeFileSync('electron/zatca-bridge.cjs', c, 'utf8');
console.log('Patched bridge');
