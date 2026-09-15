const { NlpManager } = require('node-nlp');
const fs = require('fs');
const path = require('path');

async function trainNLP() {
    console.log("Starting NLP Training for Smart Assistant...");
    
    // We use Arabic language configuration
    const manager = new NlpManager({ languages: ['ar'], forceNER: true });
    
    // ----------------------------------------------------------------------
    // T1: Read-Only Intents
    // ----------------------------------------------------------------------
    
    // Sales Insights
    manager.addDocument('ar', 'كم المبيعات اليوم', 'db:getFinancialReport');
    manager.addDocument('ar', 'كم مبيعات اليوم', 'db:getFinancialReport');
    manager.addDocument('ar', 'ارباح اليوم كم', 'db:getFinancialReport');
    manager.addDocument('ar', 'الارباح', 'db:getFinancialReport');
    manager.addDocument('ar', 'المبيعات', 'db:getFinancialReport');
    manager.addDocument('ar', 'تقرير المبيعات', 'db:getFinancialReport');
    manager.addDocument('ar', 'اعطني المبيعات', 'db:getFinancialReport');
    manager.addDocument('ar', 'كم بعنا اليوم', 'db:getFinancialReport');

    // Expenditures List
    manager.addDocument('ar', 'ماهي المصروفات', 'db:getExpenditures');
    manager.addDocument('ar', 'اعرض المصروفات', 'db:getExpenditures');
    manager.addDocument('ar', 'قائمة المصروفات', 'db:getExpenditures');
    manager.addDocument('ar', 'وش المصاريف', 'db:getExpenditures');
    
    // Customers List
    manager.addDocument('ar', 'عرض العملاء', 'db:getCustomers');
    manager.addDocument('ar', 'قائمة العملاء', 'db:getCustomers');
    manager.addDocument('ar', 'من هم العملاء', 'db:getCustomers');
    
    // Menu / Catalog
    manager.addDocument('ar', 'قائمة المنتجات', 'db:getMenu');
    manager.addDocument('ar', 'الاصناف', 'db:getMenu');
    manager.addDocument('ar', 'ماهي الاصناف', 'db:getMenu');

    // Accounting & Insights
    manager.addDocument('ar', 'قائمة الدخل السنوية', 'acct:financialStatement');
    manager.addDocument('ar', 'القوائم المالية', 'acct:financialStatement');
    manager.addDocument('ar', 'التقرير المالي السنوي', 'acct:financialStatement');

    manager.addDocument('ar', 'دفتر الاستاذ العام', 'acct:generalLedger');
    manager.addDocument('ar', 'القيود اليومية', 'acct:generalLedger');
    manager.addDocument('ar', 'المركز المالي', 'acct:generalLedger');

    manager.addDocument('ar', 'الاقرار الضريبي', 'acct:vatReport');
    manager.addDocument('ar', 'تقرير الضريبة', 'acct:vatReport');

    manager.addDocument('ar', 'تحليل البزنس', 'acct:businessInsight');
    manager.addDocument('ar', 'رؤية الاعمال', 'acct:businessInsight');
    manager.addDocument('ar', 'اعطني تقييم للمبيعات', 'acct:businessInsight');
    manager.addDocument('ar', 'تحليل الاداء', 'acct:businessInsight');

    // ----------------------------------------------------------------------
    // T2: Bounded Writes
    // ----------------------------------------------------------------------

    // Add Expense
    manager.addDocument('ar', 'صرفت %amount% ريال على %description%', 'db:addExpenditure');
    manager.addDocument('ar', 'صرفت %amount% على %description%', 'db:addExpenditure');
    manager.addDocument('ar', 'اضف مصروف %amount% ريال %description%', 'db:addExpenditure');
    manager.addDocument('ar', 'سجل مصروف %amount% ريال', 'db:addExpenditure');
    manager.addDocument('ar', 'مصروف %amount% ريال', 'db:addExpenditure');
    manager.addDocument('ar', 'صرفت', 'db:addExpenditure');
    manager.addDocument('ar', 'مصروف', 'db:addExpenditure');
    
    manager.addDocument('ar', 'اضافة عميل جديد اسمه %name%', 'db:addCustomer');
    manager.addDocument('ar', 'سجل عميل جديد', 'db:addCustomer');
    manager.addDocument('ar', 'اضف عميل', 'db:addCustomer');

    // ----------------------------------------------------------------------
    // T3: High-Risk Writes (Requires Confirmation)
    // ----------------------------------------------------------------------

    // Purchase Orders (Drafting via invoice)
    manager.addDocument('ar', 'عندي فاتورة مشتريات', 'processInvoiceAndPO');
    manager.addDocument('ar', 'سجل المشتريات من الفاتورة', 'processInvoiceAndPO');
    manager.addDocument('ar', 'عندي فاتورة', 'processInvoiceAndPO');
    manager.addDocument('ar', 'فاتورة جديدة', 'processInvoiceAndPO');
    manager.addDocument('ar', 'سجل فاتورة', 'processInvoiceAndPO');

    // Void Sale
    manager.addDocument('ar', 'الغاء البيعة رقم %invoiceId%', 'db:voidSale');
    manager.addDocument('ar', 'مرتجع الفاتورة', 'db:voidSale');
    manager.addDocument('ar', 'الغاء الفاتورة', 'db:voidSale');
    manager.addDocument('ar', 'الغاء بيع', 'db:voidSale');

    // Open Shift
    manager.addDocument('ar', 'فتح الوردية', 'shift:open');
    manager.addDocument('ar', 'افتح الوردية', 'shift:open');
    manager.addDocument('ar', 'فتح الصندوق', 'shift:open');
    manager.addDocument('ar', 'بدء الدوام', 'shift:open');

    // Close Shift
    manager.addDocument('ar', 'اغلاق الوردية', 'shift:close');
    manager.addDocument('ar', 'قفل الوردية', 'shift:close');
    manager.addDocument('ar', 'تقفيل الصندوق', 'shift:close');
    manager.addDocument('ar', 'انهاء الدوام', 'shift:close');

    // ----------------------------------------------------------------------
    // General Conversational
    // ----------------------------------------------------------------------
    manager.addDocument('ar', 'مرحبا', 'greetings.hello');
    manager.addDocument('ar', 'السلام عليكم', 'greetings.hello');
    manager.addDocument('ar', 'هلا', 'greetings.hello');
    manager.addDocument('ar', 'كيف حالك', 'greetings.hello');

    manager.addAnswer('ar', 'greetings.hello', 'وعليكم السلام! تفضل، كيف يمكنني مساعدتك؟ يمكنك الاستعلام عن المبيعات، تسجيل مصروف، أو إرفاق فاتورة مشتريات.');
    manager.addAnswer('ar', 'greetings.hello', 'مرحباً بك في المساعد الذكي! أنا جاهز لتلبية أوامرك.');

    // Train and save the model
    await manager.train();
    
    const modelPath = path.join(__dirname, 'model.nlp');
    manager.save(modelPath);
    console.log(`Model trained and saved to ${modelPath}`);
}

// Allow running standalone
if (require.main === module) {
    trainNLP().catch(console.error);
}

module.exports = { trainNLP };
