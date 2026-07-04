const { EGS } = require('zatca-xml-js');

async function testXMLJSCSR() {
    const egs = new EGS({
        custom_id: 'POS-01',
        model: 'POS',
        CRN_number: '3100000000', // Need 10 digits
        VAT_name: 'Smart Touch',
        VAT_number: '300000000000003',
        location: {
            city: 'Riyadh',
            city_subdivision: 'Riyadh',
            street: 'Riyadh',
            plot_identification: '0000',
            building: '0000',
            postal_zone: '00000'
        },
        branch_name: 'Riyadh',
        branch_industry: 'Retail'
    });
    
    await egs.generateNewKeysAndCSR(false, 'Smart Touch');
    const { csr, private_key } = egs.get();
    console.log('CSR:\n', csr.substring(0, 100));
    console.log('Private Key:\n', private_key.substring(0, 100));
}

testXMLJSCSR().catch(console.error);
