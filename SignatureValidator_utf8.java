/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.gazt.einvoicing.hashing.generation.service.HashingGenerationService
 *  com.gazt.einvoicing.hashing.generation.service.impl.HashingGenerationServiceImpl
 *  com.zatca.config.ResourcesPaths
 *  com.zatca.sdk.service.validation.Result
 *  com.zatca.sdk.service.validation.StageEnum
 *  com.zatca.sdk.service.validation.Validator
 *  com.zatca.sdk.util.ECDSAUtil
 *  com.zatca.sdk.util.EcryptionUtils
 *  com.zatca.sdk.util.Utils
 *  org.apache.commons.io.IOUtils
 *  org.apache.log4j.Logger
 */
package com.zatca.sdk.service.validation.signature;

import com.gazt.einvoicing.hashing.generation.service.HashingGenerationService;
import com.gazt.einvoicing.hashing.generation.service.impl.HashingGenerationServiceImpl;
import com.zatca.config.ResourcesPaths;
import com.zatca.sdk.service.validation.Result;
import com.zatca.sdk.service.validation.StageEnum;
import com.zatca.sdk.service.validation.Validator;
import com.zatca.sdk.util.ECDSAUtil;
import com.zatca.sdk.util.EcryptionUtils;
import com.zatca.sdk.util.Utils;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.HashMap;
import org.apache.commons.io.IOUtils;
import org.apache.log4j.Logger;

