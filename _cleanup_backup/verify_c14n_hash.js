const fs = require('fs');
const crypto = require('crypto');

// The second C14N block printed by Java's ref.validate() for java_signed3.xml
// This is what ZATCA's own validation engine actually hashes
const javaC14nStr = `<xades:SignedProperties xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2" xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
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

const h = crypto.createHash('sha256').update(javaC14nStr, 'utf8').digest('hex');
const b64 = Buffer.from(h, 'utf8').toString('base64');
console.log('Hash of Java C14N string:');
console.log('  hex:', h);
console.log('  B64:', b64);
console.log();

// What ZATCA recorded in java_signed3.xml
const recorded = 'NjFkZmNjYWFiZjg2YzMwOTAyZDlhMWM3N2I3NDk2OTU4OWY0MDMxZGE0OGU2NDY1OTkyZDllZjlkZjY4YTRmNw==';
console.log('Recorded in java_signed3.xml:', recorded);
console.log('Match:', b64 === recorded);
console.log();

// What our node_signed_exact.xml records
const nodeXml = fs.readFileSync('node_signed_exact.xml', 'utf8');
const nodeDigestMatch = nodeXml.match(/URI="#xadesSignedProperties"[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/);
const nodeRecorded = nodeDigestMatch ? nodeDigestMatch[1].trim() : 'NOT FOUND';
console.log('Recorded in node_signed_exact.xml:', nodeRecorded);
console.log('Match with computed:', b64 === nodeRecorded);
