import sys
import subprocess

try:
    import lxml.etree as etree
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "lxml", "--break-system-packages"])
    import lxml.etree as etree

import hashlib, base64

tree = etree.parse("java_signed3.xml")
ns = {'xades': 'http://uri.etsi.org/01903/v1.3.2#'}
node = tree.xpath("//xades:SignedProperties[@Id='xadesSignedProperties']", namespaces=ns)[0]

c14n = etree.tostring(node, method="c14n", exclusive=False, with_comments=False)
h = hashlib.sha256(c14n).hexdigest()

print(f"[HASH]: {h}")
print(f"[B64OFHEX]: {base64.b64encode(h.encode()).decode()}")
match_result = "yes" if h == "61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7" else "no"
print(f"[MATCH]: {match_result}")
print("[C14N]:")
print(c14n.decode())
