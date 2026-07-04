const fs = require('fs');
const content = fs.readFileSync('c:/my-pos/v2/electron/database.cjs', 'utf-8');
const startStr = 'function editItem(item) {';
const endStr = 'return item;\r\n}';
const endStr2 = 'return item;\n}';
let endIndex = -1;
let startIndex = content.indexOf(startStr);
if (content.indexOf(endStr, startIndex) !== -1) {
    endIndex = content.indexOf(endStr, startIndex) + endStr.length;
} else if (content.indexOf(endStr2, startIndex) !== -1) {
    endIndex = content.indexOf(endStr2, startIndex) + endStr2.length;
}

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find editItem block');
    process.exit(1);
}

const replacement = `function editItem(item) {
    db.transaction(() => {
        const oldProduct = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.ID);
        const metadataStr = item.Metadata ? JSON.stringify(item.Metadata) : null;
        const newStock = item.IsService ? 999999 : (item.Stock || 0);

        db.prepare(\`UPDATE products SET name=?, price=?, category=?, image=?, stock=?, cost=?, barcode=?, supplier_id=?, is_service=?, unit=?, min_stock_level=?, bulk_unit_name=?, bulk_unit_size=?, metadata_json=? WHERE id=?\`)
            .run(item.Name, item.Price, item.Category || 'عام', item.Image || '',
                 newStock,
                 item.Cost || 0, item.Barcode || '', item.SupplierID || null,
                 item.IsService ? 1 : 0, item.Unit || 'وحدة', 
                 item.MinStockLevel || 0, item.BulkUnitName || '', item.BulkUnitSize || 1,
                 metadataStr,
                 item.ID);

        if (oldProduct && !item.IsService) {
            const diff = newStock - oldProduct.stock;
            if (diff !== 0) {
                db.prepare('INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)')
                  .run(item.ID, diff, 'manual_edit', 'تعديل من لوحة التحكم');
            }
        }
    })();
    addAuditLog('EDIT_PRODUCT', \`ID: \${item.ID}, Name: \${item.Name}\`);
    return item;
}`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('c:/my-pos/v2/electron/database.cjs', newContent, 'utf-8');
console.log('Replaced successfully.');