public class SignatureValidator
implements Validator {
    private static final Logger LOG = Logger.getLogger(SignatureValidator.class);
    private static final String UBL_EXTENSIONS_XPATH = "//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()";
    private static final String UBL_DOCUMENT_SIGNATURES_XPATH = "='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']";
    private static final String SIGNATURE_INFORMATION_XPATH = "//*[local-name()='SignatureInformation']";
    private static final String SIGNATURE_OBJECT_XPATH = "//*[local-name()='Signature']//*[local-name()='Object']";
    private static final String QULIFYING_PROPERTIES_XPATH = "//*[local-name()='QualifyingProperties']//*[local-name()";
    private static final String SIGNED_CERTIFICATE_XPATH = "='SignedProperties']//*[local-name()='SignedSignatureProperties']//*[local-name()='SigningCertificate']";
    private static final String SIGN_PROPERTY_XPATH = "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties";
    private static final HashingGenerationService HASHING_GENERATION_SERVICE = new HashingGenerationServiceImpl();
    private static ResourcesPaths paths = ResourcesPaths.getInstance();

    public Result validate(String in) {
        Result result = new Result();
        result.setStage(StageEnum.SIGNATURE);
        if (Utils.isInvoiceSimplified((String)in)) {
            return this.doValidate(in);
        }
        return result;
    }

    private Result doValidate(String in) {
        Result result = new Result();
        result.setStage(StageEnum.SIGNATURE);
        HashMap<String, String> errors = new HashMap<String, String>();
        HashMap<String, StageEnum> category = new HashMap<String, StageEnum>();
        String certificate = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='KeyInfo']//*[local-name()='X509Data']//*[local-name()='X509Certificate']");
        ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(Base64.getDecoder().decode(certificate.getBytes(StandardCharsets.UTF_8)));
        CertificateFactory certificatefactory = null;
        X509Certificate x509Certificate = null;
        try {
            certificatefactory = CertificateFactory.getInstance("X.509");
            x509Certificate = (X509Certificate)certificatefactory.generateCertificate(byteArrayInputStream);
        }
        catch (CertificateException e) {
            LOG.error((Object)e);
            result.setValid(false);
            errors.put("certificate", "wrong invoiceCertificate  ");
            category.put("certificate", StageEnum.SIGNATURE);
        }
        try {
            String signingCertificateDigestValueCalculated;
            String signingCertificateDigestValue;
            String invoiceSignedDataDigestValue;
            String content = new String(in.getBytes(StandardCharsets.UTF_8));
            String xmlHashing = HASHING_GENERATION_SERVICE.getInvoiceHash(content);
            String signatureValue = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='SignatureValue']");
            if (!ECDSAUtil.verifyECDSA((PublicKey)x509Certificate.getPublicKey(), (String)signatureValue, (byte[])Base64.getDecoder().decode(xmlHashing.getBytes(StandardCharsets.UTF_8)))) {
                result.setValid(false);
                errors.put("signatureValue", "wrong signature Value ");
                category.put("signatureValue", StageEnum.SIGNATURE);
            }
            if (!(invoiceSignedDataDigestValue = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='SignedInfo']//*[local-name()='Reference']//*[local-name()='DigestValue']")).equals(xmlHashing)) {
                LOG.debug((Object)(xmlHashing + "<vs>" + invoiceSignedDataDigestValue));
                result.setValid(false);
                errors.put("invoiceSignedDataDigestValue", "wrong invoice hashing");
                category.put("invoiceSignedDataDigestValue", StageEnum.SIGNATURE);
            }
            String xadesSignedPropertiesDigestValueCalculated = Utils.getNodeXmlValue((String)content, (String)SIGN_PROPERTY_XPATH);
            String xadesSignedPropertiesDigestValue = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='SignedInfo']//*[local-name()='Reference'][2]//*[local-name()='DigestValue']");
            String xadesSignedPropertiesDigestValueHashing = Base64.getEncoder().encodeToString(EcryptionUtils.hashString((String)xadesSignedPropertiesDigestValueCalculated).getBytes(StandardCharsets.UTF_8));
            if (!xadesSignedPropertiesDigestValueHashing.equals(xadesSignedPropertiesDigestValue)) {
                LOG.debug((Object)(xadesSignedPropertiesDigestValueHashing + "<vs>" + invoiceSignedDataDigestValue));
                result.setValid(false);
                errors.put("xadesSignedPropertiesDigestValue", "wrong xadesSignedPropertiesDigestValue  ");
                category.put("xadesSignedPropertiesDigestValue", StageEnum.SIGNATURE);
            }
            if (!(signingCertificateDigestValue = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='Object']//*[local-name()='QualifyingProperties']//*[local-name()='SignedProperties']//*[local-name()='SignedSignatureProperties']//*[local-name()='SigningCertificate']//*[local-name()='Cert']//*[local-name()='CertDigest']//*[local-name()='DigestValue']")).equals(signingCertificateDigestValueCalculated = SignatureValidator.getHashedCertificate(certificate))) {
                LOG.debug((Object)(signingCertificateDigestValue + "<vs>" + signingCertificateDigestValueCalculated));
                result.setValid(false);
                errors.put("signingCertificateDigestValue", "wrong signingCertificateDigestValue  ");
                category.put("signingCertificateDigestValue", StageEnum.SIGNATURE);
            }
            String certificateIssuerName = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='Object']//*[local-name()='QualifyingProperties']//*[local-name()='SignedProperties']//*[local-name()='SignedSignatureProperties']//*[local-name()='SigningCertificate']//*[local-name()='Cert']//*[local-name()='IssuerSerial']//*[local-name()='X509IssuerName']");
            String certIssuerName = this.getX509IssuerName();
            if (!certificateIssuerName.trim().equals(certIssuerName.trim())) {
                LOG.debug((Object)(certificateIssuerName + "<vs>" + certIssuerName));
                result.setValid(false);
                errors.put("X509IssuerName", "wrong X509IssuerName  ");
                category.put("X509IssuerName", StageEnum.SIGNATURE);
            }
            String certSerialNumber = Utils.getNodeContentXpth((String)in, (String)"//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='Object']//*[local-name()='QualifyingProperties']//*[local-name()='SignedProperties']//*[local-name()='SignedSignatureProperties']//*[local-name()='SigningCertificate']//*[local-name()='Cert']//*[local-name()='IssuerSerial']//*[local-name()='X509SerialNumber']");
            BigInteger certificateSerialNumber = this.getX509SerialNumber();
            if (!certificateSerialNumber.equals(new BigInteger(certSerialNumber))) {
                LOG.debug((Object)(certificateSerialNumber + "<vs>" + certSerialNumber));
                result.setValid(false);
                errors.put("X509SerialNumber", "wrong X509SerialNumber  ");
                category.put("X509SerialNumber", StageEnum.SIGNATURE);
            }
        }
        catch (Exception e) {
            result.setValid(false);
            errors.put(e.getClass().getSimpleName(), e.getMessage());
            category.put(e.getClass().getSimpleName(), StageEnum.SIGNATURE);
            LOG.error((Object)("Error : " + e.getMessage()));
        }
        if (result.isValid()) {
            result.setValidSignature(true);
        } else {
            result.setError(errors);
            result.setCategory(category);
        }
        return result;
    }

    public static String getHashedCertificate(String certificate) throws NoSuchAlgorithmException {
        byte[] hashedCert = EcryptionUtils.hashString((byte[])certificate.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(SignatureValidator.bytesToHex(hashedCert).getBytes(StandardCharsets.UTF_8));
    }

    private static X509Certificate getX509Certificate() throws IOException, CertificateException {
        ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(Base64.getDecoder().decode(IOUtils.toString((URI)new File(paths.getCertificatePath()).toURI(), (Charset)StandardCharsets.UTF_8)));
        CertificateFactory certificatefactory = CertificateFactory.getInstance("X.509");
        return (X509Certificate)certificatefactory.generateCertificate(byteArrayInputStream);
    }

    public BigInteger getX509SerialNumber() throws CertificateException, IOException {
        X509Certificate certx509 = SignatureValidator.getX509Certificate();
        return certx509.getSerialNumber();
    }

    public String getX509IssuerName() throws CertificateException, IOException {
        X509Certificate certx509 = SignatureValidator.getX509Certificate();
        return certx509.getIssuerDN().getName();
    }

    private static String bytesToHex(byte[] hash) {
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
}
