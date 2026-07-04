const bridge = require('../electron/zatca-bridge.cjs');

const mockDb = {
    prepare: (sql) => {
        return {
            get: (...args) => {
                if (sql.includes('zatca_device')) {
                    return { onboarding_complete: 0 };
                }
                if (sql.includes('business_settings')) {
                    return {};
                }
            },
            all: (...args) => {
                if (sql.includes('business_settings')) {
                    return [
                        {key: 'zatca_env', value: 'sandbox'},
                        {key: 'crn', value: '1234567890'},
                        {key: 'vatNumber', value: '310000000000003'},
                        {key: 'branchName', value: 'Main Branch'},
                        {key: 'industry', value: 'Retail'},
                        {key: 'city', value: 'Riyadh'},
                        {key: 'district', value: 'District'},
                        {key: 'street', value: 'Street'},
                        {key: 'buildingNumber', value: '1234'},
                        {key: 'postalCode', value: '12345'},
                        {key: 'business_name_ar', value: 'Test Business'}
                    ];
                }
                return [];
            },
            run: (...args) => {
                // mock run
            }
        };
    }
};

(async () => {
    try {
        console.log("Starting onboarding simulation with mock DB inside Electron...");
        const result = await bridge.onboardDevice(mockDb, {
            otp: '123345',
            environment: 'sandbox'
        });
        console.log("Result:", result);
    } catch (e) {
        console.log("\n[STACK_TRACE]");
        console.log(e.stack || e);
    }
    process.exit(0);
})();
