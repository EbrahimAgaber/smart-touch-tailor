import java.io.*;
import java.security.MessageDigest;
import java.util.Base64;
import javax.xml.parsers.*;
import org.w3c.dom.*;

/**
 * DumpC14N2: Uses com.sun internal C14N directly on the xades:SignedProperties
 * DOM node from a signed XML, with all ancestor namespace context properly included.
 *
 * Tests both Inclusive C14N 1.0 and C14N 1.1, with and without comments.
 *
 * Usage: java DumpC14N2 <signed.xml>
 */
public class DumpC14N2 {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: java DumpC14N2 <signed.xml>");
            System.exit(1);
        }

        // Parse
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        Document doc = dbf.newDocumentBuilder().parse(new FileInputStream(args[0]));

        // Find xades:SignedProperties
        NodeList nl = doc.getElementsByTagNameNS("http://uri.etsi.org/01903/v1.3.2#", "SignedProperties");
        if (nl.getLength() == 0) throw new Exception("No SignedProperties element found");
        Element sp = (Element) nl.item(0);
        System.out.println("SignedProperties node: " + sp.getTagName() + " Id=" + sp.getAttribute("Id"));

        // Use XMLSignatureFactory to canonicalize via Transform.transform(XMLStructure, ...)
        // This properly handles the subtree with ancestor namespaces
        javax.xml.crypto.dsig.XMLSignatureFactory fac =
            javax.xml.crypto.dsig.XMLSignatureFactory.getInstance("DOM");

        String[] algos = {
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",              // C14N 1.0 no comments
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments", // C14N 1.0 with comments
            "http://www.w3.org/2006/12/xml-c14n11",                          // C14N 1.1 no comments
            "http://www.w3.org/2006/12/xml-c14n11#WithComments",             // C14N 1.1 with comments
        };
        String[] names = {"C14N-1.0-NoComments", "C14N-1.0-WithComments", "C14N-1.1-NoComments", "C14N-1.1-WithComments"};

        for (int i = 0; i < algos.length; i++) {
            System.out.println("\n========== " + names[i] + " ==========");
            System.out.println("Algorithm: " + algos[i]);
            try {
                javax.xml.crypto.dsig.CanonicalizationMethod cm =
                    fac.newCanonicalizationMethod(algos[i],
                        (javax.xml.crypto.dsig.spec.C14NMethodParameterSpec) null);

                // Use XMLStructure (NodeSetData wrapping the DOM subtree)
                // The transform must be given a NodeSetData to process the subtree with context
                final Element spFinal = sp;
                javax.xml.crypto.NodeSetData nsd = new javax.xml.crypto.NodeSetData() {
                    public java.util.Iterator<Node> iterator() {
                        return subtreeNodes(spFinal).iterator();
                    }
                };

                javax.xml.crypto.Data result = cm.transform(nsd, null);
                byte[] bytes;
                if (result instanceof javax.xml.crypto.OctetStreamData) {
                    InputStream is = ((javax.xml.crypto.OctetStreamData) result).getOctetStream();
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
                    bytes = baos.toByteArray();
                } else {
                    System.out.println("UNEXPECTED result type: " + result.getClass());
                    continue;
                }

                System.out.println("Bytes length: " + bytes.length);
                System.out.println("Content:\n" + new String(bytes, "UTF-8"));

                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(bytes);
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) hex.append(String.format("%02x", b));
                String hexStr = hex.toString();
                System.out.println("SHA-256 raw -> hex: " + hexStr);
                System.out.println("SHA-256 raw -> B64: " + Base64.getEncoder().encodeToString(hash));
                System.out.println("ZATCA B64(hex):     " + Base64.getEncoder().encodeToString(hexStr.getBytes("UTF-8")));

                // Write to file
                String outName = "dump_" + names[i].replace(" ", "_") + ".xml";
                FileOutputStream fos = new FileOutputStream(outName);
                fos.write(bytes);
                fos.close();
                System.out.println("Saved to: " + outName);

            } catch (Exception e) {
                System.out.println("ERROR: " + e.getClass().getSimpleName() + ": " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    static java.util.List<Node> subtreeNodes(Node root) {
        java.util.List<Node> list = new java.util.ArrayList<>();
        collectSubtree(root, list);
        return list;
    }

    static void collectSubtree(Node node, java.util.List<Node> list) {
        list.add(node);
        NamedNodeMap attrs = node.getAttributes();
        if (attrs != null) {
            for (int i = 0; i < attrs.getLength(); i++) list.add(attrs.item(i));
        }
        NodeList children = node.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            collectSubtree(children.item(i), list);
        }
    }
}
