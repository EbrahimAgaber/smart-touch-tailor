/**
 * AL-Basma POS - Shadow Accounting Audit Script
 * This script simulates a full business cycle to verify the reliability of 
 * calculations and ledger balancing.
 */

// 1. Setup Test Data
const testProducts = [
  { Name: 'منتج أ (سريع الدوران)', Cost: 50.00, Price: 115.00 }, // 100% markup, VAT incl. (15 SAR VAT)
  { Name: 'خدمة صيانة', Cost: 0, Price: 100.00, IsService: true },
];

// 2. Perform Transactions
// - Sale 1: 1 unit of Product A (Cash)
// - Expenditure 1: Rent 100 SAR (No VAT)
// - Expenditure 2: Electricity 57.50 SAR (Including 7.50 VAT)

async function runAudit() {
  console.log("--- STARTING SHADOW AUDIT ---");
  
  // A. Create Products
  for(const p of testProducts) {
    await window.api.addMenuItem(p);
  }

  // B. Record Sales
  const sale1 = {
    total: 115.00,
    subtotal: 100.00,
    tax: 15.00,
    payment: 'Cash',
    items: [{ ID: 1, Name: 'منتج أ', Price: 115.00, Qty: 1, IsService: false }],
    invoice: 'AUDIT-001'
  };
  await window.api.saveSale(sale1);

  // C. Record Expenditures
  await window.api.addExpenditure({
    amount: 100,
    vat_amount: 0,
    vat_eligible: 0,
    category: 'إيجار',
    description: 'إيجار محل - شهر مايو'
  });

  await window.api.addExpenditure({
    amount: 57.50,
    vat_amount: 7.50,
    vat_eligible: 1,
    category: 'كهرباء',
    description: 'فاتورة كهرباء'
  });

  // D. Record a Return (Credit Note)
  const return1 = {
    invoice: 'CN-AUDIT-001-999',
    total: -115.00,
    subtotal: -100.00,
    tax: -15.00,
    payment: 'Cash',
    items: [{ ID: 1, Name: 'منتج أ', Price: 115.00, Qty: -1, IsService: false }],
    status: 'credit',
    note: 'Audit Return Test'
  };
  await window.api.saveSale(return1);

  // E. Check Ledger Result
  const trialBalance = await window.api.getTrialBalance();
  console.log("Shadow Trial Balance (After Return):", trialBalance);

  /**
   * EXPECTED RESULTS AFTER RETURN:
   * - Cash (1101): -42.50 - 115.00 = -157.50
   * - Revenue (4101): 100.00 - 100.00 = 0
   * - VAT Output (2201): 15.00 - 15.00 = 0
   * - VAT Input (2202): 7.50 (Dr)
   * - COGS (5101): 50.00 - 50.00 = 0
   * - Inventory (1201): -50.00 + 50.00 = 0
   * - Expenses (5201): 100.00 + 50.00 = 150.00 (Dr)
   */
}

console.log("Shadow Audit ready. Run 'runAudit()' in browser console.");
