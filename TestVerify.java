import java.io.FileInputStream;
import java.security.PublicKey;
import java.security.cert.X509Certificate;
import java.util.Collections;
import javax.xml.crypto.dsig.XMLSignature;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import javax.xml.crypto.KeySelector;
import javax.xml.crypto.KeySelectorResult;
import javax.xml.crypto.XMLCryptoContext;
import javax.xml.crypto.AlgorithmMethod;
import javax.xml.crypto.dsig.keyinfo.KeyInfo;
import javax.xml.crypto.dsig.keyinfo.X509Data;

public class TestVerify {
    public static void main(String[] args) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        Document doc = dbf.newDocumentBuilder().parse(new FileInputStream("java_signed.xml"));

        NodeList nl = doc.getElementsByTagNameNS("http://uri.etsi.org/01903/v1.3.2#", "SignedProperties");
        if (nl.getLength() > 0) {
            org.w3c.dom.Element elem = (org.w3c.dom.Element) nl.item(0);
            elem.setIdAttribute("Id", true);
        }

        NodeList sigNodes = doc.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature");
        if (sigNodes.getLength() == 0) throw new Exception("No signature found");

        DOMValidateContext valContext = new DOMValidateContext(new KeySelector() {
            public KeySelectorResult select(KeyInfo keyInfo, KeySelector.Purpose purpose,
                    AlgorithmMethod method, XMLCryptoContext context) {
                try {
                    for (Object obj : keyInfo.getContent()) {
                        if (obj instanceof X509Data) {
                            X509Certificate cert = (X509Certificate) ((X509Data) obj).getContent().get(0);
                            return () -> cert.getPublicKey();
                        }
                    }
                } catch (Exception e) {}
                return null;
            }
        }, sigNodes.item(0));

        XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");
        XMLSignature signature = fac.unmarshalXMLSignature(valContext);

        boolean coreValidity = signature.validate(valContext);
        System.out.println("Signature core validity: " + coreValidity);

        for (Object refObj : signature.getSignedInfo().getReferences()) {
            javax.xml.crypto.dsig.Reference ref = (javax.xml.crypto.dsig.Reference) refObj;
            boolean refValid = ref.validate(valContext);
            System.out.println("Reference " + ref.getURI() + " validity: " + refValid);
            byte[] calc = ref.getCalculatedDigestValue();
            if (calc != null) {
                StringBuilder hex = new StringBuilder();
                for (byte b : calc) {
                    hex.append(String.format("%02x", b));
                }
                System.out.println("Calculated Digest Hex: " + hex);
            }
        }
    }
}
