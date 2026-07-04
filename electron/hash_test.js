const fs = require('fs');
const crypto = require('crypto');

const signingTime = '2026-07-03T00:04:28';
const certHashB64 = 'MDUyODQ4ZTAzNzg5OWM1M2E3YzVjNWQ2ZTdjMDdkY2UzZThjNDBiODFlZDk5MzM3ZDczODQ1NmIzOGM0M2Q4Yw==';
const issuerName = 'CN=eInvoicing';
const serialNumber = '1783024455791';

const dummyEnvelope = `
                                    <xades:SignedProperties Id="xadesSignedProperties">
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
// Mimic DOM4J's exact serialization quirks
signedPropsForHashing = signedPropsForHashing
    .replace('<xades:SignedProperties Id="xadesSignedProperties">', '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')
    .replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
    .replace('<ds:DigestValue>', '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
    .replace('<ds:X509IssuerName>', '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
    .replace('<ds:X509SerialNumber>', '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');

fs.writeFileSync('manual_sp.txt', signedPropsForHashing);
