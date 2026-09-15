const db = require('./database.cjs');
const local_ai = require('./local_ai.cjs');

// Store pending T3 actions
const pendingActions = new Map();

/**
 * Maps the NLP intent to the corresponding action
 */
async function executeIntent(intent, entities, rawText) {
    console.log(`[Assistant] Executing intent: ${intent}`);
    
    try {
        switch (intent) {
            // ---------------------------------------------------------
            // T1: Read-Only Actions
            // ---------------------------------------------------------
            case 'db:getFinancialReport': {
                const today = new Date().toISOString().split('T')[0];
                const report = await db.getFinancialReport({ startDate: today, endDate: today });
                return {
                    status: 'success',
                    message: `مبيعات اليوم تبلغ ${report.totalSales || 0} ريال، وصافي الربح المتوقع هو ${report.netProfit || 0} ريال.`,
                    data: report
                };
            }
            case 'db:getExpenditures': {
                const today = new Date().toISOString().split('T')[0];
                const expenses = await db.getExpenditures({ startDate: today, endDate: today });
                const rows = expenses.rows || [];
                const total = rows.reduce((acc, curr) => acc + (curr.amount || 0), 0);
                return {
                    status: 'success',
                    message: `تم تسجيل ${rows.length} مصروفات اليوم بإجمالي ${total} ريال.`,
                    data: expenses
                };
            }
            case 'db:getCustomers': {
                const customers = await db.getCustomers({});
                return {
                    status: 'success',
                    message: `يوجد لديك ${customers.length} عميل مسجل في النظام.`,
                    data: customers
                };
            }
            case 'db:getMenu': {
                const menu = await db.getMenu();
                return {
                    status: 'success',
                    message: `يوجد لديك ${menu.length} منتج مسجل في النظام.`,
                    data: menu
                };
            }

            // ---------------------------------------------------------
            // T1.5: Accounting Reports & Insights
            // ---------------------------------------------------------
            case 'acct:financialStatement': {
                const year = new Date().getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                const report = await db.getFinancialReport({ startDate, endDate });
                return {
                    status: 'success',
                    message: `التقرير المالي لعام ${year}:\nإجمالي المبيعات: ${report.totalSales || 0} ريال\nإجمالي المصروفات: ${report.expenses || 0} ريال\nصافي الربح: ${report.netProfit || 0} ريال.`,
                    data: report
                };
            }
            case 'acct:generalLedger': {
                const year = new Date().getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                const ledger = await db.getGeneralLedger({ startDate, endDate });
                
                let totalDebit = 0;
                let totalCredit = 0;
                for (const row of ledger) {
                    totalDebit += (row.debit || 0);
                    totalCredit += (row.credit || 0);
                }
                return {
                    status: 'success',
                    message: `تم استرجاع دفتر الأستاذ العام لعام ${year}.\nعدد القيود: ${ledger.length}\nإجمالي المدين: ${totalDebit} ريال\nإجمالي الدائن: ${totalCredit} ريال.`,
                    data: ledger
                };
            }
            case 'acct:vatReport': {
                const year = new Date().getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                const vat = await db.getVATReport({ startDate, endDate });
                return {
                    status: 'success',
                    message: `تقرير الضريبة (VAT) لعام ${year}:\nضريبة المبيعات المحصلة: ${vat.vatOutput || 0} ريال\nضريبة المشتريات المدفوعة: ${vat.vatInput || 0} ريال\nصافي الضريبة المستحقة: ${vat.netVAT || 0} ريال.`,
                    data: vat
                };
            }
            case 'acct:businessInsight': {
                const todayObj = new Date();
                const today = todayObj.toISOString().split('T')[0];
                const yesterdayObj = new Date(todayObj.getTime() - 86400000);
                const yesterday = yesterdayObj.toISOString().split('T')[0];
                
                const reportToday = await db.getFinancialReport({ startDate: today, endDate: today });
                const reportYesterday = await db.getFinancialReport({ startDate: yesterday, endDate: yesterday });
                
                let salesGrowth = 0;
                if (reportYesterday.totalSales > 0) {
                    salesGrowth = (((reportToday.totalSales || 0) - reportYesterday.totalSales) / reportYesterday.totalSales) * 100;
                } else if ((reportToday.totalSales || 0) > 0) {
                    salesGrowth = 100; // Infinite growth from zero
                }
                
                let growthText = 'استقرار في المبيعات.';
                if (salesGrowth > 0) {
                    growthText = `نمو بنسبة ${salesGrowth.toFixed(1)}% 📈 مقارنة بأمس.`;
                } else if (salesGrowth < 0) {
                    growthText = `تراجع بنسبة ${Math.abs(salesGrowth).toFixed(1)}% 📉 مقارنة بأمس.`;
                }

                let topProductText = '';
                if (reportToday.topProducts && reportToday.topProducts.length > 0) {
                    topProductText = `\nأكثر منتج مبيعاً اليوم: ${reportToday.topProducts[0].item_name} (${reportToday.topProducts[0].qtySold} حبة).`;
                }

                return {
                    status: 'success',
                    message: `تحليل أداء البزنس:\nإجمالي مبيعات اليوم: ${reportToday.totalSales || 0} ريال\n${growthText}\nصافي الربح اليوم: ${reportToday.netProfit || 0} ريال${topProductText}\nاستمر في متابعة الأداء!`,
                    data: { today: reportToday, yesterday: reportYesterday }
                };
            }
            
            // ---------------------------------------------------------
            // T2: Bounded Writes
            // ---------------------------------------------------------
            case 'db:addExpenditure': {
                // Extract amount and description from entities or raw text
                let amount = 0;
                let description = 'مصروف عام';
                
                const numberEntity = entities.find(e => e.entity === 'number');
                if (numberEntity) {
                    amount = numberEntity.resolution.value;
                } else {
                    const amountMatch = rawText.match(/\\d+/);
                    if (amountMatch) amount = parseFloat(amountMatch[0]);
                }
                
                // Very basic extraction for description
                if (amount > 0) {
                    const parts = rawText.split(amount.toString());
                    if (parts.length > 1) {
                        description = parts[1].replace(/ريال/g, '').trim();
                    }
                }
                
                if (amount <= 0) {
                    return {
                        status: 'need_info',
                        message: 'كم مبلغ المصروف؟ الرجاء ذكر المبلغ.'
                    };
                }
                
                const data = {
                  supplier_name: 'عبر المساعد الذكي',
                  invoice_ref: `AI-${Date.now()}`,
                  category: 'أخرى',
                  amount: amount,
                  net_amount: amount,
                  vat_amount: 0,
                  vat_eligible: false,
                  date: new Date().toISOString().split('T')[0],
                  description: description || 'مصروف عام',
                  origin: 'assistant' // Audit flag
                };
                
                await db.addExpenditure(data);
                return {
                    status: 'success',
                    message: `تم إضافة مصروف بقيمة ${amount} ريال بنجاح: "${data.description}".`
                };
            }
            case 'db:addCustomer': {
                let name = 'عميل جديد';
                // Try to find names or just use raw text after keyword
                const keywords = ['اسمه', 'باسم', 'العميل'];
                for (const kw of keywords) {
                    if (rawText.includes(kw)) {
                        name = rawText.split(kw)[1].trim();
                        break;
                    }
                }
                await db.addCustomer({ name, phone: '', origin: 'assistant' });
                return {
                    status: 'success',
                    message: `تم إضافة العميل "${name}" بنجاح.`
                };
            }

            // ---------------------------------------------------------
            // T3: High-Risk Writes (Requires Confirmation)
            // ---------------------------------------------------------
            case 'db:voidSale': {
                let invoiceId = null;
                const numberEntity = entities.find(e => e.entity === 'number');
                if (numberEntity) {
                    invoiceId = numberEntity.resolution.value;
                } else {
                    const amountMatch = rawText.match(/\\d+/);
                    if (amountMatch) invoiceId = amountMatch[0];
                }
                
                if (!invoiceId) {
                    return { status: 'need_info', message: 'الرجاء توفير رقم الفاتورة لإلغائها.' };
                }

                const actionId = `action_${Date.now()}`;
                pendingActions.set(actionId, {
                    intent,
                    params: { id: invoiceId, reason: 'إلغاء عبر المساعد الذكي', origin: 'assistant' },
                    description: `هل أنت متأكد من إلغاء الفاتورة رقم ${invoiceId}؟`
                });

                return {
                    status: 'pending_confirmation',
                    actionId,
                    message: `يجب تأكيد العملية: هل أنت متأكد من إلغاء الفاتورة رقم ${invoiceId}؟`
                };
            }
            case 'processInvoiceAndPO': {
                // For this mock, we assume they need to upload a file. 
                // The actual file upload triggers a different flow in UI, but if they just text:
                return {
                    status: 'action_required',
                    message: 'لإضافة مشتريات من فاتورة، الرجاء إرفاق صورة الفاتورة عبر أيقونة المشبك 📎.'
                };
            }

            default:
                if (intent && intent.startsWith('greetings')) {
                    // Handled by NLP.js answer
                    return { status: 'success', message: '' }; 
                }
                return {
                    status: 'unknown',
                    message: 'عذراً، لم أفهم طلبك بدقة. جرب الاستفسار بعبارة أخرى.'
                };
        }
    } catch (e) {
        console.error("Execution error:", e);
        return {
            status: 'error',
            message: `حدث خطأ أثناء التنفيذ: ${e.message}`
        };
    }
}

/**
 * Confirms and executes a pending T3 action
 */
async function confirmAction(actionId) {
    const action = pendingActions.get(actionId);
    if (!action) {
        return { success: false, message: 'عذراً، انتهت صلاحية هذا الإجراء أو تم تنفيذه مسبقاً.' };
    }

    try {
        console.log(`[Assistant] Confirming action: ${action.intent}`);
        if (action.intent === 'db:voidSale') {
            await db.voidSale(action.params);
        }
        // Remove from pending
        pendingActions.delete(actionId);
        return { success: true, message: 'تم تنفيذ الإجراء بنجاح.' };
    } catch (e) {
        console.error("Confirm error:", e);
        return { success: false, message: `فشل التنفيذ: ${e.message}` };
    }
}

/**
 * Cancels a pending T3 action
 */
function cancelAction(actionId) {
    if (pendingActions.has(actionId)) {
        pendingActions.delete(actionId);
        return { success: true, message: 'تم إلغاء الإجراء.' };
    }
    return { success: false, message: 'الإجراء غير موجود.' };
}

module.exports = {
    executeIntent,
    confirmAction,
    cancelAction
};
