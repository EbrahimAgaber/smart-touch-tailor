import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.io.File;
import java.security.MessageDigest;
import java.util.Base64;
import com.zatca.sdk.util.Utils;
import com.zatca.sdk.util.EcryptionUtils;

public class TestExactHash {
    static String SIGN_PROPERTY_XPATH = "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties";

    static String bytesToHex(byte[] hash) {
        StringBuilder hexString = new StringBuilder(2 * hash.length);
        for (int i = 0; i < hash.length; i++) {
            String hex = Integer.toHexString(0xFF & hash[i]);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }

    public static void main(String[] args) throws Exception {
        // Build the content the EXACT same way the SDK does:
        // 1. It reads ubl.xml template (which we have extracted at xml/ubl.xml)
        // 2. It transforms the XML via XSLT and inserts the UBL block
        // 3. It then uses dom4j to manipulate the document
        //
        // Instead, let's directly simulate by reading the signed XML:
        String content = new String(Files.readAllBytes(new File("ZATCA_INV-ourown_signed.xml").toPath()), StandardCharsets.UTF_8);
        
        // This is what the VALIDATOR does:
        String calc = Utils.getNodeXmlValue(content, SIGN_PROPERTY_XPATH);
        System.out.println("=== EXACT STRING THAT VALIDATOR HASHES ===");
        System.out.println(calc);
        System.out.println("\n=== LENGTH: " + calc.length());
        
        // Hash it the same way as VALIDATOR:
        String hexHash = bytesToHex(EcryptionUtils.hashStringToBytes(calc));
        String b64Hash = Base64.getEncoder().encodeToString(hexHash.getBytes(StandardCharsets.UTF_8));
        System.out.println("=== HASH (Hex): " + hexHash);
        System.out.println("=== HASH (B64(Hex)): " + b64Hash);
        
        // Now compare with what's IN the signed XML:
        String inXml = Utils.getNodeContentXpth(content, "//*[local-name()='Invoice']//*[local-name()='UBLExtensions']//*[local-name()='UBLExtension']//*[local-name()='ExtensionContent']//*[local-name()='UBLDocumentSignatures']//*[local-name()='SignatureInformation']//*[local-name()='Signature']//*[local-name()='SignedInfo']//*[local-name()='Reference'][2]//*[local-name()='DigestValue']");
        System.out.println("\n=== HASH IN SIGNED XML: " + inXml);
        System.out.println("=== MATCH: " + b64Hash.equals(inXml));
        
        Files.write(new File("exact_sp_string.txt").toPath(), calc.getBytes(StandardCharsets.UTF_8));
        System.out.println("\nWrote exact_sp_string.txt");
    }
}
