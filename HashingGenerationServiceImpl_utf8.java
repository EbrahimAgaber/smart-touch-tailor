/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  com.gazt.einvoicing.hashing.generation.service.HashingGenerationService
 *  net.sf.saxon.TransformerFactoryImpl
 *  org.apache.xml.security.Init
 *  org.apache.xml.security.c14n.CanonicalizationException
 *  org.apache.xml.security.c14n.Canonicalizer
 *  org.apache.xml.security.c14n.InvalidCanonicalizerException
 *  org.springframework.core.io.ClassPathResource
 */
package com.gazt.einvoicing.hashing.generation.service.impl;

import com.gazt.einvoicing.hashing.generation.service.HashingGenerationService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;
import net.sf.saxon.TransformerFactoryImpl;
import org.apache.xml.security.Init;
import org.apache.xml.security.c14n.CanonicalizationException;
import org.apache.xml.security.c14n.Canonicalizer;
import org.apache.xml.security.c14n.InvalidCanonicalizerException;
import org.springframework.core.io.ClassPathResource;
import org.xml.sax.SAXException;

public class HashingGenerationServiceImpl
implements HashingGenerationService {
    private static final Logger LOG = Logger.getLogger(HashingGenerationServiceImpl.class.getName());
    private static final TransformerFactory transformerFactory = new TransformerFactoryImpl();

    public String getInvoiceHash(String xmlDocument) throws ParserConfigurationException, TransformerException, IOException, SAXException, InvalidCanonicalizerException, CanonicalizationException {
        try (ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();){
            Transformer transformer = this.getTransformer();
            StreamResult xmlOutput = new StreamResult(byteArrayOutputStream);
            transformer.transform(new StreamSource(new StringReader(xmlDocument)), xmlOutput);
            String canonicalizeXml = this.canonicalizeXml(byteArrayOutputStream.toByteArray());
            if (this.hashStringToBytes(canonicalizeXml) != null) {
                String string = Base64.getEncoder().encodeToString(this.hashStringToBytes(canonicalizeXml));
                return string;
            }
            String string = null;
            return string;
        }
    }

    private String canonicalizeXml(byte[] xmlDocument) throws InvalidCanonicalizerException, CanonicalizationException, ParserConfigurationException, IOException, SAXException {
        Init.init();
        Canonicalizer canon = Canonicalizer.getInstance((String)"http://www.w3.org/2006/12/xml-c14n11");
        return new String(canon.canonicalize(xmlDocument));
    }

    private Transformer getTransformer() throws TransformerConfigurationException, IOException {
        transformerFactory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalDTD", "");
        transformerFactory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalStylesheet", "");
        try (InputStream inputStream = new ClassPathResource("invoice.xsl").getInputStream();){
            Transformer transformer = transformerFactory.newTransformer(new StreamSource(inputStream));
            transformer.setOutputProperty("encoding", "UTF-8");
            transformer.setOutputProperty("indent", "no");
            transformer.setOutputProperty("omit-xml-declaration", "yes");
            Transformer transformer2 = transformer;
            return transformer2;
        }
    }

    private byte[] hashStringToBytes(String input) {
        MessageDigest digest = null;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        }
        catch (NoSuchAlgorithmException e) {
            LOG.log(Level.SEVERE, e.getMessage());
        }
        if (digest != null) {
            return digest.digest(input.getBytes(StandardCharsets.UTF_8));
        }
        return new byte[0];
    }
}
