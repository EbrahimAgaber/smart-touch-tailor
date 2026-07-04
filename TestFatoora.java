import org.dom4j.Document;
import org.dom4j.DocumentHelper;
import org.dom4j.Node;
import org.dom4j.XPath;
import org.dom4j.io.SAXReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;

public class TestFatoora {
    public static void main(String[] args) throws Exception {
        String xmlDocument = new String(Files.readAllBytes(Paths.get("ZATCA_INV-albasma_signed.xml")), StandardCharsets.UTF_8);
        SAXReader xmlReader = new SAXReader();
        Document document = xmlReader.read((InputStream)new ByteArrayInputStream(xmlDocument.getBytes(StandardCharsets.UTF_8)));
        XPath xpath = DocumentHelper.createXPath("//*[local-name()='SignedProperties']");
        Node node = xpath.selectSingleNode(document);
        if (node != null) {
            String rawStr = node.asXML();
            System.out.println("--- RAW STR ---");
            System.out.println(rawStr);
            System.out.println("---------------");
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(rawStr.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder(2 * hash.length);
            for (int i = 0; i < hash.length; ++i) {
                String hex = Integer.toHexString(0xFF & hash[i]);
                if (hex.length() == 1) { hexString.append('0'); }
                hexString.append(hex);
            }
            String b64 = java.util.Base64.getEncoder().encodeToString(hexString.toString().getBytes(StandardCharsets.UTF_8));
            System.out.println("ZATCA Hash B64: " + b64);
        }
    }
}
