const { app } = require('electron');
const bridge = require('../electron/zatca-bridge.cjs');

app.whenReady().then(async () => {
    try {
        console.log("Starting onboarding simulation...");
        const result = await bridge.onboardDevice(app, {
            otp: '123456',
            business_name_ar: 'Test',
            tax_number: '310000000000003',
            branch_name: 'Test Branch',
            branch_city: 'Riyadh',
            branch_industry: 'Retail'
        });
        console.log("Result:", result);
    } catch (e) {
        console.error("ONBOARDING ERROR CAUGHT:");
        console.error(e.stack || e);
    }
    app.quit();
});
