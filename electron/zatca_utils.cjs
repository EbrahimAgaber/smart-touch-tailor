const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// ZATCA UTILITIES  —  Phase 2  (100% compliant rewrite)
// ─────────────────────────────────────────────────────────────────────────────

function generateUUID() {
    return crypto.randomUUID();
}

function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ── UN/ECE unit code mapping ─────────────────────────────────────────────────
const UNIT_CODE_MAP = {
    'وحدة': 'PCE',  'قطعة': 'PCE',  'piece': 'PCE',  'pce': 'PCE',  'حبة': 'PCE',
    'كجم':  'KGM',  'كيلو': 'KGM',  'kg':    'KGM',  'كيلوجرام': 'KGM',  'كيلوغرام': 'KGM',
    'جرام': 'GRM',  'غرام': 'GRM',  'g':     'GRM',  'gram': 'GRM',
    'لتر':  'LTR',  'liter':'LTR',  'litre':'LTR',  'l':  'LTR',
    'مل':   'MLT',  'ml':   'MLT',
    'متر':  'MTR',  'meter':'MTR',  'm':     'MTR',
    'سم':   'CMT',  'cm':   'CMT',
    'ساعة': 'HUR',  'hour': 'HUR',  'hr':    'HUR',
    'يوم':  'DAY',  'day':  'DAY',
    'خدمة': 'ZZZ',  'service':'ZZZ',
    'طن':   'TNE',  'ton':  'TNE',
    'صندوق':'BX',   'box':  'BX',   'كرتون': 'CT',  'carton': 'CT',
    'حزمة': 'PK',   'pack': 'PK',
    'دزينة':'DZN',  'dozen':'DZN',
};

function resolveUnitCode(unit) {
    if (!unit) return 'PCE';
    const key = String(unit).trim().toLowerCase();
    const result = UNIT_CODE_MAP[key] || UNIT_CODE_MAP[String(unit).trim()];
    // [W-2] Warn on unmapped units so product managers can add them without digging through code.
    if (!result) {
        console.warn(`[ZATCA] UNIT_CODE_MAP: unmapped unit "${unit}", falling back to PCE. Add it to UNIT_CODE_MAP in zatca_utils.cjs.`);
        return 'PCE';
    }
    return result;
}

// ── Tax category helpers ─────────────────────────────────────────────────────
// [C-2] Map tax category to VAT rate and exemption reason
// [W-1] RC (Reverse Charge) added as first-class category with VATEX-SA-RC code.
const TAX_CATEGORY_CONFIG = {
    'S':  { rate: null, /* use passed vatRate */ exemptionCode: null, exemptionReason: null },
    'Z':  { rate: 0,    exemptionCode: 'VATEX-SA-29',  exemptionReason: null },
    'E':  { rate: 0,    exemptionCode: 'VATEX-SA-30',  exemptionReason: null },
    'O':  { rate: 0,    exemptionCode: 'VATEX-SA-OOS', exemptionReason: null },
    // RC: Reverse Charge — tax rate is 0 on the invoice line; buyer self-accounts for VAT.
    'RC': { rate: 0,    exemptionCode: 'VATEX-SA-RC',  exemptionReason: 'Reverse Charge' },
};

