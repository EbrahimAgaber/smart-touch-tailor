const fs = require('fs');
let c = fs.readFileSync('electron/zatca-ipc-handlers.cjs', 'utf8');

c = c.replace(
  'bridge.onboardDevice(db, args)',
  'bridge.onboardDevice(db.getDbInstance(), args)'
);
c = c.replace(
  'bridge.runComplianceChecks(db)',
  'bridge.runComplianceChecks(db.getDbInstance())'
);
c = c.replace(
  'bridge.issueProductionCSID(db)',
  'bridge.issueProductionCSID(db.getDbInstance())'
);
c = c.replace(
  'bridge.issueZatcaInvoice(db, sale)',
  'bridge.issueZatcaInvoice(db.getDbInstance(), sale)'
);
c = c.replace(
  'bridge.getOnboardingStatus(db)',
  'bridge.getOnboardingStatus(db.getDbInstance())'
);

fs.writeFileSync('electron/zatca-ipc-handlers.cjs', c, 'utf8');
console.log('Patched handlers');
