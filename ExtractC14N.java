import java.io.FileInputStream;
import java.security.MessageDigest;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.w3c.dom.Element;
import java.util.Base64;
import javax.xml.crypto.dsig.Reference;
import javax.xml.crypto.dsig.XMLSignature;
import javax.xml.crypto.dsig.dom.DOMSignContext;
import java.security.PublicKey;
import java.security.Key;
import javax.xml.crypto.KeySelector;
import javax.xml.crypto.KeySelectorResult;
import javax.xml.crypto.XMLCryptoContext;
import javax.xml.crypto.AlgorithmMethod;

public class ExtractC14N {
    public static void main(String[] args) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        Document doc = dbf.newDocumentBuilder().parse(new FileInputStream(args[0]));
        
        NodeList nl = doc.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature");
        if (nl.getLength() == 0) {
            throw new Exception("Cannot find Signature element");
        }
        
        XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");
        
        KeySelector dummyKS = new KeySelector() {
            public KeySelectorResult select(javax.xml.crypto.dsig.keyinfo.KeyInfo keyInfo,
                                            KeySelector.Purpose purpose,
                                            AlgorithmMethod method,
                                            XMLCryptoContext context) {
                return new KeySelectorResult() {
                    public Key getKey() { return null; }
                };
            }
        };
        
        DOMValidateContext valContext = new DOMValidateContext(dummyKS, nl.item(0));
        
        Element spNode = (Element) doc.getElementsByTagNameNS("*", "SignedProperties").item(0);
        if (spNode != null) {
            valContext.setIdAttributeNS(spNode, null, "Id");
        }
        
        valContext.setProperty("javax.xml.crypto.dsig.cacheReference", Boolean.TRUE);
        
        XMLSignature signature = fac.unmarshalXMLSignature(valContext);
        
        // Loop through references
        for (Object refObj : signature.getSignedInfo().getReferences()) {
            Reference ref = (Reference) refObj;
            if ("#xadesSignedProperties".equals(ref.getURI())) {
                System.out.println("Found #xadesSignedProperties Reference!");
                
                // We want to see what gets hashed.
                // The Reference computes digest over the dereferenced and transformed data.
                java.io.InputStream is = ref.getDigestInputStream();
                if (is != null) {
                    byte[] data = new byte[8192];
                    int len = is.read(data);
                    String c14nStr = new String(data, 0, len, "UTF-8");
                    System.out.println("--- C14N OUTPUT ---");
                    System.out.println(c14nStr);
                    System.out.println("--- END C14N ---");
                    
                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] hash = md.digest(c14nStr.getBytes("UTF-8"));
                    StringBuilder hex = new StringBuilder();
                    for (byte b : hash) hex.append(String.format("%02x", b));
                    System.out.println("Raw SHA-256 Hex: " + hex.toString());
                    System.out.println("ZATCA Base64(Hex): " + Base64.getEncoder().encodeToString(hex.toString().getBytes("UTF-8")));
                } else {
                    System.out.println("DigestInputStream is null. Falling back to manual Inclusive C14N (no Transform declared = implicit Inclusive C14N per XMLDSig spec)...");
                    try {
                        // No <ds:Transforms> declared => per XMLDSig §4.3.3.2, same-document fragment ID
                        // references use INCLUSIVE C14N without comments as the implicit transform.
                        javax.xml.crypto.dsig.Transform inc = fac.newTransform(
                            javax.xml.crypto.dsig.CanonicalizationMethod.INCLUSIVE,
                            (javax.xml.crypto.dsig.spec.TransformParameterSpec) null);
                        // Serialize the node subtree to an octet stream via the XMLSerializer approach
                        // Use XMLSignatureFactory's DOM serialization of the subtree
                        java.io.ByteArrayOutputStream nodeBytes = new java.io.ByteArrayOutputStream();
                        javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
                        javax.xml.transform.Transformer transformer = tf.newTransformer();
                        transformer.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "yes");
                        transformer.transform(new javax.xml.transform.dom.DOMSource(spNode), new javax.xml.transform.stream.StreamResult(nodeBytes));
                        java.io.InputStream nodeStream = new java.io.ByteArrayInputStream(nodeBytes.toByteArray());
                        javax.xml.crypto.Data nodeData = new javax.xml.crypto.OctetStreamData(nodeStream);
                        javax.xml.crypto.Data transformedData = inc.transform(nodeData, valContext);
                        java.io.InputStream isC14n;
                        if (transformedData instanceof javax.xml.crypto.OctetStreamData) {
                            isC14n = ((javax.xml.crypto.OctetStreamData) transformedData).getOctetStream();
                        } else {
                            throw new Exception("Unexpected data type: " + transformedData.getClass());
                        }
                        // Read full stream
                        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = isC14n.read(buf)) != -1) baos.write(buf, 0, n);
                        String c14nStr = baos.toString("UTF-8");
                        System.out.println("--- C14N OUTPUT ---");
                        System.out.println(c14nStr);
                        System.out.println("--- END C14N ---");
                        
                        MessageDigest md = MessageDigest.getInstance("SHA-256");
                        byte[] hash = md.digest(c14nStr.getBytes("UTF-8"));
                        StringBuilder hex = new StringBuilder();
                        for (byte b : hash) hex.append(String.format("%02x", b));
                        System.out.println("Raw SHA-256 Hex: " + hex.toString());
                        System.out.println("ZATCA Base64(Hex): " + Base64.getEncoder().encodeToString(hex.toString().getBytes("UTF-8")));

                        boolean refValid = ref.validate(valContext);
                        System.out.println("Reference Validation Result: " + refValid);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                    
                    is = ref.getDigestInputStream();
                    if (is != null) {
                        byte[] data = new byte[8192];
                        int len = is.read(data);
                        String c14nStr = new String(data, 0, len, "UTF-8");
                        System.out.println("--- C14N OUTPUT ---");
                        System.out.println(c14nStr);
                        System.out.println("--- END C14N ---");
                        
                        MessageDigest md = MessageDigest.getInstance("SHA-256");
                        byte[] hash = md.digest(c14nStr.getBytes("UTF-8"));
                        StringBuilder hex = new StringBuilder();
                        for (byte b : hash) hex.append(String.format("%02x", b));
                        System.out.println("Raw SHA-256 Hex: " + hex.toString());
                        System.out.println("ZATCA Base64(Hex): " + Base64.getEncoder().encodeToString(hex.toString().getBytes("UTF-8")));
                    }
                }
            }
        }
    }
}
