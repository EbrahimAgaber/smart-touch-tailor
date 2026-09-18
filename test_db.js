const { app } = require('electron');
app.whenReady().then(() => {
    const db = require('./electron/database.cjs');
    console.log('---SETTINGS START---');
    console.log(JSON.stringify(db.getSettings()));
    console.log('---SETTINGS END---');
    app.quit();
});
