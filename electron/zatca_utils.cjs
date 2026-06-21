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
    'درزن':'DZN',  'dozen':'DZN',
};

function resolveUnitCode(unit) {
    if (!unit) return 'PCE';
    const key = String(unit).trim().toLowerCase();
    const result = UNIT_CODE_MAP[key] || UNIT_CODE_MAP[String(unit).trim()];
    if (!result) {
        console.warn(`[ZATCA] UNIT_CODE_MAP: unmapped unit "${unit}", falling back to PCE. Add it to UNIT_CODE_MAP in zatca_utils.cjs.`);
        return 'PCE';
    }
    return result;
}

// ── Tax category helpers ─────────────────────────────────────────────────────
const TAX_CATEGORY_CONFIG = {
    'S':  { rate: null, exemptionCode: null, exemptionReason: null },
    'Z':  { rate: 0,    exemptionCode: 'VATEX-SA-29',  exemptionReason: 'Zero-rated supply per Article 29 of VAT Regulations' },
    'E':  { rate: 0,    exemptionCode: 'VATEX-SA-30',  exemptionReason: 'Exempt supply per Article 30 of VAT Regulations' },
    'O':  { rate: 0,    exemptionCode: 'VATEX-SA-OOS', exemptionReason: 'Not subject to VAT' },
    'RC': { rate: 0,    exemptionCode: 'VATEX-SA-RC',  exemptionReason: 'Reverse Charge per Article 47 of VAT Regulations' },
};

