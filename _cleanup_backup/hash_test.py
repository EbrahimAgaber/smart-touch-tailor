from lxml import etree
import hashlib, base64

tree = etree.parse("java_signed3.xml")
ns = {'xades': 'http://uri.etsi.org/01903/v1.3.2#'}
node = tree.xpath("//xades:SignedProperties[@Id='xadesSignedProperties']", namespaces=ns)[0]
c14n = etree.tostring(node, method="c14n", exclusive=False, with_comments=False)

target_hex = "61dfccaabf86c30902d9a1c77b74969589f4031da48e6465992d9ef9df68a4f7"

candidates = {
    # mirrors cert-digest quirk: hash the base64-STRING of the bytes, not the raw bytes
    "H2_hash_of_base64_string": hashlib.sha256(base64.b64encode(c14n)).hexdigest(),
    # hash the hex-STRING of the bytes
    "H3_hash_of_hex_string": hashlib.sha256(c14n.hex().encode('utf-8')).hexdigest(),
    # exclusive c14n variants of the same two ideas
}
c14n_exc = etree.tostring(node, method="c14n", exclusive=True, with_comments=False)
candidates["H2_exc_hash_of_base64_string"] = hashlib.sha256(base64.b64encode(c14n_exc)).hexdigest()
candidates["H3_exc_hash_of_hex_string"] = hashlib.sha256(c14n_exc.hex().encode('utf-8')).hexdigest()

for name, h in candidates.items():
    print(f"[{name}]: {h} MATCH={h == target_hex}")
