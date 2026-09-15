import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Key;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import javax.xml.crypto.*;
import javax.xml.crypto.dsig.*;
import javax.xml.crypto.dsig.dom.*;
import javax.xml.crypto.dsig.keyinfo.KeyInfo;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;

/**
 * ExtractC14N2: Correctly extract the canonical form of #xadesSignedProperties
 * as hashed by javax.xml.crypto (ZATCA's validator uses this same JCA provider).
 *
 * Strategy: call ref.validate() with a real public key so the JCA machinery
 * actually runs the canonicalization internally and caches the digest stream.
 * Then read it back from getDigestInputStream().
 */
public class ExtractC14N2 {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: java ExtractC14N2 <signed.xml> <cert.pem>");
            System.exit(1);
        }

        // --- Parse document ---
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        Document doc = dbf.newDocumentBuilder().parse(new FileInputStream(args[0]));

        // --- Load certificate to get public key ---
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        // cert.pem may or may not have headers — handle both
        String certContent = new String(new FileInputStream(args[1]).readAllBytes());
        if (!certContent.contains("-----BEGIN CERTIFICATE-----")) {
            certContent = "-----BEGIN CERTIFICATE-----\n" + certContent.trim() + "\n-----END CERTIFICATE-----\n";
        }
        X509Certificate cert = (X509Certificate) cf.generateCertificate(
            new java.io.ByteArrayInputStream(certContent.getBytes("UTF-8")));
        final PublicKey pubKey = cert.getPublicKey();

        // --- Locate Signature element ---
        NodeList nl = doc.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature");
        if (nl.getLength() == 0) throw new Exception("No Signature element found");

        XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");

        // --- Register SignedProperties Id attribute ---
        Element spNode = (Element) doc.getElementsByTagNameNS("*", "SignedProperties").item(0);
        if (spNode == null) throw new Exception("No SignedProperties element found");

        KeySelector ks = new KeySelector() {
            public KeySelectorResult select(KeyInfo ki, Purpose p, AlgorithmMethod m, XMLCryptoContext ctx) {
                return () -> pubKey;
            }
        };

        DOMValidateContext valCtx = new DOMValidateContext(ks, nl.item(0));
        valCtx.setIdAttributeNS(spNode, null, "Id");
        valCtx.setProperty("javax.xml.crypto.dsig.cacheReference", Boolean.TRUE);

        XMLSignature sig = fac.unmarshalXMLSignature(valCtx);

        // --- Call validate to trigger internal C14N and cache the digest stream ---
        // We don't care about the overall result — we want the stream.
        sig.validate(valCtx);

        // --- Now read the cached digest input stream ---
        for (Object o : sig.getSignedInfo().getReferences()) {
            Reference ref = (Reference) o;
            if ("#xadesSignedProperties".equals(ref.getURI())) {
                java.io.InputStream is = ref.getDigestInputStream();
                if (is == null) {
                    System.out.println("ERROR: DigestInputStream still null after validate()");
                    System.exit(1);
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
                byte[] c14nBytes = baos.toByteArray();
                String c14nStr = new String(c14nBytes, "UTF-8");

                System.out.println("=== C14N bytes fed to SHA-256 (length=" + c14nBytes.length + ") ===");
                System.out.println(c14nStr);
                System.out.println("=== END C14N ===");

                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(c14nBytes);
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) hex.append(String.format("%02x", b));
                System.out.println("SHA-256 hex: " + hex);
                System.out.println("ZATCA B64(hex): " + Base64.getEncoder().encodeToString(hex.toString().getBytes("UTF-8")));

                System.out.println("Reference validate() result: " + ref.validate(valCtx));
            }
        }
    }
}
