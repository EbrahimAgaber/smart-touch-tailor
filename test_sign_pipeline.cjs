const zatca = require('./electron/zatca_phase2_impl.cjs');
const { generateUBL21XML } = require('./electron/zatca_utils.cjs');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

async function run() {
    try {
        console.log("Generating Keys...");
        const keys = zatca.generateDeviceKeyPair();
        
        const finalInfo = {
            env: 'sandbox',
            EGS_SN: '1-SmartTouch|2-POS|3-001',
            UID: '310000000000003',
            title: '1100',
            address: 'Riyadh',
            IND: 'Retail',
            CN: 'ZATCA-EGS',
            OU: 'Head Office',
            O: 'SmartTouch'
        };

        const csrResult = zatca.generateCSR(keys.privateKeyPem, keys.publicKeyPem, finalInfo);
        console.log("Getting Compliance CSID with OTP 123456...");
        const csid = await zatca.getComplianceCSID(csrResult.csrBase64, '123456', 'sandbox');
        
        if (!csid || !csid.binarySecurityToken) {
            throw new Error("Failed to get CSID");
        }

        global.storeDetails = {
            vatNumber: '312345678901233',
            name: 'Test Store',
            address: {
                street: 'Test',
                building: '1234',
                district: 'Test',
                city: 'Riyadh',
                postal: '12345'
            }
        };

        const invoiceData = {
            invoice: {
                id: 'INV001',
                issueDate: '2026-07-02',
                issueTime: '12:00:00'
            },
            uuid: '123e4567-e89b-12d3-a456-426614174000',
            timestamp: '2026-07-02T12:00:00Z',
            prevHash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
            seller: 'Test Store',
            vatNo: '312345678901233',
            address: {
                street: 'Test',
                building: '1234',
                district: 'Test',
                city: 'Riyadh',
                postal: '12345'
            },
            items: [
                { id: '1', name: 'Item 1', quantity: 1, unitPrice: 100, taxPercent: 15 }
            ],
            total: {
                lineExtensionAmount: 100,
                taxExclusiveAmount: 100,
                taxInclusiveAmount: 115,
                taxAmount: 15
            }
        };

        const rawXml = generateUBL21XML(invoiceData);
        fs.writeFileSync('raw_test.xml', rawXml);
        
        const certsDir = path.join(__dirname, 'zatca-einvoicing-sdk-Java-238-R3.4.8', 'Data', 'Certificates');
        let cleanCertBase64 = csid.binarySecurityToken.replace(/\s+/g, '');
        const decodedOnce = Buffer.from(cleanCertBase64, 'base64').toString('utf8');
        if (decodedOnce.startsWith('MII')) {
            cleanCertBase64 = decodedOnce.replace(/\s+/g, '');
        }
        
        // ZATCA Java SDK crashes if cert.pem has BEGIN/END headers! (Throws Illegal base64 character 2d)
        // Write it as pure Base64.
        const certPem = `-----BEGIN CERTIFICATE-----\n${cleanCertBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
        fs.writeFileSync(path.join(certsDir, 'cert.pem'), cleanCertBase64);

        console.log("Signing Invoice (Our Pipeline)...");
        let signedXml = zatca.signInvoiceXML(rawXml, keys.privateKeyPem, csid.binarySecurityToken);
        const qrMatch = signedXml.match(/<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([A-Za-z0-9+/=]*)<\/cbc:EmbeddedDocumentBinaryObject>/);
        if (qrMatch) {
            const certSigMatch = signedXml.match(/<ds:SignatureValue>([A-Za-z0-9+/=]+)<\/ds:SignatureValue>/);
            const pubKeyMatch = keys.publicKeyPem.replace(/-----.*?-----/g, '').replace(/[\r\n]/g, '');
            const invoiceHash = zatca.hashXML(rawXml);
            // Need to mock invoice total/vatAmt since it's hardcoded in my dummy test
            const total = 0;
            const vatAmt = 0;
            // extract certSigB64 and pubKeySpkiB64 using our new helper!
            const certInfo = zatca.extractCertInfo(certPem);
            const tlv = zatca.generateZatcaTLV9(invoiceData.seller, invoiceData.vatNo, invoiceData.timestamp, total, vatAmt, invoiceHash, certSigMatch[1], certInfo.pubKeySpkiB64, certInfo.sigB64);
            signedXml = zatca.injectQRPayload(signedXml, tlv);
        }
        fs.writeFileSync('signed_test.xml', signedXml);

        const privKeyWithoutHeaders = keys.privateKeyPem
            .replace(/-----BEGIN (EC )?PRIVATE KEY-----/g, '')
            .replace(/-----END (EC )?PRIVATE KEY-----/g, '')
            .replace(/[\r\n]/g, '');
        fs.writeFileSync(path.join(certsDir, 'ec-secp256k1-priv-key.pem'), privKeyWithoutHeaders);

        console.log("Signing Invoice (Java SDK)...");
        try {
            const javaSignRes = execSync(`cd zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps && fatoora -sign -invoice ..\\..\\raw_test.xml`, { stdio: 'pipe' });
            // Get output path
            const javaSignedXml = fs.readFileSync('raw_test_signed.xml', 'utf8');
            fs.writeFileSync('java_signed_test.xml', javaSignedXml);
            console.log("Java SDK signed successfully!");
            
            // Validate the Java SDK signed file to see if it passes
            console.log("Running validator on JAVA signed...");
            const javaValRes = execSync(`cd zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps && fatoora -validate -invoice ..\\..\\java_signed_test.xml`, { stdio: 'pipe' });
            console.log(javaValRes.toString());
        } catch(e) {
            console.error("Java Sign/Validate Error", e.message || e.stdout?.toString() || e);
        }

        console.log("Running validator on OUR signed...");
        const out = execSync(`cd zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps && fatoora -validate -invoice ..\\..\\signed_test.xml`, { stdio: 'pipe' });
        console.log(out.toString());

    } catch (err) {
        console.error("Pipeline Error:", err);
    }
}
run();
