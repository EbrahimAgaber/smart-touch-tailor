import java.security.MessageDigest;
public class TestC14N {
    public static void main(String[] args) throws Exception {
        String xml = "<xades:SignedProperties xmlns:xades=\"http://uri.etsi.org/01903/v1.3.2#\" Id=\"xadesSignedProperties\">" +
            "<xades:SignedSignatureProperties>" +
            "<xades:SigningTime>2026-07-02T22:01:20</xades:SigningTime>" +
            "<xades:SigningCertificate>" +
            "<xades:Cert>" +
            "<xades:CertDigest>" +
            "<ds:DigestMethod xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" Algorithm=\"http://www.w3.org/2001/04/xmlenc#sha256\"></ds:DigestMethod>" +
            "<ds:DigestValue xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\">ZDMwMmI0MTE1NzVjOTU2NTk4YzVlODhhYmI0ODU2NDUyNTU2YTVhYjhhMDFmN2FjYjk1YTA2OWQ0NjY2MjQ4NQ==</ds:DigestValue>" +
            "</xades:CertDigest>" +
            "<xades:IssuerSerial>" +
            "<ds:X509IssuerName xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\">CN=PRZEINVOICESCA4-CA, DC=extgazt, DC=gov, DC=local</ds:X509IssuerName>" +
            "<ds:X509SerialNumber xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\">379112742831380471835263969587287663520528387</ds:X509SerialNumber>" +
            "</xades:IssuerSerial>" +
            "</xades:Cert>" +
            "</xades:SigningCertificate>" +
            "</xades:SignedSignatureProperties>" +
            "</xades:SignedProperties>";
        
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(xml.getBytes("UTF-8"));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        System.out.println("No-spaces raw hash: " + hex.toString());
    }
}
