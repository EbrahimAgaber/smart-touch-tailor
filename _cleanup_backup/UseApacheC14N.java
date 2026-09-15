import java.io.*;
import java.security.MessageDigest;
import java.util.Base64;
import javax.xml.parsers.*;
import org.w3c.dom.*;
import org.apache.xml.security.Init;
import org.apache.xml.security.c14n.Canonicalizer;

/**
 * UseApacheC14N: Uses Apache XML Security (Santuario) C14N — the SAME library
 * that ZATCA's SDK JAR uses internally — to canonicalize xades:SignedProperties.
 *
 * Run with the ZATCA SDK JAR on the classpath:
 *   java -cp "zatca-einvoicing-sdk-Java-238-R3.4.8\Apps\zatca-einvoicing-sdk-238-R3.4.8.jar;." UseApacheC14N java_signed3.xml
 */
public class UseApacheC14N {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: java -cp 'sdk.jar;.' UseApacheC14N <signed.xml>");
            System.exit(1);
        }

        // Initialize Apache XML Security
        Init.init();

        // Parse document
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        Document doc = dbf.newDocumentBuilder().parse(new FileInputStream(args[0]));

        // Find xades:SignedProperties
        NodeList nl = doc.getElementsByTagNameNS("http://uri.etsi.org/01903/v1.3.2#", "SignedProperties");
        if (nl.getLength() == 0) throw new Exception("No SignedProperties element found");
        Element sp = (Element) nl.item(0);
        System.out.println("SignedProperties node: " + sp.getTagName() + "  Id=" + sp.getAttribute("Id"));

        // Try all Canonicalizer algorithms
        String[] algos = {
            Canonicalizer.ALGO_ID_C14N_OMIT_COMMENTS,         // http://www.w3.org/TR/2001/REC-xml-c14n-20010315
            Canonicalizer.ALGO_ID_C14N_WITH_COMMENTS,          // http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments
            Canonicalizer.ALGO_ID_C14N_EXCL_OMIT_COMMENTS,    // http://www.w3.org/2001/10/xml-exc-c14n#
            Canonicalizer.ALGO_ID_C14N_EXCL_WITH_COMMENTS,    // http://www.w3.org/2001/10/xml-exc-c14n#WithComments
            Canonicalizer.ALGO_ID_C14N11_OMIT_COMMENTS,       // http://www.w3.org/2006/12/xml-c14n11
            Canonicalizer.ALGO_ID_C14N11_WITH_COMMENTS,       // http://www.w3.org/2006/12/xml-c14n11#WithComments
        };
        String[] names = {
            "C14N-1.0-NoComments",
            "C14N-1.0-WithComments",
            "C14N-Exc-NoComments",
            "C14N-Exc-WithComments",
            "C14N-1.1-NoComments",
            "C14N-1.1-WithComments",
        };

        String targetHex = "61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7";
        System.out.println("\nTarget (Java signed3 recorded): " + targetHex);
        System.out.println("  = ZATCA B64: NjFkZmNjYWFiZjg2YzMwOTAyZDlhMWM3N2I3NDk2OTU4OWY0MDMxZGE0OGU2NDY1OTkyZDllZjlkZjY4YTRmNw==\n");

        for (int i = 0; i < algos.length; i++) {
            System.out.println("---------- " + names[i] + " ----------");
            System.out.println("Algorithm: " + algos[i]);
            try {
                Canonicalizer c14n = Canonicalizer.getInstance(algos[i]);

                // canonicalizeSubtree: canonical form of the subtree rooted at sp,
                // WITH all ancestor in-scope namespace declarations propagated
                byte[] bytes = c14n.canonicalizeSubtree(sp);

                System.out.println("Bytes length: " + bytes.length);
                System.out.println("Content:\n" + new String(bytes, "UTF-8") + "\n");

                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(bytes);
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) hex.append(String.format("%02x", b));
                String hexStr = hex.toString();
                System.out.println("SHA-256 raw -> hex: " + hexStr);
                System.out.println("SHA-256 raw -> B64: " + Base64.getEncoder().encodeToString(hash));
                System.out.println("ZATCA B64(hex):     " + Base64.getEncoder().encodeToString(hexStr.getBytes("UTF-8")));
                System.out.println("MATCHES TARGET:     " + hexStr.equals(targetHex));

                // Write bytes to file
                String outFile = names[i] + "_apache.xml";
                new FileOutputStream(outFile).write(bytes);
                System.out.println("Saved to: " + outFile + "\n");

            } catch (Exception e) {
                System.out.println("ERROR: " + e.getClass().getSimpleName() + ": " + e.getMessage() + "\n");
            }
        }
    }
}
