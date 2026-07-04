const fs = require('fs');
let c = fs.readFileSync('electron/preload.cjs', 'utf8');

c = c.replace(
    "getZatcaDevice:       ()       => ipcRenderer.invoke('zatca:getDevice'),",
    "getZatcaDevice:       ()       => ipcRenderer.invoke('zatca:getStatus'),"
);

c = c.replace(
    "onboardZatcaDevice:   (d)      => ipcRenderer.invoke('zatca:onboardDevice', d),",
    "onboardZatcaDevice:   (d)      => ipcRenderer.invoke('zatca:onboard', d),"
);

c = c.replace(
    "runSimulationTests:   ()       => ipcRenderer.invoke('zatca:runSimulationTests'),",
    "runSimulationTests:   ()       => ipcRenderer.invoke('zatca:runComplianceChecks'),"
);

fs.writeFileSync('electron/preload.cjs', c, 'utf8');
console.log('Patched preload');