// ── Main UBL 2.1 XML generator ───────────────────────────────────────────────
/**
 * Generates a compliant ZATCA UBL 2.1 XML (unsigned).
 *
 * @param {object} invoiceData
 * @param {string}   invoiceData.invoice        Invoice number
 * @param {number}   invoiceData.icv            Integer counter (sequential)
 * @param {string}   invoiceData.timestamp      ISO-8601 datetime
 * @param {number}   invoiceData.total          Tax-inclusive total (SAR)
 * @param {Array}    invoiceData.items          Line items array
 * @param {string}   invoiceData.uuid           UUID v4
 * @param {string}   invoiceData.prevHash       Previous invoice hash (Base64 SHA-256)
 * @param {string}   invoiceData.seller         Business name in Arabic
 * @param {string}   invoiceData.vatNo          15-digit VAT/TIN number
 * @param {string}  [invoiceData.crn]           Commercial Registration Number
 * @param {number}  [invoiceData.vatRate]       Decimal VAT rate e.g. 0.15
 * @param {number}  [invoiceData.discount]      Header-level discount amount (SAR, tax-inclusive)
 * @param {object}  [invoiceData.buyer]         B2B buyer info
 * @param {string}  [invoiceData.typeCode]      388=Tax Invoice, 381=Credit Note, 383=Debit Note
 * @param {string}  [invoiceData.billingRef]    Original invoice ID (required for 381/383)
 * @param {object}  [invoiceData.address]       Seller address
 * @returns {string} Unsigned UBL 2.1 XML
 */
