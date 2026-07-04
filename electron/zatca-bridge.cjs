const path = require('path');
const os = require('os');
process.env.TEMP_FOLDER = path.join(os.tmpdir(), path.sep);
const { EGS, ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');
const crypto = require('crypto');
const { GENESIS_PIH, GENESIS_ICV } = require('./zatca-constants.cjs');
const { generateUBL21XML } = require('./zatca_utils.cjs');

function getBusinessSettings(db) {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function restoreEGS(device, businessSettings) {
    const egsUnit = {
        uuid: crypto.randomUUID(),
        custom_id: 'POS-001',
        model: 'Smart Touch POS v2',
        CRN_number: businessSettings.crn || '1234567890',
        VAT_name: businessSettings.sellerName || 'Seller',
        VAT_number: businessSettings.vatNumber || '300000000000003',
        branch_name: businessSettings.branchName || 'Main Branch',
        branch_industry: businessSettings.industry || 'Retail',
        location: {
            city: businessSettings.city || 'Riyadh',
            city_subdivision: businessSettings.district || 'District',
            street: businessSettings.street || 'Street',
            plot_identification: businessSettings.buildingNumber || '1234',
            building: businessSettings.buildingNumber || '1234',
            postal_zone: businessSettings.postalCode || '12345'
        }
    };

    const egs = new EGS(egsUnit);
    egs.set({
        private_key: device.private_key,
        csr: device.csr,
        compliance_certificate: device.compliance_csid,
        production_certificate: device.production_csid,
        compliance_api_secret: device.compliance_csid ? 'SET_IF_NEEDED' : undefined // egs relies on this?
    });
    return egs;
}

async function onboardDevice(db, settingsData) {
    const device = db.prepare('SELECT * FROM zatca_device WHERE id = 1').get();
    if (device?.onboarding_complete === 1) {
        throw new Error('Device already onboarded. Revoke first before re-onboarding.');
    }

    const businessSettings = getBusinessSettings(db);
    const otp = settingsData.otp || settingsData.zatcaOTP || businessSettings.zatcaOTP;
    const environment = settingsData.environment || 'sandbox';

    const egsUnit = {
        uuid: crypto.randomUUID(),
        custom_id: `POS-${businessSettings.branch_name || '001'}`,
        model: 'Smart Touch POS v2',
        CRN_number: businessSettings.crn || '1234567890',
        VAT_name: businessSettings.business_name_ar || 'Smart Touch',
        VAT_number: businessSettings.vat_number || '300000000000003',
        branch_name: businessSettings.branch_name || 'Main Branch',
        branch_industry: businessSettings.business_type || 'Retail',
        environment: environment, // Pass the environment to zatca-xml-js
        location: {
            city: businessSettings.address_city || 'Riyadh',
            city_subdivision: businessSettings.address_district || 'District',
            street: businessSettings.address_street || 'Street',
            plot_identification: businessSettings.address_building || '1234',
            building: businessSettings.address_building || '1234',
            postal_zone: businessSettings.address_postal || '12345'
        }
    };

    const egs = new EGS(egsUnit);
    
    // As instructed by the user, ignore old CSR and generate fresh keys
    await egs.generateNewKeysAndCSR(false, 'SmartTouchPOS');

    // Ensure new columns exist on legacy tables
    const safeAlter = (sql) => { try { db.prepare(sql).run(); } catch(e) {} };
    safeAlter(`ALTER TABLE zatca_device ADD COLUMN uuid TEXT`);
    safeAlter(`ALTER TABLE zatca_device ADD COLUMN compliance_secret TEXT`);
    safeAlter(`ALTER TABLE zatca_device ADD COLUMN production_secret TEXT`);
    safeAlter(`ALTER TABLE zatca_device ADD COLUMN cert_expires_at TEXT`);
    safeAlter(`ALTER TABLE zatca_device ADD COLUMN status TEXT`);

    // Persist Private Key immediately before network call so it can be used for manual Sandbox testing
    db.prepare('DELETE FROM zatca_device').run();
    db.prepare(`
        INSERT INTO zatca_device (
            id, uuid, private_key, csr, status
        ) VALUES (1, ?, ?, ?, 'KEY_GENERATED')
    `).run(egs.get().uuid, egs.get().private_key, egs.get().csr);

    try {
        const compliance_rid = await egs.issueComplianceCertificate(otp);
        const deviceData = egs.get();
        
        db.prepare(`
            UPDATE zatca_device 
            SET compliance_csid = ?, compliance_secret = ?, status = 'COMPLIANCE_ISSUED'
            WHERE id = 1
        `).run(deviceData.compliance_certificate, deviceData.compliance_api_secret);
        
        return { success: true, compliance_rid };
    } catch (error) {
        // Log CSR to desktop so user can debug in ZATCA portal
        try {
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const logPath = path.join(os.homedir(), 'Desktop', 'zatca_csr_debug.txt');
            fs.writeFileSync(logPath, '--- CSR PAYLOAD ---\n' + egs.get().csr + '\n\n--- ERROR ---\n' + (error.response ? JSON.stringify(error.response.data) : error.message), 'utf8');
        } catch(e) {}
        throw error;
    }
}

async function runComplianceChecks(db) {
    const device = db.prepare('SELECT * FROM zatca_device WHERE id = 1').get();
    if (!device || !device.compliance_csid) {
        throw new Error('No compliance CSID found. Onboard first.');
    }
    const businessSettings = getBusinessSettings(db);
    const egs = restoreEGS(device, businessSettings);

    const saleData = {
        invoice: 'COMPLIANCE-001',
        timestamp: new Date().toISOString(),
        total: 115,
        uuid: crypto.randomUUID(),
        seller: businessSettings.sellerName || 'Seller',
        vatNo: businessSettings.vatNumber || '300000000000003',
        crn: businessSettings.crn || '1234567890',
        address: {
            street: businessSettings.street || 'Street',
            building: businessSettings.buildingNumber || '1234',
            district: businessSettings.district || 'District',
            city: businessSettings.city || 'Riyadh',
            postal: businessSettings.postalCode || '12345'
        },
        items: [
            {
                item_name: 'Test Item',
                quantity: 1,
                item_price: 100,
                discount: 0,
                tax_category: 'S'
            }
        ]
    };

    const xmlString = generateUBL21XML({
        ...saleData,
        icv: 1,
        prevHash: GENESIS_PIH
    });

    const invoice = new ZATCASimplifiedTaxInvoice({ invoice_xml_str: xmlString });
    const { signed_invoice_string, invoice_hash } = egs.signInvoice(invoice);

    await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash);
    return { success: true };
}

async function issueProductionCSID(db) {
    const device = db.prepare('SELECT * FROM zatca_device WHERE id = 1').get();
    if (!device || !device.compliance_rid) {
        throw new Error('No compliance RID found.');
    }
    const businessSettings = getBusinessSettings(db);
    const egs = restoreEGS(device, businessSettings);

    const production_csid = await egs.issueProductionCertificate(device.compliance_rid);

    db.prepare(`
        UPDATE zatca_device SET production_csid = ?, onboarding_complete = 1 WHERE id = 1
    `).run(production_csid);
    return { success: true, production_csid };
}

function issueZatcaInvoice(db, saleData) {
    const device = db.prepare('SELECT * FROM zatca_device WHERE id = 1').get();
    if (!device || device.onboarding_complete !== 1) {
        throw new Error('ZATCA not onboarded. Invoice cannot be issued.');
    }
    const businessSettings = getBusinessSettings(db);

    const result = db.transaction(() => {
        const last = db.prepare(
            'SELECT icv, invoice_hash FROM zatca_invoices ORDER BY icv DESC LIMIT 1'
        ).get();

        const icv  = last ? last.icv + 1 : GENESIS_ICV;
        const pih  = last ? last.invoice_hash : GENESIS_PIH;

        // Build XML using existing robust generator
        const xmlString = generateUBL21XML({
            ...saleData,
            icv,
            prevHash: pih,
            seller: businessSettings.sellerName,
            vatNo: businessSettings.vatNumber,
            crn: businessSettings.crn,
            address: {
                street: businessSettings.street,
                building: businessSettings.buildingNumber,
                district: businessSettings.district,
                city: businessSettings.city,
                postal: businessSettings.postalCode
            }
        });

        const invoice = new ZATCASimplifiedTaxInvoice({ invoice_xml_str: xmlString });
        const egs = restoreEGS(device, businessSettings);
        
        // Pass production=true if environment is production (or always since we have production_csid)
        const isProduction = device.environment === 'production' || device.environment === 'core';
        const { signed_invoice_string, invoice_hash, qr } = egs.signInvoice(invoice, isProduction);

        const invoiceType = saleData.buyer ? 'standard' : 'simplified';
        const saleUuid = saleData.uuid || crypto.randomUUID();

        db.prepare(`
            INSERT INTO zatca_invoices (icv, invoice_hash, pih, invoice_uuid, invoice_type, submission_status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(icv, invoice_hash, pih, saleUuid, invoiceType);

        return { signed_invoice_string, invoice_hash, icv, invoiceType, qr };
    })();

    // The instruction says "Submit OUTSIDE the transaction"
    return submitToZATCA(db, result, device, businessSettings);
}

async function submitToZATCA(db, invoiceResult, device, businessSettings) {
    const egs = restoreEGS(device, businessSettings);
    let response;
    
    try {
        if (invoiceResult.invoiceType === 'simplified') {
            response = await egs.reportInvoice(
                invoiceResult.signed_invoice_string,
                invoiceResult.invoice_hash
            );
        } else {
            response = await egs.clearInvoice(
                invoiceResult.signed_invoice_string,
                invoiceResult.invoice_hash
            );
        }
    } catch (error) {
        response = { error: error.message, stack: error.stack };
    }

    const status = response?.validationResults?.status === 'PASS' || response?.validationResults?.status === 'WARNING' ? 
        (invoiceResult.invoiceType === 'simplified' ? 'reported' : 'cleared') : 'failed';

    db.prepare(`
        UPDATE zatca_invoices SET submission_status = ?, zatca_response = ? WHERE icv = ?
    `).run(status, JSON.stringify(response), invoiceResult.icv);

    return { status, response, ...invoiceResult };
}

function getOnboardingStatus(db) {
    const device = db.prepare('SELECT environment, onboarding_complete FROM zatca_device WHERE id = 1').get();
    return device || { environment: 'sandbox', onboarding_complete: 0 };
}

module.exports = {
    onboardDevice,
    runComplianceChecks,
    issueProductionCSID,
    issueZatcaInvoice,
    getOnboardingStatus
};
