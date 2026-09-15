const fs = require('fs');
const crypto = require('crypto');

const signingTime = '2026-06-25T18:58:49';
const cleanCertBase64 = "MIIBxzCCAW2gAwIBAgIBATAKBggqhkjOPQQDAjBGMRMwEQYKCZImiZPyLGQBGRYDU0ExGDAWBgNVBAoTD1NtYXJ0IFRvdWNoIFBPUzEVMBMGA1UEAxMMVGVzdC1aQVRDQTBBFw0yNjA2MjUxODU4NDlaBw0yNzA2MjUxODU4NDlaMEYxEzARBg0qhkjOPQQDAjBGMRMwEQYKCZImiZPyLGQBGRYDU0ExGDAWBgNVBAoTD1NtYXJ0IFRvdWNoIFBPUzEVMBMGA1UEAxMMVGVzdC1aQVRDQTBBMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEP/rK3L41E0f/22k04B+cZ+Qc2x81+kX5V/L+uH6c0z4UuPZ+B4H4R5N9L6K6U9G5w3L7G0E+E+q+J8S9T0cQDaNMMEowCwYDVR0PBAQDAgeAMB0GA1UdDgQWBBQjQ1QyN6Z6V2K4D8D2V0Q4Q2W2bTAfBgNVHSMEGDAWgBQjQ1QyN6Z6V2K4D8D2V0Q4Q2W2bTAKBggqhkjOPQQDAgNIADBFAiA1Z7Z1c2O1+wZ4L5O6M4J4J4J4J4J4J4J4J4J4J4J4J4AhEA4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J4J";
const issuerName = 'CN=Test-ZATCA, O=Smart Touch POS, C=SA';
const serialNumber = '1';

const certHashHex = crypto.createHash('sha256').update(cleanCertBase64, 'utf8').digest('hex');
const certHashB64 = Buffer.from(certHashHex, 'utf8').toString('base64');

console.log('certHashB64:', certHashB64);

const dummyEnvelope = `                                    <xades:SignedProperties Id="xadesSignedProperties">
                                        <xades:SignedSignatureProperties>
                                            <xades:SigningTime>${signingTime}</xades:SigningTime>
                                            <xades:SigningCertificate>
                                                <xades:Cert>
                                                    <xades:CertDigest>
                                                        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>
                                                        <ds:DigestValue>${certHashB64}</ds:DigestValue>
                                                    </xades:CertDigest>
                                                    <xades:IssuerSerial>
                                                        <ds:X509IssuerName>${issuerName}</ds:X509IssuerName>
                                                        <ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>
                                                    </xades:IssuerSerial>
                                                </xades:Cert>
                                            </xades:SigningCertificate>
                                        </xades:SignedSignatureProperties>
                                    </xades:SignedProperties>
`;

let signedPropsForHashing = dummyEnvelope.substring(
    dummyEnvelope.indexOf('<xades:SignedProperties Id="xadesSignedProperties">'),
    dummyEnvelope.indexOf('</xades:SignedProperties>') + '</xades:SignedProperties>'.length
);

signedPropsForHashing = signedPropsForHashing
    .replace('<xades:SignedProperties Id="xadesSignedProperties">', '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')
    .replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
    .replace('<ds:DigestValue>', '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
    .replace('<ds:X509IssuerName>', '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
    .replace('<ds:X509SerialNumber>', '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');

const spHashHex = crypto.createHash('sha256').update(signedPropsForHashing, 'utf8').digest('hex');
const signedPropsHashB64 = Buffer.from(spHashHex).toString('base64');
console.log('MY HASH B64:', signedPropsHashB64);
console.log('STRING HASHED:');
console.log(signedPropsForHashing);