function generateUBL21XML(invoiceData) {
    const {
        invoice, icv, timestamp, total, items = [], uuid,
        prevHash, seller, vatNo, crn,
        vatRate: passedVatRate,
        discount    = 0,
        buyer       = null,
        typeCode    = '388',
        billingRef  = null,
        address     = {},
    } = invoiceData;

    const invoiceSubtype = buyer ? '0100000' : '0200000';
    const vatRate     = (typeof passedVatRate === 'number' && !isNaN(passedVatRate)) ? passedVatRate : 0.15;
    const discountNum = parseFloat(discount || 0);
    const issueDate  = String(timestamp || '').split('T')[0];
    const issueTime  = (String(timestamp || '').split('T')[1] || '00:00:00').split('.')[0];
    const safePrevHash = prevHash || '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';

    // Resolved address fields
    const addr = {
        street:           address.street           || 'شارع الملك فهد',
        building:         address.building         || '1234',
        additional_street: address.additional_street || '',  // [C-5]
        plot_id:          address.plot_id          || '',    // [C-5]
        district:         address.district         || 'العليا',
        city:             address.city             || 'الرياض',
        postal:           address.postal           || '12345',
        country:          address.country          || 'SA',
    };

    const tinNumber = escapeXml(vatNo || '300000000000003');
    const crnNumber = escapeXml(crn || address.crn || vatNo || '300000000000003');

    // ── [C-2] Per-line tax category support & multi-TaxSubtotal ─────────────
    // Group lines by tax category
    const categoryGroups = {}; // { 'S': {taxableAmount, taxAmount}, 'Z': {...}, ... }

    const invoiceLines = items.map((item, idx) => {
        const qty          = Math.abs(item.Qty || item.quantity || 1);
        const unitPrice    = item.Price || item.item_price || 0;
        const lineDiscount = parseFloat(item.discount || item.Discount || 0);
        const lineGross    = parseFloat(((unitPrice * qty) - lineDiscount).toFixed(2));

        // Determine per-line tax category
        const taxCat       = (item.tax_category || item.TaxCategory || 'S').toUpperCase();
        const catConfig    = TAX_CATEGORY_CONFIG[taxCat] || TAX_CATEGORY_CONFIG['S'];
        const lineVatRate  = catConfig.rate !== null ? catConfig.rate : vatRate;

        const lineTax      = parseFloat((lineGross * lineVatRate / (1 + lineVatRate)).toFixed(2));
        const lineNet      = parseFloat((lineGross - lineTax).toFixed(2));
        const unitNet      = parseFloat((unitPrice / (1 + lineVatRate)).toFixed(4));
        const unitCode     = resolveUnitCode(item.Unit || item.unit || 'وحدة');

        // Accumulate into category groups
        if (!categoryGroups[taxCat]) {
            categoryGroups[taxCat] = { taxableAmount: 0, taxAmount: 0, vatRate: lineVatRate, config: catConfig };
        }
        categoryGroups[taxCat].taxableAmount += lineNet;
        categoryGroups[taxCat].taxAmount     += lineTax;

        // Build exemption reason XML if applicable
        const exemptionXml = catConfig.exemptionCode
            ? `\n                    <cbc:TaxExemptionReasonCode>${catConfig.exemptionCode}</cbc:TaxExemptionReasonCode>`
              + (catConfig.exemptionReason ? `\n                    <cbc:TaxExemptionReason>${catConfig.exemptionReason}</cbc:TaxExemptionReason>` : '')
            : '';

        const lineDiscountXml = lineDiscount > 0 ? `
        <cac:AllowanceCharge>
            <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
            <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
            <cbc:Amount currencyID="SAR">${lineDiscount.toFixed(2)}</cbc:Amount>
            <cac:TaxCategory>
                <cbc:ID>${taxCat}</cbc:ID>
                <cbc:Percent>${(lineVatRate * 100).toFixed(0)}</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:AllowanceCharge>` : '';

        return `
    <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${unitCode}">${qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>${lineDiscountXml}
        <cac:Item>
            <cbc:Name>${escapeXml(item.Name || item.item_name || 'صنف')}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${taxCat}</cbc:ID>
                <cbc:Percent>${(lineVatRate * 100).toFixed(0)}</cbc:Percent>${exemptionXml}
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">${unitNet.toFixed(4)}</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="${unitCode}">1</cbc:BaseQuantity>
        </cac:Price>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">${lineTax.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="SAR">${lineNet.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="SAR">${lineTax.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:ID>${taxCat}</cbc:ID>
                    <cbc:Percent>${(lineVatRate * 100).toFixed(0)}</cbc:Percent>${exemptionXml}
                    <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
    </cac:InvoiceLine>`;
    }).join('');

    // ── Build header TaxTotal with one TaxSubtotal per distinct category ──────
    const totalTaxAmount = Object.values(categoryGroups).reduce((s, g) => s + g.taxAmount, 0);
    const totalNetAmount = Object.values(categoryGroups).reduce((s, g) => s + g.taxableAmount, 0);
    const totalInclusive = parseFloat((totalNetAmount + totalTaxAmount).toFixed(2));

    const taxSubtotalsXml = Object.entries(categoryGroups).map(([cat, g]) => {
        const catConfig    = g.config;
        const exemptionXml = catConfig.exemptionCode
            ? `\n            <cbc:TaxExemptionReasonCode>${catConfig.exemptionCode}</cbc:TaxExemptionReasonCode>`
              + (catConfig.exemptionReason ? `\n            <cbc:TaxExemptionReason>${catConfig.exemptionReason}</cbc:TaxExemptionReason>` : '')
            : '';
        return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${g.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${g.taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${cat}</cbc:ID>
                <cbc:Percent>${(g.vatRate * 100).toFixed(0)}</cbc:Percent>${exemptionXml}
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    }).join('');

    // Use passed total if items is empty or sums differ slightly (handles credit notes with pre-computed totals)
    const totalNum = items.length > 0 ? totalInclusive : parseFloat(total || 0);
    const taxTotal = items.length > 0 ? totalTaxAmount : parseFloat((totalNum * vatRate / (1 + vatRate)).toFixed(2));
    const amountNoTax = parseFloat((totalNum - taxTotal).toFixed(2));

    // ── BillingReference ─────────────────────────────────────────────────────
    const billingRefXml = billingRef ? `
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>${escapeXml(billingRef)}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>` : '';

    // ── B2B buyer block ───────────────────────────────────────────────────────
    const buyerXml = buyer ? `
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="TIN">${escapeXml(buyer.vatNo || '')}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${escapeXml(buyer.name || 'عميل')}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(buyer.street || 'شارع')}</cbc:StreetName>
                <cbc:BuildingNumber>${escapeXml(buyer.building || '1234')}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${escapeXml(buyer.district || 'حي')}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(buyer.city || 'الرياض')}</cbc:CityName>
                <cbc:PostalZone>${escapeXml(buyer.postal || '12345')}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${escapeXml(buyer.country || 'SA')}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${escapeXml(buyer.vatNo || '')}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>
        </cac:Party>
    </cac:AccountingCustomerParty>` : '';

    // ── Header-level discount block ───────────────────────────────────────────
    const discountXml = discountNum > 0 ? `
    <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="SAR">${discountNum.toFixed(2)}</cbc:Amount>
        <cac:TaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>${(vatRate * 100).toFixed(0)}</cbc:Percent>
            <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
    </cac:AllowanceCharge>` : '';

    // [C-5] AdditionalStreetName & PlotIdentification
    const additionalStreetXml = addr.additional_street
        ? `\n                <cbc:AdditionalStreetName>${escapeXml(addr.additional_street)}</cbc:AdditionalStreetName>`
        : '';
    const plotIdXml = addr.plot_id
        ? `\n                <cbc:PlotIdentification>${escapeXml(addr.plot_id)}</cbc:PlotIdentification>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <!-- UBLEXTENSIONS_PLACEHOLDER -->
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${escapeXml(invoice)}</cbc:ID>
    <cbc:UUID>${escapeXml(uuid)}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${invoiceSubtype}">${typeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${icv}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${safePrevHash}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <!-- QR_PLACEHOLDER -->
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain"></cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="TIN">${tinNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${crnNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${escapeXml(seller || 'مؤسسة تجارية')}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(addr.street)}</cbc:StreetName>${additionalStreetXml}
                <cbc:BuildingNumber>${escapeXml(addr.building)}</cbc:BuildingNumber>${plotIdXml}
                <cbc:CitySubdivisionName>${escapeXml(addr.district)}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(addr.city)}</cbc:CityName>
                <cbc:PostalZone>${escapeXml(addr.postal)}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${escapeXml(addr.country)}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${tinNumber}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>
        </cac:Party>
    </cac:AccountingSupplierParty>${buyerXml}${billingRefXml}${discountXml}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxTotal.toFixed(2)}</cbc:TaxAmount>${taxSubtotalsXml}
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">${amountNoTax.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">${amountNoTax.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">${totalNum.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">${discountNum.toFixed(2)}</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="SAR">${totalNum.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${invoiceLines}
</Invoice>`.trim();
}

// ── [C-3] Phase 1 TLV QR (5-tag) with BER-TLV length encoding ───────────────
function tlvEncodeFixed(tag, valueBuf) {
    const len = valueBuf.length;
    let lenBuf;
    if (len <= 127) {
        lenBuf = Buffer.from([len]);
    } else if (len <= 255) {
        lenBuf = Buffer.from([0x81, len]);
    } else {
        lenBuf = Buffer.from([0x82, (len >> 8) & 0xFF, len & 0xFF]);
    }
    return Buffer.concat([Buffer.from([tag]), lenBuf, valueBuf]);
}

function generateZatcaTLV(seller, vatNo, timestamp, total, vatAmt) {
    const cleanTime = String(timestamp || '').replace(/\.\d{3}Z$/, 'Z');
    return Buffer.concat([
        tlvEncodeFixed(1, Buffer.from(String(seller || ''), 'utf8')),
        tlvEncodeFixed(2, Buffer.from(String(vatNo  || ''), 'utf8')),
        tlvEncodeFixed(3, Buffer.from(cleanTime, 'utf8')),
        tlvEncodeFixed(4, Buffer.from(parseFloat(total  || 0).toFixed(2), 'utf8')),
        tlvEncodeFixed(5, Buffer.from(parseFloat(vatAmt || 0).toFixed(2), 'utf8')),
    ]).toString('base64');
}

module.exports = {
    generateUUID,
    generateUBL21XML,
    escapeXml,
    generateZatcaTLV,
    generateZatcaTLV9: require('./zatca_phase2.cjs').generateZatcaTLV9, // [GAP-1] Phase 2 re-export
    resolveUnitCode,
};
