const fs = require('fs');
const path = require('path');

// 1. Patch database.cjs
const dbPath = path.join(__dirname, 'electron', 'database.cjs');
let dbCode = fs.readFileSync(dbPath, 'utf8');

// A. Init Database (Table creation + indexes)
const initDbTarget = "unit TEXT DEFAULT 'وحدة'\n        );\n    `);";
const initDbReplacement = `unit TEXT DEFAULT 'وحدة'
        );
    \`);

    db.exec(\`
        CREATE TABLE IF NOT EXISTS global_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT,
            barcode TEXT,
            unit TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_global_catalog_barcode ON global_catalog(barcode);
        CREATE INDEX IF NOT EXISTS idx_global_catalog_cat_name ON global_catalog(category, name);
    \`);
    
    // Auto-migrate catalog data on init
    migrateGlobalCatalog();`;
if (!dbCode.includes('CREATE TABLE IF NOT EXISTS global_catalog')) {
    dbCode = dbCode.replace(initDbTarget, initDbReplacement);
}

// B. Replace editItem
const editItemTarget = `function editItem(item) {
    const metadataStr = item.Metadata ? JSON.stringify(item.Metadata) : null;
    db.prepare(\`UPDATE products SET name=?, price=?, category=?, image=?, cost=?, barcode=?, supplier_id=?, is_service=?, unit=?, min_stock_level=?, bulk_unit_name=?, bulk_unit_size=?, metadata_json=? WHERE id=?\`)
        .run(item.Name, item.Price, item.Category || 'عام', item.Image || '',
             item.Cost || 0, item.Barcode || '', item.SupplierID || null,
             item.IsService ? 1 : 0, item.Unit || 'وحدة', 
             item.MinStockLevel || 0, item.BulkUnitName || '', item.BulkUnitSize || 1,
             metadataStr,
             item.ID);
    addAuditLog('EDIT_PRODUCT', \`ID: \${item.ID}, Name: \${item.Name}\`);
    return item;
}`;
const editItemReplacement = `function editItem(item) {
    const tx = db.transaction(() => {
        const current = db.prepare('SELECT stock FROM products WHERE id=?').get(item.ID);
        const metadataStr = item.Metadata ? JSON.stringify(item.Metadata) : null;
        
        db.prepare(\`UPDATE products SET name=?, price=?, category=?, image=?, cost=?, stock=?, barcode=?, supplier_id=?, is_service=?, unit=?, min_stock_level=?, bulk_unit_name=?, bulk_unit_size=?, metadata_json=? WHERE id=?\`)
            .run(item.Name, item.Price, item.Category || 'عام', item.Image || '',
                 item.Cost || 0, item.Stock || 0, item.Barcode || '', item.SupplierID || null,
                 item.IsService ? 1 : 0, item.Unit || 'وحدة', 
                 item.MinStockLevel || 0, item.BulkUnitName || '', item.BulkUnitSize || 1,
                 metadataStr,
                 item.ID);
                 
        if (current && current.stock !== (item.Stock || 0)) {
            const diff = (item.Stock || 0) - current.stock;
            db.prepare('INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)')
              .run(item.ID, diff, 'adjustment', 'MenuAdmin Edit');
        }
        
        addAuditLog('EDIT_PRODUCT', \`ID: \${item.ID}, Name: \${item.Name}\`);
    });
    tx();
    
    // Broadcast change if there are browser windows (assumes global.mainWindow)
    if (global.mainWindow) {
        global.mainWindow.webContents.send('products:changed');
    }
    return item;
}`;
if (dbCode.includes(editItemTarget)) {
    dbCode = dbCode.replace(editItemTarget, editItemReplacement);
}

