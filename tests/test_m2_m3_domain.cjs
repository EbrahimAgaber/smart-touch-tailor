// Comprehensive Programmatic Verification for Milestones 2 & 3
// Financial Integrity, Workforce Schema, Customer Lifecycle, and Domain Logic
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('Starting Milestones 2 & 3 Verification Tests');
console.log('====================================================');

const testDir = path.join(__dirname, 'test_m2_m3_sandbox');
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const dbLogic = require('../electron/database.cjs');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(message);
    }
    passedTests++;
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    // -------------------------------------------------------------
    // Test 1: Database Initialization & Schema Migrations
    // -------------------------------------------------------------
    console.log('\n--- 1. Database Init & M2/M3 Schema Migrations ---');
    dbLogic.initDatabase(testDir);
    const db = dbLogic.getDbInstance();

    // Verify fabric_rolls table
    const rollsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fabric_rolls'").get();
    assert(rollsTable !== undefined, 'Table fabric_rolls exists');

    // Verify tailor_defects table
    const defectsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tailor_defects'").get();
    assert(defectsTable !== undefined, 'Table tailor_defects exists');

    // Verify columns on tailor_order_garments
    const garmentCols = db.prepare("PRAGMA table_info(tailor_order_garments)").all().map(c => c.name);
    assert(garmentCols.includes('assigned_cutter_id'), 'tailor_order_garments has assigned_cutter_id column');
    assert(garmentCols.includes('measurements_json'), 'tailor_order_garments has measurements_json column');

    // Verify staff cutter_piece_rate
    const staffCols = db.prepare("PRAGMA table_info(staff)").all().map(c => c.name);
    assert(staffCols.includes('cutter_piece_rate'), 'staff has cutter_piece_rate column');

    // Verify alteration_tickets linked_order_id
    const altCols = db.prepare("PRAGMA table_info(alteration_tickets)").all().map(c => c.name);
    assert(altCols.includes('linked_order_id'), 'alteration_tickets has linked_order_id column');

    // -------------------------------------------------------------
    // Test 2: Double-Entry GL Ledger on completeTailorOrder
    // -------------------------------------------------------------
    console.log('\n--- 2. Final Balance Collection Double-Entry Accounting ---');
    // Seed test customer, shift, and tailor order
    const cust = dbLogic.addCustomer({ name: 'سالم الدوسري', phone: '0501234567' });
    const shift = dbLogic.openShift(1, 100);

    const initialCash = db.prepare("SELECT balance FROM accounts WHERE account_code = 1111").get()?.balance || 0;
    const initialAR = db.prepare("SELECT balance FROM accounts WHERE account_code = 1200").get()?.balance || 0;

    const orderRes = dbLogic.createTailorOrder({
        customer_id: cust.id,
        total_amount: 500,
        deposit_paid: 200,
        balance_due: 300,
        garments: [
            { garment_type: 'thobe', measurements: { length: 58, sleeve: 24 } }
        ]
    });
    assert(orderRes.success === true, 'Tailor order created successfully');

    // Complete order with cash balance payment of 300 SAR
    const completeRes = dbLogic.completeTailorOrder({
        order_id: orderRes.order_id,
        payment_method: 'cash',
        balance_paid: 300
    });
    assert(completeRes.success === true, 'completeTailorOrder returned success');

    // Check order status
    const updatedOrder = db.prepare("SELECT * FROM tailor_orders WHERE id = ?").get(orderRes.order_id);
    assert(updatedOrder.status === 'delivered', 'Order status is delivered');
    assert(updatedOrder.balance_due === 0, 'Order balance_due is 0');
    assert(updatedOrder.deposit_paid === 500, 'Order deposit_paid updated to total_amount (500)');

    // Check ledger entries (Dr 1111 300, Cr 1200 300)
    const ledgerEntries = db.prepare("SELECT * FROM ledger_entries WHERE reference = ?").all(`سداد رصيد استلام طلب خياطة #${orderRes.order_id}`);
    assert(ledgerEntries.length === 2, 'Two balanced ledger entries posted');
    const drEntry = ledgerEntries.find(e => e.account_code === 1111);
    const crEntry = ledgerEntries.find(e => e.account_code === 1200);
    assert(drEntry && drEntry.debit === 300 && drEntry.credit === 0, 'Dr 1111 Cash in Hand debited 300');
    assert(crEntry && crEntry.credit === 300 && crEntry.debit === 0, 'Cr 1200 Accounts Receivable credited 300');

    // Check account balances
    const finalCash = db.prepare("SELECT balance FROM accounts WHERE account_code = 1111").get()?.balance || 0;
    const finalAR = db.prepare("SELECT balance FROM accounts WHERE account_code = 1200").get()?.balance || 0;
    assert(finalCash === initialCash + 300, 'Cash account 1111 increased by 300');
    assert(finalAR === initialAR - 300, 'Accounts Receivable 1200 decreased by 300');

    // Check sales record sync if linked
    const saleInvoiceNum = `INV-SYNC-${Date.now()}`;
    dbLogic.saveSale({
        invoice: saleInvoiceNum,
        total: 500,
        subtotal: 434.78,
        tax: 65.22,
        paid: 200,
        payment: 'Cash',
        customer_id: cust.id,
        items: [
            { Name: 'خدمة تفصيل خاصة جديدة', Price: 500, Qty: 1, IsService: true }
        ]
    });
    const linkedOrderRes = dbLogic.createTailorOrder({
        customer_id: cust.id,
        sale_invoice_id: saleInvoiceNum,
        total_amount: 500,
        deposit_paid: 200,
        balance_due: 300,
        garments: [
            { garment_type: 'thobe', measurements: { length: 58, sleeve: 24 } }
        ]
    });
    dbLogic.completeTailorOrder({
        order_id: linkedOrderRes.order_id,
        payment_method: 'cash',
        balance_paid: 300
    });
    const syncedSale = db.prepare("SELECT * FROM sales WHERE invoice = ?").get(saleInvoiceNum);
    assert(syncedSale.paid === 500, 'Linked sales invoice paid amount updated to 500');
    assert(syncedSale.status === 'paid', 'Linked sales invoice status updated to paid');

    // Verify partial deposit journal entry in saveSale
    const jeLines = db.prepare(`
        SELECT l.* FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        WHERE e.reference_no = ?
    `).all(`SAL-${saleInvoiceNum}`);
    const cashJe = jeLines.find(l => l.account_code === 1111);
    const arJe = jeLines.find(l => l.account_code === 1200);
    assert(cashJe && cashJe.debit_halala === 20000, 'saveSale debited only actual deposit (200 SAR) to cash 1111');
    assert(arJe && arJe.debit_halala === 30000, 'saveSale debited remaining balance (300 SAR) to AR 1200');

    // -------------------------------------------------------------
    // Test 3: Cutter & Tailor Payroll Calculation & SQL Bug Fix
    // -------------------------------------------------------------
    console.log('\n--- 3. Tailor & Cutter Payroll Calculation ---');
    // Create Tailor and Cutter staff
    const tailor = dbLogic.addStaff({ name: 'المعلم كمال', pin: '555555', role: 'tailor', piece_rate: 40 });
    const cutter = dbLogic.addStaff({ name: 'الفصال حميد', pin: '666666', role: 'cutter', cutter_piece_rate: 25 });

    // Create an urgent order with assigned tailor and cutter
    const urgentOrderRes = dbLogic.createTailorOrder({
        customer_id: cust.id,
        total_amount: 350,
        deposit_paid: 350,
        balance_due: 0,
        is_urgent: 1,
        urgent_fee: 20,
        garments: [
            {
                garment_type: 'thobe',
                assigned_tailor_id: tailor.id,
                assigned_cutter_id: cutter.id,
                measurements: { length: 56, sleeve: 23 }
            }
        ]
    });

    const garment = db.prepare("SELECT * FROM tailor_order_garments WHERE tailor_order_id = ?").get(urgentOrderRes.order_id);
    assert(garment.assigned_tailor_id === tailor.id, 'Garment correctly assigned to tailor');
    assert(garment.assigned_cutter_id === cutter.id, 'Garment correctly assigned to cutter');

    // Move garment to ready stage
    dbLogic.updateGarmentStage({ garment_id: garment.id, stage: 'ready' });

    // Run tailor payroll query (verifies rush_order SQL crash is completely gone!)
    const tailorPayroll = dbLogic.getTailorPayroll();
    assert(Array.isArray(tailorPayroll), 'getTailorPayroll executes cleanly without SQL errors');
    const tailorRow = tailorPayroll.find(r => r.assigned_tailor_id === tailor.id);
    assert(tailorRow !== undefined, 'Tailor appears in payroll');
    assert(tailorRow.pieces_completed === 1, 'Tailor completed 1 piece');
    assert(tailorRow.base_commission === 40, 'Tailor base commission is 40 SAR');
    assert(tailorRow.bonuses === 20, 'Tailor urgent bonus is 20 SAR');
    assert(tailorRow.total_payout === 60, 'Tailor total payout is 60 SAR');

    // Run cutter payroll query
    const cutterPayroll = dbLogic.getCutterPayroll();
    assert(Array.isArray(cutterPayroll), 'getCutterPayroll executes cleanly');
    const cutterRow = cutterPayroll.find(r => r.assigned_cutter_id === cutter.id);
    assert(cutterRow !== undefined, 'Cutter appears in cutter payroll');
    assert(cutterRow.pieces_completed === 1, 'Cutter completed 1 piece');
    assert(cutterRow.base_commission === 25, 'Cutter base commission is 25 SAR');
    assert(cutterRow.total_payout === 30, 'Cutter total payout is 30 SAR (25 base + 5 rush)');

    // Test assignGarmentWorker
    const reassignRes = dbLogic.assignGarmentWorker({ garment_id: garment.id, cutter_id: 1 });
    assert(reassignRes.success === true, 'assignGarmentWorker re-assignment succeeds');

    // -------------------------------------------------------------
    // Test 4: Fabric Roll-Level Inventory Tracking
    // -------------------------------------------------------------
    const prod = dbLogic.addItem({ name: 'قماش ياباني أبيض فاخر - ' + Date.now(), price: 120, is_fabric: 1, length_available: 100 });
    const rollRes = dbLogic.addFabricRoll({
        product_id: prod.id,
        roll_code: 'ROLL-JPN-001',
        dye_lot: 'LOT-2026-A',
        roll_width_inches: 58.0,
        initial_meters: 50.0
    });
    assert(rollRes.success === true, 'Fabric roll added successfully');

    const rolls = dbLogic.getFabricRolls(prod.id);
    assert(rolls.length === 1, 'getFabricRolls retrieved 1 roll');
    assert(rolls[0].roll_code === 'ROLL-JPN-001', 'Roll code matches');
    assert(rolls[0].remaining_meters === 50.0, 'Initial remaining meters is 50.0');

    // Create order consuming 3.2 meters from this roll
    dbLogic.createTailorOrder({
        customer_id: cust.id,
        total_amount: 150,
        deposit_paid: 150,
        balance_due: 0,
        garments: [
            {
                garment_type: 'thobe',
                fabric_id: prod.id,
                fabric_roll_id: rollRes.id,
                fabric_length_used: 3.2
            }
        ]
    });

    const updatedRoll = db.prepare("SELECT * FROM fabric_rolls WHERE id = ?").get(rollRes.id);
    assert(Math.abs(updatedRoll.remaining_meters - 46.8) < 0.001, 'Fabric roll remaining meters decremented to 46.8m');

    // -------------------------------------------------------------
    // Test 5: Customer 9-Digit Phone Search Normalization
    // -------------------------------------------------------------
    console.log('\n--- 5. Customer 9-Digit Phone Search Normalization ---');
    // Customer registered with '0501234567'
    const search9 = dbLogic.getCustomers({ search: '501234567' });
    assert(search9.some(c => c.name === 'سالم الدوسري'), 'Search with 9 digits (501234567) finds customer');

    const searchCountryCode = dbLogic.getCustomers({ search: '966501234567' });
    assert(searchCountryCode.some(c => c.name === 'سالم الدوسري'), 'Search with 966 prefix finds customer');

    // -------------------------------------------------------------
    // Test 6: Baseline Measurement Profile Isolation
    // -------------------------------------------------------------
    console.log('\n--- 6. Baseline Measurement Profile Isolation ---');
    // Save permanent baseline profile
    const originalMeasurements = { length: 58, sleeve: 24, chest: 26, neck: 16 };
    dbLogic.saveTailorProfile(cust.id, 'ثوب', originalMeasurements);

    const baselineBefore = dbLogic.getMeasurementProfiles({ customer_id: cust.id, garment_type: 'ثوب' })[0];
    assert(baselineBefore.measurements.length === 58, 'Baseline length is 58');

    // Place an order with temporary adjustment (e.g. length: 60) and is_temp_adjustment = true
    dbLogic.createTailorOrder({
        customer_id: cust.id,
        total_amount: 200,
        deposit_paid: 200,
        balance_due: 0,
        garments: [
            {
                garment_type: 'ثوب',
                measurements: { length: 60, sleeve: 25, chest: 26, neck: 16 },
                is_temp_adjustment: true
            }
        ]
    });

    // Check that customer baseline profile was NOT altered!
    const baselineAfter = dbLogic.getMeasurementProfiles({ customer_id: cust.id, garment_type: 'ثوب' })[0];
    assert(baselineAfter.measurements.length === 58, 'Customer baseline profile preserved at length 58 (not destroyed by temporary order modification)');

    // -------------------------------------------------------------
    // Test 7: Alteration Ticket with linked_order_id
    // -------------------------------------------------------------
    console.log('\n--- 7. Alteration Ticket with Linked Order ---');
    const altRes = dbLogic.createAlterationTicket({
        customer_id: cust.id,
        linked_order_id: orderRes.order_id,
        total_fee: 45,
        deposit: 45,
        target_delivery_date: '2026-09-18',
        items: [
            { garment_type: 'thobe', instructions: 'تقصير طول الثوب 1 إنش', fee: 45 }
        ]
    });
    assert(altRes.success === true, 'Alteration ticket created');

    const storedAlt = db.prepare("SELECT * FROM alteration_tickets WHERE id = ?").get(altRes.ticket_id);
    assert(storedAlt.linked_order_id === orderRes.order_id, 'Alteration ticket correctly links to tailor_order_id');

    // -------------------------------------------------------------
    // Test 8: Defect Tracking & QC Stage
    // -------------------------------------------------------------
    console.log('\n--- 8. Quality Control Defect Tracking ---');
    // Test updateGarmentStage supports 'qc'
    const qcStageRes = dbLogic.updateGarmentStage({ garment_id: garment.id, stage: 'qc' });
    assert(qcStageRes.success === true, 'updateGarmentStage supports qc stage');

    const defectRes = dbLogic.recordDefect({
        garment_id: garment.id,
        order_id: urgentOrderRes.order_id,
        stage: 'qc',
        defect_type: 'collar_misaligned',
        description: 'الياقة مائلة بـ 1 سم',
        responsible_staff_id: tailor.id,
        severity: 'minor',
        penalty_amount: 15
    });
    assert(defectRes.success === true, 'recordDefect logged flaw successfully');

    const defects = dbLogic.getGarmentDefects(garment.id);
    assert(defects.length === 1, 'getGarmentDefects retrieved 1 defect');
    assert(defects[0].defect_type === 'collar_misaligned', 'Defect type matches');
    assert(defects[0].penalty_amount === 15, 'Penalty amount is 15 SAR');

    console.log('\n====================================================');
    console.log(`Summary: ${passedTests}/${totalTests} tests passed successfully!`);
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
