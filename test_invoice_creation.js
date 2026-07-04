const db = require('./electron/database.cjs');
db.initDatabase();
try {
    const saleData = {
        items: [
            { id: 1, product_id: 1, product_name_ar: "Test Item", product_name_en: "Test Item", quantity: 1, price: 100, tax_rate: 15, tax_amount: 15, total: 115, cost_price: 50, discount_amount: 0 }
        ],
        subtotal: 100,
        tax: 15,
        total: 115,
        payment_method: 'cash',
        amount_paid: 115,
        amount_change: 0,
        cashier_id: 1,
        cashier_name: 'Admin',
        status: 'completed',
        sale_date: new Date().toISOString()
    };
    const result = db.saveSale(saleData);
    console.log("Sale created:", result);

    const zatcaQueue = db.getDbInstance().prepare('SELECT * FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
    console.log("Queue Entry:", zatcaQueue ? "Found" : "Not Found");
    if (zatcaQueue) {
        console.log("Invoice Number:", zatcaQueue.invoice_number);
        console.log("ICV:", zatcaQueue.icv);
        console.log("UUID:", zatcaQueue.uuid);
        console.log("XML Hash:", zatcaQueue.xml_hash);
    }
} catch (e) {
    console.error("Error creating sale:", e);
}
