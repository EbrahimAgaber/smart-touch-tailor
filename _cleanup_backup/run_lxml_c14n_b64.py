import re
import hashlib
import base64
try:
    import lxml.etree as etree
except ImportError:
    import sys, subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "lxml", "--break-system-packages"])
    import lxml.etree as etree

content = open("java_signed3.xml", encoding="utf-8").read()
m = re.search(r'URI="#xadesSignedProperties".*?<ds:DigestValue>(.*?)</ds:DigestValue>', content, re.S)
raw_digest = m.group(1) if m else "NOT_FOUND"

tree = etree.parse("java_signed3.xml")
ns = {'xades': 'http://uri.etsi.org/01903/v1.3.2#'}
node = tree.xpath("//xades:SignedProperties[@Id='xadesSignedProperties']", namespaces=ns)[0]

c14n = etree.tostring(node, method="c14n", exclusive=False, with_comments=False)
h_bytes = hashlib.sha256(c14n).digest()
b64_raw = base64.b64encode(h_bytes).decode()

print(f"[RAW_FILE_DIGESTVALUE]: {raw_digest}")
print(f"[B64_RAW_BYTES]: {b64_raw}")
print(f"[MATCH]: {'yes' if raw_digest == b64_raw else 'no'}")
