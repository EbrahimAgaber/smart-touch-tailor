const crypto = require('crypto');
const str = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>2026-07-03T00:04:28</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>
                                                    <ds:DigestValue>MDUyODQ4ZTAzNzg5OWM1M2E3YzVjNWQ2ZTdjMDdkY2UzZThjNDBiODFlZDk5MzM3ZDczODQ1NmIzOGM0M2Q4Yw==</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName>CN=eInvoicing</ds:X509IssuerName>
                                                    <ds:X509SerialNumber>1783024455791</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`;
const hashHex = crypto.createHash('sha256').update(str, 'utf8').digest('hex');
const b64 = Buffer.from(hashHex, 'utf8').toString('base64');
console.log('B64:', b64);
