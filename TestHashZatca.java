import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.io.File;
import java.util.Base64;
import com.zatca.sdk.util.Utils;
import com.zatca.sdk.util.EcryptionUtils;

public class TestHashZatca {
    public static void main(String[] args) throws Exception {
        String content = new String(Files.readAllBytes(new File("ZATCA_INV-ourown_signed.xml").toPath()), StandardCharsets.UTF_8);
        String SIGN_PROPERTY_XPATH = "/Invoice/ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/sig:UBLDocumentSignatures/sac:SignatureInformation/ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties";
        String calc = Utils.getNodeXmlValue(content, SIGN_PROPERTY_XPATH);
        System.out.println("Length: " + calc.length());
        
        String hashed = Base64.getEncoder().encodeToString(EcryptionUtils.hashString(calc).getBytes(StandardCharsets.UTF_8));
        System.out.println("Hashed: " + hashed);
        
        Files.write(new File("zatca_calc.txt").toPath(), calc.getBytes(StandardCharsets.UTF_8));
    }
}
