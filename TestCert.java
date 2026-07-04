import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.io.File;
import java.nio.file.Files;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TestCert {
    public static void main(String[] args) throws Exception {
        String xml = new String(Files.readAllBytes(new File("ZATCA_INV-ourown_signed.xml").toPath()), StandardCharsets.UTF_8);
        Matcher m = Pattern.compile("<ds:X509Certificate>(.*?)</ds:X509Certificate>", Pattern.DOTALL).matcher(xml);
        if (m.find()) {
            String b64 = m.group(1).trim();
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            X509Certificate cert = (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(Base64.getDecoder().decode(b64)));
            System.out.println("Issuer: " + cert.getIssuerDN().getName());
            System.out.println("Serial: " + cert.getSerialNumber().toString());
        }
    }
}
