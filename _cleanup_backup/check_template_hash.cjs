const crypto = require('crypto');

const template = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>SET_SIGN_TIMESTAMP</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">SET_CERTIFICATE_HASH</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">SET_CERTIFICATE_ISSUER</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">SET_CERTIFICATE_SERIAL_NUMBER</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`;

// My values from the previous Fatoora check
const sign_timestamp = "2026-07-01T22:34:34Z";
const certificate_hash = "NRGI0t326EuVSm/P+lZmsOvckHMm3kcdYCCxy1TnId4=";
const certificate_issuer = "CN=PRZEINVOICESCA4-CA, DC=extgazt, DC=gov, DC=local";
const certificate_serial_number = "379112742831380471835263969587287663520528387";

let populated = template;
populated = populated.replace("SET_SIGN_TIMESTAMP", sign_timestamp);
populated = populated.replace("SET_CERTIFICATE_HASH", certificate_hash);
populated = populated.replace("SET_CERTIFICATE_ISSUER", certificate_issuer);
populated = populated.replace("SET_CERTIFICATE_SERIAL_NUMBER", certificate_serial_number);

// Fatoora's SDK Hash for these values (Wait, Fatoora used its own SigningTime so I can't compare the hash, but I can compare the format)
const hashBinaryB64 = crypto.createHash('sha256').update(populated, 'utf8').digest('base64');
const hashHexB64 = Buffer.from(crypto.createHash('sha256').update(populated, 'utf8').digest('hex')).toString('base64');

console.log("TEMPLATE:\n", populated);
console.log("Binary B64:", hashBinaryB64);
console.log("Hex B64:", hashHexB64);
