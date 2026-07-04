import re
with open("C:/my-pos/v2/electron/zatca_phase2.cjs", "r", encoding="utf-8") as f:
    code = f.read()

target = """    // [FIX-2] Use C14N 1.1 for SignedInfo serialisation before ECDSA signing
    const signedInfoNode = xpath.select("//*[local-name()='SignedInfo']", doc)[0];
    const c14nSignedInfo = c14n11Element(signedInfoNode);
    const sign = crypto.createSign('SHA256');
    sign.update(c14nSignedInfo, 'utf8');
    const derSignature = sign.sign({ key: privateKeyPem });
    const signatureBase64 = derSignature.toString('base64');"""

repl = """    // ZATCA Java SDK actually verifies the signature against the raw bytes of the Invoice Hash,
    // NOT the C14N of ds:SignedInfo!
    const sign = crypto.createSign('SHA256');
    sign.update(Buffer.from(invoiceHashBase64, 'base64'));
    const derSignature = sign.sign({ key: privateKeyPem });
    const signatureBase64 = derSignature.toString('base64');"""

code = code.replace(target, repl)

with open("C:/my-pos/v2/electron/zatca_phase2.cjs", "w", encoding="utf-8") as f:
    f.write(code)