// ── Main UBL 2.1 XML generator ───────────────────────────────────────────────
/**
 * Generates a compliant ZATCA UBL 2.1 XML (unsigned).
 *
 * @param {object} invoiceData
 * @param {string}  [invoiceData.reason]   Reason for issuance (mandatory for typeCode 381/383, BR-KSA-17)
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
        reason      = null,
    } = invoiceData;

    const invoiceSubtype = buyer ? '0100000' : '0200000';
    const vatRate     = (typeof passedVatRate === 'number' && !isNaN(passedVatRate)) ? passedVatRate : 0.15;
    const discountNum = parseFloat(discount || 0);
    const issueDate  = String(timestamp || '').split('T')[0];
    const issueTime  = (String(timestamp || '').split('T')[1] || '00:00:00').split('.')[0];
    // [FIX-PIH-GENESIS] ZATCA genesis value = Base64(SHA-256("0")), NOT 32 zero bytes.
    const safePrevHash = prevHash || 'X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=';

    // ── [FIX-014] Seller address validation — no placeholder fallbacks ─────────
    const addr = {
        street:            address.street            || '',
        building:          address.building          || '',
        additional_street: address.additional_street || '',
        plot_id:           address.plot_id           || '',
        district:          address.district          || '',
        city:              address.city              || '',
        postal:            address.postal            || '',
        country:           address.country           || 'SA',
    };

    const missingFields = [];
    if (!addr.street)   missingFields.push('الشارع (street)');
    if (!addr.building) missingFields.push('رقم المبنى (building)');
    if (!addr.district) missingFields.push('الحي (district)');
    if (!addr.city)     missingFields.push('المدينة (city)');
    if (!addr.postal)   missingFields.push('الرمز البريدي (postal)');

    if (missingFields.length > 0) {
        throw new Error(`ZATCA_MISSING_ADDRESS: حقول العنوان التالية مطلوبة: ${missingFields.join('، ')}. قم بإعدادها في الإعدادات.`);
    }

    if (!vatNo || !/^3\d{14}$/.test(vatNo)) {
        throw new Error('ZATCA_MISSING_VAT: رقم ضريبة القيمة المضافة (VAT) غير مُعد أو غير صالح. يجب أن يكون 15 رقماً ويبدأ بـ 3. قم بإعداده في الإعدادات قبل إصدار الفواتير.');
    }
    const tinNumber = escapeXml(vatNo);

    // ── [FIX-BR-KSA-F-08/F-13] CRN validation ───────────────────────────────
    const rawCrn = crn || address.crn || '';
    const validCrn = /^\d{10}$/.test(rawCrn) ? rawCrn : null;
    if (rawCrn && !validCrn) {
        console.warn(`[ZATCA] CRN "${rawCrn}" is not a valid 10-digit Saudi CRN — omitting from XML to avoid BR-KSA-F-08.`);
    }
    const crnNumber = validCrn ? escapeXml(validCrn) : null;

    // ── [FIX-5] B2B buyer address hard gate ──────────────────────────────────
    if (buyer) {
        const buyerMissing = [];
        if (!buyer.street  || !String(buyer.street).trim())   buyerMissing.push('street');
        if (!buyer.building|| !String(buyer.building).trim()) buyerMissing.push('building');
        if (!buyer.district|| !String(buyer.district).trim()) buyerMissing.push('district');
        if (!buyer.city    || !String(buyer.city).trim())     buyerMissing.push('city');
        if (!buyer.postal  || !String(buyer.postal).trim())   buyerMissing.push('postal');

        if (buyerMissing.length > 0) {
            throw new Error(
                `ZATCA_MISSING_BUYER_ADDRESS: عنوان المشتري ناقص (${buyerMissing.join(', ')}). ` +
                `يُرجى تحديث بيانات العميل بالعنوان الوطني الكامل قبل إصدار فاتورة B2B.`
            );
        }
    }

    // ── [C-2] Per-line tax category support & multi-TaxSubtotal ─────────────
    const categoryGroups = {};

    const invoiceLines = items.map((item, idx) => {
        const qty          = Math.abs(item.Qty || item.quantity || 1);
        const unitPrice    = item.Price || item.item_price || 0;
        const lineDiscount = parseFloat(item.discount || item.Discount || 0);

        // [FIX-4] Retain full float precision for internal calculations
        const rawLineGross = (unitPrice * qty) - lineDiscount;
        const lineGross    = parseFloat(rawLineGross.toFixed(2));

        // Determine per-line tax category
        const taxCat       = (item.tax_category || item.TaxCategory || 'S').toUpperCase();
        const catConfig    = TAX_CATEGORY_CONFIG[taxCat] || TAX_CATEGORY_CONFIG['S'];
        const lineVatRate  = catConfig.rate !== null ? catConfig.rate : vatRate;

        // [FIX-4] High-precision unit net — full float, NOT pre-truncated
        const rawUnitNet   = unitPrice / (1 + lineVatRate);

        // [FIX-4] Line net derived from high-precision rawUnitNet × qty
        const lineNet      = parseFloat((rawUnitNet * qty).toFixed(2));

        // [FIX-4] Line tax back-derived from calculated lineGross − lineNet
        const lineTax      = parseFloat((lineGross - lineNet).toFixed(2));

        const unitCode     = resolveUnitCode(item.Unit || item.unit || 'وحدة');

        // Accumulate into category groups
        if (!categoryGroups[taxCat]) {
            categoryGroups[taxCat] = { taxableAmount: 0, taxAmount: 0, vatRate: lineVatRate, config: catConfig };
        }
        categoryGroups[taxCat].taxableAmount += lineNet;
        categoryGroups[taxCat].taxAmount     += lineTax;

        // Build exemption reason XML if applicable
        const itemExemptionCode = item.exemption_code || catConfig.exemptionCode;
        const itemExemptionReason = item.exemption_reason || catConfig.exemptionReason;
        const exemptionXml = itemExemptionCode
            ? (itemExemptionReason ? `\n                    <cbc:TaxExemptionReason>${itemExemptionReason}</cbc:TaxExemptionReason>` : '')
              + `\n                    <cbc:TaxExemptionReasonCode>${itemExemptionCode}</cbc:TaxExemptionReasonCode>`
            : '';

        const lineDiscountXml = lineDiscount > 0 ? `
        <cac:AllowanceCharge>
            <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
            <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
            <cbc:Amount currencyID="SAR">${lineDiscount.toFixed(2)}</cbc:Amount>
            <cac:TaxCategory>
                <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${taxCat}</cbc:ID>
                <cbc:Percent>${(lineVatRate * 100).toFixed(2)}</cbc:Percent>
                <cac:TaxScheme><cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:AllowanceCharge>` : '';

        return `
    <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${unitCode}">${qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>${lineDiscountXml}
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">${lineTax.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">${(lineNet + lineTax).toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${escapeXml((item.Name || item.item_name || 'منتج عام').trim())}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${taxCat}</cbc:ID>
                <cbc:Percent>${(lineVatRate * 100).toFixed(2)}</cbc:Percent>${exemptionXml}
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">${rawUnitNet.toFixed(6)}</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="${unitCode}">1</cbc:BaseQuantity>
        </cac:Price>
    </cac:InvoiceLine>`;
    }).join('');

    // ── Build header TaxTotal with one TaxSubtotal per distinct category ──────
    const totalTaxAmount = Object.values(categoryGroups).reduce((s, g) => s + g.taxAmount, 0);
    const totalNetAmount = Object.values(categoryGroups).reduce((s, g) => s + g.taxableAmount, 0);
    const totalInclusive = parseFloat((totalNetAmount + totalTaxAmount).toFixed(2));

    const taxSubtotalsXml = Object.entries(categoryGroups).map(([cat, g]) => {
        const catConfig    = g.config;
        const exemptionXml = catConfig.exemptionCode
            ? (catConfig.exemptionReason ? `\n            <cbc:TaxExemptionReason>${catConfig.exemptionReason}</cbc:TaxExemptionReason>` : '')
              + `\n            <cbc:TaxExemptionReasonCode>${catConfig.exemptionCode}</cbc:TaxExemptionReasonCode>`
            : '';
        return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${g.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${g.taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${cat}</cbc:ID>
                <cbc:Percent>${(g.vatRate * 100).toFixed(2)}</cbc:Percent>${exemptionXml}
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    }).join('');

    const sumOfLinesExtension = parseFloat(totalNetAmount.toFixed(2));
    const taxExclusiveAmount   = parseFloat((sumOfLinesExtension - discountNum).toFixed(2));
    const taxTotal             = parseFloat(totalTaxAmount.toFixed(2));
    const taxInclusiveAmount   = parseFloat((taxExclusiveAmount + taxTotal).toFixed(2));
    const totalNum             = taxInclusiveAmount;

    // ── BillingReference ─────────────────────────────────────────────────────
    const billingRefXml = billingRef ? `
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>${escapeXml(billingRef)}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>` : '';

    // ── [FIX-016] B2B/B2C buyer block ────────────────────────────────────────
    // NOTE: B2B address fields already validated above (FIX-5). No placeholders.
    let buyerXml;
    if (buyer) {
        buyerXml = `
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="TIN">${escapeXml(buyer.vatNo || '')}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${escapeXml(buyer.name || 'عميل')}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(buyer.street)}</cbc:StreetName>
                <cbc:BuildingNumber>${escapeXml(buyer.building)}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${escapeXml(buyer.district)}</cbc:CitySubdivisionName>
                <cbc:CityName>${escapeXml(buyer.city)}</cbc:CityName>
                <cbc:PostalZone>${escapeXml(buyer.postal)}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${escapeXml(buyer.country || 'SA')}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${escapeXml(buyer.vatNo || '')}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(buyer.name || 'عميل')}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>`;
    } else {
        buyerXml = `
    <cac:AccountingCustomerParty />`;
    }

    // ── Delivery block ────────────────────────────────────────────────────────
    const deliveryXml = (buyer || invoiceData.deliveryDate) ? `
    <cac:Delivery>
        <cbc:ActualDeliveryDate>${invoiceData.deliveryDate || issueDate}</cbc:ActualDeliveryDate>
    </cac:Delivery>` : '';

    // ── PaymentMeans — BR-KSA-16 + [FIX-3] InstructionNote for 381/383 ──────
    const PAYMENT_MEANS_MAP = {
        'cash': '10',    'نقدي': '10',
        'card': '48',    'بطاقة': '48',
        'bank': '42',    'تحويل': '42',
        'credit': '30',  'آجل': '30',
        'mixed': '1',    'مختلط': '1',
    };
    const paymentMeansCode = PAYMENT_MEANS_MAP[(invoiceData.paymentMethod || 'cash').toLowerCase()] || '10';

    // [FIX-3] BR-KSA-17: cbc:InstructionNote mandatory for credit/debit notes
    const isCorrectionDoc = typeCode === '381' || typeCode === '383';
    const instructionNoteXml = isCorrectionDoc
        ? `\n        <cbc:InstructionNote>${escapeXml(reason || 'إلغاء أو تعديل الفاتورة الأصلية')}</cbc:InstructionNote>`
        : '';

    const paymentMeansXml = `
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>${paymentMeansCode}</cbc:PaymentMeansCode>${instructionNoteXml}
    </cac:PaymentMeans>`;

    // ── Header-level discount block ───────────────────────────────────────────
    const discountXml = discountNum > 0 ? `
    <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="SAR">${discountNum.toFixed(2)}</cbc:Amount>
        <cac:TaxCategory>
            <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">S</cbc:ID>
            <cbc:Percent>${(vatRate * 100).toFixed(2)}</cbc:Percent>
            <cac:TaxScheme><cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
    </cac:AllowanceCharge>` : '';

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
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2">
                    <sac:SignatureInformation xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                        <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                        <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                        <ext:ExtensionContent/>
                    </sac:SignatureInformation>
                </sig:UBLDocumentSignatures>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
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
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain"></cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethodCode>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethodCode>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${crnNumber ? 'CRN' : 'TIN'}">${crnNumber || tinNumber}</cbc:ID>
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
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(seller || '')}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>${billingRefXml}${buyerXml}${deliveryXml}${paymentMeansXml}${discountXml}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxTotal.toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxTotal.toFixed(2)}</cbc:TaxAmount>${taxSubtotalsXml}
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">${sumOfLinesExtension.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">${taxExclusiveAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">${taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">${discountNum.toFixed(2)}</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="SAR">${taxInclusiveAmount.toFixed(2)}</cbc:PayableAmount>
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
    generateZatcaTLV9: require('./zatca_phase2.cjs').generateZatcaTLV9,
    resolveUnitCode,
};