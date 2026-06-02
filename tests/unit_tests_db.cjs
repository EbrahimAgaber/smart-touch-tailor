const dbLogic = require('../electron/database.cjs');
const path = require('path');
const fs = require('fs');

// Use a temporary test directory
const testDir = path.join(__dirname, 'test_data');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

console.log("--- Starting Database Logic Tests ---");

try {
    // 1. Initialization
    dbLogic.initDatabase(testDir);
    console.log("✅ Database initialized successfully.");

    // 2. Staff & Auth
    const staff = dbLogic.getStaff();
    console.log("✅ Staff retrieved, count:", staff.length);
    if (staff.length === 0) throw new Error("Seed failed: No staff found.");
    
    const admin = dbLogic.verifyStaffPin('1234');
    if (!admin || admin.role !== 'Admin') throw new Error("Admin login failed.");
    console.log("✅ Admin PIN verification passed.");

    // 3. Menu Management
    const newItem = {
        Name: "Test Product",
        Price: 50.0,
        Category: "TestCat",
        Image: "",
        Stock: 10,
        Cost: 20.0,
        Barcode: "123456"
    };
    const addedItem = dbLogic.addItem(newItem);
    if (!addedItem.ID) throw new Error("Failed to add item.");
    console.log("✅ Item added with ID:", addedItem.ID);

    const menu = dbLogic.getMenu();
    const itemInMenu = menu.find(i => i.ID === addedItem.ID);
    if (!itemInMenu || itemInMenu.Name !== "Test Product") throw new Error("Item not found in menu.");
    console.log("✅ Item retrieved correctly from menu.");

    // 4. Sales and Inventory Logic
    const saleData = {
        invoice: "TEST-INV-001",
        total: 100.0,
        discount: 0,
        payment: "Cash",
        paid: 100.0,
        change: 0,
        items: [{
            ID: addedItem.ID,
            Name: addedItem.Name,
            Price: 50.0,
            Qty: 1,
            Mods: []
        }],
        paymentDetails: { cashReceived: 100 }
    };
    const saleResult = dbLogic.saveSale(saleData);
    if (!saleResult.saleId) throw new Error("Sale failed to save.");
    console.log("✅ Sale recorded, ID:", saleResult.saleId);

    const updatedMenu = dbLogic.getMenu();
    const updatedItem = updatedMenu.find(i => i.ID === addedItem.ID);
    if (updatedItem.Stock !== 9) throw new Error(`Stock deduction failed. Expected 9, got ${updatedItem.Stock}`);
    console.log("✅ Stock deduction verified (10 -> 9).");

    // 5. Accounting Entries
    const ledger = dbLogic.getGeneralLedger({ account_code: 1101 }); // Cash Account
    const saleEntry = ledger.find(e => e.reference === "TEST-INV-001");
    if (!saleEntry || saleEntry.debit !== 100) throw new Error("Ledger entry (Cash) missing or incorrect.");
    console.log("✅ Ledger entry (Cash Debit) verified.");

    const trialBalance = dbLogic.getTrialBalance();
    const cashAcc = trialBalance.find(a => a.account_code === 1101);
    if (cashAcc.balance !== 100) throw new Error(`Balance mismatch in Trial Balance: ${cashAcc.balance}`);
    console.log("✅ Trial Balance balance verified.");

    // 6. Reports
    const reportDate = new Date().toISOString().split('T')[0];
    const report = dbLogic.getFinancialReport(reportDate, reportDate);
    if (report.revenue !== 100) throw new Error("Financial report revenue mismatch.");
    console.log("✅ Financial Report revenue verified.");

    // 7. Customers
    const customer = dbLogic.addCustomer({ name: "Alice", phone: "555-1234" });
    const pointsBefore = dbLogic.getCustomers({ search: "Alice" })[0].loyalty_points;
    
    // Perform sale for customer
    dbLogic.saveSale({
        ...saleData,
        invoice: "TEST-INV-002",
        customer_id: customer.id
    });
    
    const alice = dbLogic.getCustomers({ search: "Alice" })[0];
    if (alice.loyalty_points <= pointsBefore) throw new Error("Loyalty points update failed.");
    console.log("✅ Customer loyalty points verified.");

    // 8. Shift Management
    const shift = dbLogic.openShift(1000);
    if (shift.status !== 'open') throw new Error("Shift failed to open.");
    console.log("✅ Shift opened.");

    const closedShift = dbLogic.closeShift(shift.id, 1200);
    if (!closedShift || closedShift.status !== 'closed') throw new Error("Shift failed to close.");
    console.log("✅ Shift closed with variance calculation.");

    console.log("\n--- ALL BACKEND TESTS PASSED SUCCESSFULLY! ---");
    process.exit(0);

} catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error(err.stack);
    process.exit(1);
}
