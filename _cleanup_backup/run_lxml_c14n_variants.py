from lxml import etree
import hashlib, base64

tree = etree.parse("java_signed3.xml")
ns = {'xades': 'http://uri.etsi.org/01903/v1.3.2#'}
node = tree.xpath("//xades:SignedProperties[@Id='xadesSignedProperties']", namespaces=ns)[0]

target_hex = base64.b64decode("NjFkZmNjYWFiZjg2YzMwOTAyZDlhMWM3N2I3NDk2OTU4OWY0MDMxZGE0OGU2NDY1OTkyZDllZjlkZjY4YTRmNw==").decode()
print("[TARGET_HEX]:", target_hex)

variants = {
    "inclusive_no_comments": dict(exclusive=False, with_comments=False),
    "inclusive_with_comments": dict(exclusive=False, with_comments=True),
    "exclusive_no_comments": dict(exclusive=True, with_comments=False),
    "exclusive_with_comments": dict(exclusive=True, with_comments=True),
}
for name, kwargs in variants.items():
    c14n = etree.tostring(node, method="c14n", **kwargs)
    h = hashlib.sha256(c14n).hexdigest()
    print(f"[{name}]: {h} MATCH={h == target_hex}")
