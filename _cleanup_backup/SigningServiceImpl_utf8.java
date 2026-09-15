/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.gazt.einvoicing.digitalsignature.service.model.DigitalSignature
 *  com.gazt.einvoicing.hashing.generation.service.HashingGenerationService
 *  com.gazt.einvoicing.hashing.generation.service.impl.HashingGenerationServiceImpl
 *  com.gazt.einvoicing.qr.generation.service.QRCodeGeneratorService
 *  com.gazt.einvoicing.qr.generation.service.impl.QRCodeGeneratorServiceImpl
 *  com.gazt.einvoicing.signing.service.SigningService
 *  com.gazt.einvoicing.signing.service.model.InvoiceSigningResult
 *  net.sf.saxon.TransformerFactoryImpl
 *  org.apache.commons.lang3.StringUtils
 *  org.apache.xml.security.c14n.CanonicalizationException
 *  org.apache.xml.security.c14n.InvalidCanonicalizerException
 *  org.bouncycastle.jce.provider.BouncyCastleProvider
 *  org.bouncycastle.openssl.PEMKeyPair
 *  org.bouncycastle.openssl.PEMParser
 *  org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter
 *  org.dom4j.Document
 *  org.dom4j.DocumentException
 *  org.dom4j.DocumentHelper
 *  org.dom4j.Element
 *  org.dom4j.Node
 *  org.dom4j.XPath
 *  org.dom4j.io.SAXReader
 *  org.springframework.core.io.ClassPathResource
 *  org.springframework.stereotype.Service
 */
package com.gazt.einvoicing.signing.service.impl;

import com.gazt.einvoicing.digitalsignature.service.DigitalSignatureService;
import com.gazt.einvoicing.digitalsignature.service.impl.DigitalSignatureServiceImpl;
import com.gazt.einvoicing.digitalsignature.service.model.DigitalSignature;
import com.gazt.einvoicing.hashing.generation.service.HashingGenerationService;
import com.gazt.einvoicing.hashing.generation.service.impl.HashingGenerationServiceImpl;
import com.gazt.einvoicing.qr.generation.service.QRCodeGeneratorService;
import com.gazt.einvoicing.qr.generation.service.impl.QRCodeGeneratorServiceImpl;
import com.gazt.einvoicing.signing.service.SigningService;
import com.gazt.einvoicing.signing.service.model.InvoiceSigningResult;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.Provider;
import java.security.Security;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.chrono.ChronoLocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.logging.Logger;
import java.util.stream.IntStream;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;
import net.sf.saxon.TransformerFactoryImpl;
import org.apache.commons.lang3.StringUtils;
import org.apache.xml.security.c14n.CanonicalizationException;
import org.apache.xml.security.c14n.InvalidCanonicalizerException;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.DocumentHelper;
import org.dom4j.Element;
import org.dom4j.Node;
import org.dom4j.XPath;
import org.dom4j.io.SAXReader;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.xml.sax.SAXException;

