import java.io.*;
import java.security.MessageDigest;
import java.util.Base64;
import javax.xml.parsers.*;
import javax.xml.transform.*;
import javax.xml.transform.dom.*;
import javax.xml.transform.stream.*;
import org.w3c.dom.*;

/**
 * DumpC14N: Uses JDK's built-in C14N transformer to canonicalize the
 * xades:SignedProperties node from a signed XML file.
 *
 * This uses the exact same JDK Canonicalizer the XMLSignatureFactory uses
 * internally when processing References.
 *
 * Usage: java DumpC14N <signed.xml> <output_prefix>
 *
 * Outputs:
 *   <output_prefix>_c14n10.xml         — Inclusive C14N 1.0 (no comments)
 *   <output_prefix>_c14n10wc.xml       — Inclusive C14N 1.0 with comments
 *   <output_prefix>_c14n11.xml         — Inclusive C14N 1.1 (no comments)
 *   <output_prefix>_c14n11wc.xml       — Inclusive C14N 1.1 with comments
 */
public class DumpC14N {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: java DumpC14N <signed.xml> <output_prefix>");
            System.exit(1);
        }
        String xmlFile = args[0];
        String prefix = args[1];

        // Parse document
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        Document doc = dbf.newDocumentBuilder().parse(new FileInputStream(xmlFile));

        // Find xades:SignedProperties
        NodeList nl = doc.getElementsByTagNameNS("http://uri.etsi.org/01903/v1.3.2#", "SignedProperties");
        if (nl.getLength() == 0) throw new Exception("No SignedProperties element found");
        Element sp = (Element) nl.item(0);
        System.out.println("Found SignedProperties node: " + sp.getTagName());
        System.out.println("  Id attr: " + sp.getAttribute("Id"));

        // Run each C14N variant
        String[] algos = {
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",           // C14N 1.0 no comments
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments", // C14N 1.0 with comments
            "http://www.w3.org/2006/12/xml-c14n11",                       // C14N 1.1 no comments
            "http://www.w3.org/2006/12/xml-c14n11#WithComments",          // C14N 1.1 with comments
        };
        String[] names = {"c14n10", "c14n10wc", "c14n11", "c14n11wc"};

        for (int i = 0; i < algos.length; i++) {
            System.out.println("\n--- Algorithm: " + algos[i] + " ---");
            try {
                byte[] bytes = canonicalize(doc, sp, algos[i]);
                String outFile = prefix + "_" + names[i] + ".xml";
                FileOutputStream fos = new FileOutputStream(outFile);
                fos.write(bytes);
                fos.close();
                System.out.println("Written " + bytes.length + " bytes to " + outFile);

                // Compute hash
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(bytes);
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) hex.append(String.format("%02x", b));
                String hexStr = hex.toString();
                System.out.println("SHA-256 raw bytes -> hex: " + hexStr);
                System.out.println("SHA-256 raw bytes -> B64: " + Base64.getEncoder().encodeToString(hash));
                System.out.println("ZATCA-style B64(hex):     " + Base64.getEncoder().encodeToString(hexStr.getBytes("UTF-8")));
            } catch (Exception e) {
                System.out.println("FAILED: " + e.getMessage());
            }
        }
    }

    static byte[] canonicalize(Document doc, Element element, String algorithm) throws Exception {
        // Use javax.xml.transform with identity transformer first to get the 
        // standalone subtree, then apply C14N via TransformerFactory
        // We use the com.sun.org.apache.xml.internal.security.c14n APIs indirectly
        // through the JDK XMLSignatureFactory which exposes C14N as transforms.

        // The cleanest JDK approach: use javax.xml.crypto.dsig.XMLSignatureFactory
        // to get a CanonicalizationMethod object and apply it to the node
        javax.xml.crypto.dsig.XMLSignatureFactory fac =
            javax.xml.crypto.dsig.XMLSignatureFactory.getInstance("DOM");

        javax.xml.crypto.dsig.CanonicalizationMethod cm =
            fac.newCanonicalizationMethod(algorithm, (javax.xml.crypto.dsig.spec.C14NMethodParameterSpec) null);

        // Create a DOMSubTreeData for the element
        javax.xml.crypto.OctetStreamData data = (javax.xml.crypto.OctetStreamData)
            cm.transform(new javax.xml.crypto.dom.DOMSubTreeData(element, true), null);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        InputStream is = data.getOctetStream();
        while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
        return baos.toByteArray();
    }
}