// C. Add Catalog Methods at bottom before module.exports
const catalogMethods = `
function migrateGlobalCatalog() {
    try {
        const data = require('./globalCatalogData.cjs');
        if (!data || !data.length) return;
        const insert = db.prepare('INSERT OR IGNORE INTO global_catalog (name, category, barcode, unit) VALUES (?,?,?,?)');
        const tx = db.transaction(() => {
            for (const row of data) {
                insert.run(row.name, row.category, row.barcode || null, row.unit || 'وحدة / قطعة (PCE)');
            }
        });
        tx();
        console.log('Global catalog migrated successfully.');
    } catch (e) {
        console.error('Failed to migrate global catalog:', e);
    }
}

function getGlobalCatalog(filters = {}) {
    let query = 'SELECT * FROM global_catalog WHERE 1=1';
    let params = [];
    if (filters.category && filters.category !== 'الكل') {
        query += ' AND category = ?';
        params.push(filters.category);
    }
    if (filters.search) {
        query += ' AND (name LIKE ? OR barcode = ?)';
        params.push('%' + filters.search + '%', filters.search);
    }
    query += ' LIMIT 100';
    return db.prepare(query).all(...params);
}

function getGlobalCatalogCategories() {
    return db.prepare('SELECT category, COUNT(*) as count FROM global_catalog GROUP BY category ORDER BY count DESC').all();
}
`;
if (!dbCode.includes('function migrateGlobalCatalog')) {
    dbCode = dbCode.replace('module.exports = {', catalogMethods + '\nmodule.exports = {');
}

// D. Export methods
if (!dbCode.includes('getGlobalCatalog, getGlobalCatalogCategories')) {
    dbCode = dbCode.replace('getReceiptQR,', 'getReceiptQR, getGlobalCatalog, getGlobalCatalogCategories, migrateGlobalCatalog,');
}

fs.writeFileSync(dbPath, dbCode, 'utf8');

// 2. Patch preload.cjs
const preloadPath = path.join(__dirname, 'electron', 'preload.cjs');
let preloadCode = fs.readFileSync(preloadPath, 'utf8');
if (!preloadCode.includes('getGlobalCatalogCategories:')) {
    preloadCode = preloadCode.replace(
        "importCSV:            (p)      => ipcRenderer.invoke('db:importCSV', p),",
        `importCSV:            (p)      => ipcRenderer.invoke('db:importCSV', p),
  getGlobalCatalog:     (f)      => ipcRenderer.invoke('db:getGlobalCatalog', f),
  getGlobalCatalogCategories: () => ipcRenderer.invoke('db:getGlobalCatalogCategories'),`
    );
    // Add product change listener
    if (!preloadCode.includes('onProductsChanged:')) {
        preloadCode = preloadCode.replace(
            "const { contextBridge, ipcRenderer } = require('electron');",
            "const { contextBridge, ipcRenderer } = require('electron');"
        ).replace(
            "importCSV:            (p)      => ipcRenderer.invoke('db:importCSV', p),",
            `importCSV:            (p)      => ipcRenderer.invoke('db:importCSV', p),
  onProductsChanged:    (cb)     => ipcRenderer.on('products:changed', cb),`
        );
    }
    fs.writeFileSync(preloadPath, preloadCode, 'utf8');
}

// 3. Patch main.cjs
const mainPath = path.join(__dirname, 'electron', 'main.cjs');
let mainCode = fs.readFileSync(mainPath, 'utf8');
if (!mainCode.includes("ipcMain.handle('db:getGlobalCatalog'")) {
    mainCode = mainCode.replace(
        "ipcMain.handle('db:importCSV', async (e, path) => await db.importProductsFromCSV(path));",
        `ipcMain.handle('db:importCSV', async (e, path) => await db.importProductsFromCSV(path));
    ipcMain.handle('db:getGlobalCatalog', async (e, filters) => await db.getGlobalCatalog(filters));
    ipcMain.handle('db:getGlobalCatalogCategories', async () => await db.getGlobalCatalogCategories());`
    );
    if (!mainCode.includes('global.mainWindow = mainWindow;')) {
        mainCode = mainCode.replace("mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));",
            "global.mainWindow = mainWindow;\n    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));");
    }
    fs.writeFileSync(mainPath, mainCode, 'utf8');
}
console.log('Backend patched successfully.');