@Service
public class SigningServiceImpl
implements SigningService {
    static final Logger LOGGER = Logger.getLogger(SigningServiceImpl.class.getName());
    static final TransformerFactory transformerFactory = new TransformerFactoryImpl();
    private DateTimeFormatter dateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
    private QRCodeGeneratorService qrCodeGeneratorService = new QRCodeGeneratorServiceImpl();
    private DigitalSignatureService digitalSignatureService = new DigitalSignatureServiceImpl();
    private HashingGenerationService hashingGenerationServiceImpl = new HashingGenerationServiceImpl();

    public InvoiceSigningResult signDocument(String xmlDocument, InputStream privateKeyFile, InputStream certificatePublicKeyFile, String password) throws IOException, DocumentException, CertificateException, NoSuchAlgorithmException, TransformerException, SAXException {
        String privateKeyString = "-----BEGIN EC PRIVATE KEY-----\n" + new String(privateKeyFile.readAllBytes(), StandardCharsets.UTF_8).replace("\n", "").replace("\t", "") + "\n-----END EC PRIVATE KEY-----";
        InputStreamReader rdr = new InputStreamReader(new ByteArrayInputStream(privateKeyString.getBytes(StandardCharsets.UTF_8)));
        Object parsed = new PEMParser((Reader)rdr).readObject();
        KeyPair pair = new JcaPEMKeyConverter().getKeyPair((PEMKeyPair)parsed);
        PrivateKey privateKey = pair.getPrivate();
        String certificateAsString = new String(certificatePublicKeyFile.readAllBytes());
        return this.signDocument(xmlDocument, privateKey, certificateAsString, password);
    }

    public String generateInvoiceHash(String xmlDocument) throws InvalidCanonicalizerException, CanonicalizationException, ParserConfigurationException, IOException, TransformerException, SAXException {
        return this.hashingGenerationServiceImpl.getInvoiceHash(xmlDocument);
    }

    public InvoiceSigningResult signDocument(String xmlDocument, PrivateKey privateKey, String certificateAsString, String password) throws IOException, TransformerException, DocumentException, SAXException, NoSuchAlgorithmException, CertificateException {
        X509Certificate certificate;
        String certificateCopy;
        if (!xmlDocument.contains("xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\"")) {
            xmlDocument = xmlDocument.replace("xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\"", "xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\" xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\"");
        }
        String invoiceHash = null;
        try {
            invoiceHash = this.hashingGenerationServiceImpl.getInvoiceHash(xmlDocument);
        }
        catch (Exception e) {
            throw new NullPointerException("unable to generate hash for the provided invoice xml document - " + e.getMessage());
        }
        InvoiceSigningResult invoiceSigningResult = new InvoiceSigningResult();
        invoiceSigningResult.setInvoiceHash(invoiceHash);
        Security.addProvider((Provider)new BouncyCastleProvider());
        byte[] certificateBytes = certificateAsString.getBytes(StandardCharsets.UTF_8);
        try (ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(Base64.getDecoder().decode(certificateBytes));){
            byte[] certificateBytesCopy = Arrays.copyOf(certificateBytes, certificateBytes.length);
            certificateCopy = new String(certificateBytesCopy);
            CertificateFactory certificatefactory = CertificateFactory.getInstance("X.509");
            certificate = (X509Certificate)certificatefactory.generateCertificate(byteArrayInputStream);
        }
        catch (Exception e) {
            throw new DocumentException("unable to decode the provided invoice xml document");
        }
        DigitalSignature digitalSignature = null;
        try {
            digitalSignature = this.digitalSignatureService.getDigitalSignature(xmlDocument, privateKey, invoiceHash);
        }
        catch (Exception e) {
            throw new DocumentException("unable to sign the provided invoice xml document - " + e.getMessage());
        }
        xmlDocument = this.transformXML(xmlDocument);
        Document document = this.getXmlDocument(xmlDocument);
        Map<String, String> nameSpacesMap = this.getNameSpacesMap();
        String qrCode = this.getNodeXmlValue(document, nameSpacesMap, "/Invoice/cac:AdditionalDocumentReference[cbc:ID='QR']/cac:Attachment/cbc:EmbeddedDocumentBinaryObject");
        invoiceSigningResult.setIncludesQRCodeAlready(StringUtils.isNotBlank((CharSequence)qrCode));
        String certificateHashing = this.encodeBase64(this.bytesToHex(this.hashStringToBytes(certificateAsString.getBytes(StandardCharsets.UTF_8))).getBytes(StandardCharsets.UTF_8));
        String signedPropertiesHashing = this.populateSignedSignatureProperties(document, nameSpacesMap, certificateHashing, this.getCurrentTimestamp(), certificate.getIssuerDN().getName(), certificate.getSerialNumber().toString());
        this.populateUBLExtensions(document, nameSpacesMap, digitalSignature.getDigitalSignature(), signedPropertiesHashing, this.encodeBase64(digitalSignature.getXmlHashing()), certificateCopy);
        try {
            qrCode = this.populateQRCode(document, nameSpacesMap, certificate, digitalSignature.getDigitalSignature(), invoiceHash);
        }
        catch (Exception e) {
            throw new DocumentException("unable to generate qr code for the provided invoice xml document - " + e.getMessage());
        }
        invoiceSigningResult.setQrCode(qrCode);
        invoiceSigningResult.setSingedXML(document.asXML());
        return invoiceSigningResult;
    }

    private String transformXML(String xmlDocument) throws IOException, TransformerException {
        xmlDocument = this.transformXML(xmlDocument, "removeElements.xsl");
        xmlDocument = this.transformXML(xmlDocument, "addUBLElement.xsl");
        xmlDocument = xmlDocument.replace("UBL-TO-BE-REPLACED", this.getElementFromFile("ubl.xml"));
        xmlDocument = this.transformXML(xmlDocument, "addQRElement.xsl");
        xmlDocument = xmlDocument.replace("QR-TO-BE-REPLACED", this.getElementFromFile("qr.xml"));
        xmlDocument = this.transformXML(xmlDocument, "addSignatureElement.xsl");
        xmlDocument = xmlDocument.replace("SIGN-TO-BE-REPLACED", this.getElementFromFile("signature.xml"));
        return xmlDocument;
    }

    private Map<String, String> getNameSpacesMap() {
        HashMap<String, String> nameSpaces = new HashMap<String, String>();
        nameSpaces.put("cac", "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2");
        nameSpaces.put("cbc", "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2");
        nameSpaces.put("ext", "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2");
        nameSpaces.put("sig", "urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2");
        nameSpaces.put("sac", "urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2");
        nameSpaces.put("sbc", "urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2");
        nameSpaces.put("ds", "http://www.w3.org/2000/09/xmldsig#");
        nameSpaces.put("xades", "http://uri.etsi.org/01903/v1.3.2#");
        return nameSpaces;
    }

    private byte[] hashStringToBytes(byte[] toBeHashed) throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(toBeHashed);
    }

    String encodeBase64(byte[] stringTobBeEncoded) {
        return Base64.getEncoder().encodeToString(stringTobBeEncoded);
    }

    private String populateQRCode(Document document, Map<String, String> nameSpacesMap, X509Certificate certificate, String signature, String hashedXml) throws Exception {
        String timeStamp;
        Comparable<ChronoLocalDateTime<?>> dateTimeFormat;
        String sellerName = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName");
        String vatRegistrationNumber = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID");
        String invoiceTotal = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount");
        String payableAmount = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cac:LegalMonetaryTotal/cbc:PayableAmount");
        String vatTotal = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cac:TaxTotal/cbc:TaxAmount");
        String issueDate = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cbc:IssueDate");
        String issueTime = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cbc:IssueTime");
        if (issueTime.endsWith("Z")) {
            issueTime = issueTime.replace("Z", "");
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
            dateTimeFormat = sdf.parse(issueDate + "T" + issueTime);
            SimpleDateFormat ksaSdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            sdf.setTimeZone(TimeZone.getTimeZone("GMT + 3"));
            timeStamp = ksaSdf.format((Date)dateTimeFormat);
        } else {
            String stringDateTime = issueDate + "T" + issueTime;
            dateTimeFormat = LocalDateTime.parse(stringDateTime);
            timeStamp = this.dateTimeFormatter.format((TemporalAccessor)((Object)dateTimeFormat));
        }
        String invoiceType = this.getNodeXmlTextValue(document, nameSpacesMap, "/Invoice/cbc:InvoiceTypeCode/@name");
        String qrCode = this.qrCodeGeneratorService.generateQrCode(sellerName, vatRegistrationNumber, timeStamp, payableAmount, vatTotal, hashedXml, certificate.getPublicKey().getEncoded(), signature, invoiceType.startsWith("02"), certificate.getSignature());
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/cac:AdditionalDocumentReference[cbc:ID='QR']/cac:Attachment/cbc:EmbeddedDocumentBinaryObject", qrCode);
        return qrCode;
    }

    private void populateUBLExtensions(Document document, Map<String, String> nameSpacesMap, String digitalSignature, String signedPropertiesHashing, String xmlHashing, String certificate) {
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:SignatureValue", digitalSignature);
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:KeyInfo/ds:X509Data/ds:X509Certificate", certificate);
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:SignedInfo/ds:Reference[@URI='#xadesSignedProperties']/ds:DigestValue", signedPropertiesHashing);
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:SignedInfo/ds:Reference[@Id='invoiceSignedData']/ds:DigestValue", xmlHashing);
    }

    private String populateSignedSignatureProperties(Document document, Map<String, String> nameSpacesMap, String publicKeyHashing, String signatureTimestamp, String x509IssuerName, String serialNumber) throws NoSuchAlgorithmException {
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:CertDigest/ds:DigestValue", publicKeyHashing);
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningTime", signatureTimestamp);
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509IssuerName", x509IssuerName);
        this.populateXmlAttributeValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties/xades:SigningCertificate/xades:Cert/xades:IssuerSerial/ds:X509SerialNumber", serialNumber);
        String signedSignatureElement = this.getNodeXmlValue(document, nameSpacesMap, "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties");
        if (signedSignatureElement != null) {
            return this.encodeBase64(this.bytesToHex(this.hashStringToBytes(signedSignatureElement.getBytes(StandardCharsets.UTF_8))).getBytes(StandardCharsets.UTF_8));
        }
        return null;
    }

    private Document populateXmlAttributeValue(Document document, Map<String, String> nameSpaces, String attributeXpath, String newValue) {
        XPath xpath = DocumentHelper.createXPath((String)attributeXpath);
        xpath.setNamespaceURIs(nameSpaces);
        List nodes = xpath.selectNodes((Object)document);
        IntStream.range(0, nodes.size()).mapToObj(i -> (Element)nodes.get(i)).forEach(element -> element.setText(newValue));
        return document;
    }

    private String getNodeXmlValue(Document document, Map<String, String> nameSpaces, String attributeXpath) {
        XPath xpath = DocumentHelper.createXPath((String)attributeXpath);
        xpath.setNamespaceURIs(nameSpaces);
        Node node = xpath.selectSingleNode((Object)document);
        if (node != null) {
            return node.asXML();
        }
        return null;
    }

    private String getNodeXmlTextValue(Document document, Map<String, String> nameSpaces, String attributeXpath) {
        XPath xpath = DocumentHelper.createXPath((String)attributeXpath);
        xpath.setNamespaceURIs(nameSpaces);
        return xpath.selectSingleNode((Object)document).getText();
    }

    private String getCurrentTimestamp() {
        LocalDateTime localDateTime = LocalDateTime.now();
        return this.dateTimeFormatter.format(localDateTime);
    }

    Document getXmlDocument(String xmlDocument) throws SAXException, DocumentException, IOException {
        try (ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(xmlDocument.getBytes(StandardCharsets.UTF_8));){
            SAXReader xmlReader = new SAXReader();
            xmlReader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document doc = xmlReader.read((InputStream)byteArrayInputStream);
            xmlReader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            xmlReader.setFeature("http://xml.org/sax/features/external-general-entities", false);
            xmlReader.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            xmlReader.setFeature("http://xml.org/sax/features/namespaces", true);
            Document document = doc;
            return document;
        }
    }

    private String transformXML(String xmlDocument, String fileName) throws IOException, TransformerException {
        Transformer transformer = this.getXsltTransformer(fileName);
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream();){
            StreamResult xmlOutput = new StreamResult(bos);
            transformer.transform(new StreamSource(new StringReader(xmlDocument)), xmlOutput);
            String string = new String(bos.toByteArray(), StandardCharsets.UTF_8);
            return string;
        }
    }

    private String bytesToHex(byte[] hash) {
        StringBuilder hexString = new StringBuilder(2 * hash.length);
        for (int i = 0; i < hash.length; ++i) {
            String hex = Integer.toHexString(0xFF & hash[i]);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }

    private Transformer getXsltTransformer(String fileName) throws TransformerConfigurationException, IOException {
        try (InputStream inputStream = new ClassPathResource("xslt/" + fileName).getInputStream();){
            Transformer transformer = transformerFactory.newTransformer(new StreamSource(inputStream));
            transformer.setOutputProperty("encoding", "UTF-8");
            transformer.setOutputProperty("indent", "no");
            Transformer transformer2 = transformer;
            return transformer2;
        }
    }

    /*
     * Exception decompiling
     */
    private String getElementFromFile(String fileName) throws IOException {
        /*
         * This method has failed to decompile.  When submitting a bug report, please provide this stack trace, and (if you hold appropriate legal rights) the relevant class file.
         * 
         * org.benf.cfr.reader.util.ConfusedCFRException: Started 2 blocks at once
         *     at org.benf.cfr.reader.bytecode.analysis.opgraph.Op04StructuredStatement.getStartingBlocks(Op04StructuredStatement.java:412)
         *     at org.benf.cfr.reader.bytecode.analysis.opgraph.Op04StructuredStatement.buildNestedBlocks(Op04StructuredStatement.java:487)
         *     at org.benf.cfr.reader.bytecode.analysis.opgraph.Op03SimpleStatement.createInitialStructuredBlock(Op03SimpleStatement.java:736)
         *     at org.benf.cfr.reader.bytecode.CodeAnalyser.getAnalysisInner(CodeAnalyser.java:850)
         *     at org.benf.cfr.reader.bytecode.CodeAnalyser.getAnalysisOrWrapFail(CodeAnalyser.java:278)
         *     at org.benf.cfr.reader.bytecode.CodeAnalyser.getAnalysis(CodeAnalyser.java:201)
         *     at org.benf.cfr.reader.entities.attributes.AttributeCode.analyse(AttributeCode.java:94)
         *     at org.benf.cfr.reader.entities.Method.analyse(Method.java:531)
         *     at org.benf.cfr.reader.entities.ClassFile.analyseMid(ClassFile.java:1055)
         *     at org.benf.cfr.reader.entities.ClassFile.analyseTop(ClassFile.java:942)
         *     at org.benf.cfr.reader.Driver.doClass(Driver.java:84)
         *     at org.benf.cfr.reader.CfrDriverImpl.analyse(CfrDriverImpl.java:78)
         *     at org.benf.cfr.reader.Main.main(Main.java:54)
         */
        throw new IllegalStateException("Decompilation failed");
    }
}
