import java.io.FileInputStream;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;

public class PrintCertDetails {
    public static void main(String[] args) throws Exception {
        CertificateFactory fac = CertificateFactory.getInstance("X.509");
        X509Certificate cert = (X509Certificate) fac.generateCertificate(new FileInputStream("zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/cert.pem"));
        System.out.println("Issuer: " + cert.getIssuerX500Principal().getName());
        System.out.println("Serial: " + cert.getSerialNumber().toString());
    }
}
