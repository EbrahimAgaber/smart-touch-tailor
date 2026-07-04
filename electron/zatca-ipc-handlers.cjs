const { ipcMain } = require('electron');
const bridge = require('./zatca-bridge.cjs');

function registerZatcaHandlers(db) {
  ipcMain.handle('zatca:onboard',              async (_, args) => {
    // Route to the new correct onboarding logic in main.cjs or replicate it cleanly here:
    const mainModule = require('./main.cjs');
    // Replicating/delegating directly to avoid duplicate handler exceptions:
    const electron = require('electron');
    const handlers = electron.ipcMain.listeners('zatca:onboardDevice');
    if (handlers.length > 0) {
      return await handlers[0]({}, args);
    }
    throw new Error('Onboarding handler not registered.');
  });
  ipcMain.handle('zatca:runComplianceChecks',  ()        => bridge.runComplianceChecks(db.getDbInstance()));
  ipcMain.handle('zatca:issueProductionCSID',  ()        => bridge.issueProductionCSID(db.getDbInstance()));
  ipcMain.handle('zatca:issueInvoice',         (_, sale) => bridge.issueZatcaInvoice(db.getDbInstance(), sale));
  ipcMain.handle('zatca:getStatus',            ()        => bridge.getOnboardingStatus(db.getDbInstance()));
}

module.exports = { registerZatcaHandlers };
