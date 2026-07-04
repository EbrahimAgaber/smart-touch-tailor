import java.io.File;
import java.nio.file.Files;
import java.security.MessageDigest;
import org.dom4j.Document;
import org.dom4j.DocumentHelper;
import org.dom4j.Node;
import org.dom4j.XPath;
import org.dom4j.io.SAXReader;
import java.util.HashMap;
import java.util.Map;
import java.nio.charset.StandardCharsets;

public class TestHash {
    public static void main(String[] args) throws Exception {
        SAXReader reader = new SAXReader();
        Document document = reader.read(new File("java_signed3.xml"));
        
        Map<String, String> nameSpaces = new HashMap<>();
        nameSpaces.put("xades", "http://uri.etsi.org/01903/v1.3.2#");
        
        XPath xpath = DocumentHelper.createXPath("//xades:SignedProperties[@Id='xadesSignedProperties']");
        xpath.setNamespaceURIs(nameSpaces);
        Node node = xpath.selectSingleNode(document);
        
        String xml = node.asXML();
        System.out.println("Length: " + xml.length());
        
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(xml.getBytes(StandardCharsets.UTF_8));
        
        StringBuilder hexString = new StringBuilder(2 * hash.length);
        for (int i = 0; i < hash.length; ++i) {
            String hex = Integer.toHexString(0xFF & hash[i]);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        System.out.println("Hash: " + hexString.toString());
        Files.write(new File("dom4j_sp.txt").toPath(), xml.getBytes(StandardCharsets.UTF_8));
    }
}
