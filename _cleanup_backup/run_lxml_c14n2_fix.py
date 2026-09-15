from lxml import etree
import hashlib

tree = etree.parse("java_signed3.xml")
# Re-parse fragment standalone with explicit nsmap so c14n2 has full scope
node = tree.xpath("//*[local-name()='SignedProperties' and @Id='xadesSignedProperties']")[0]
nsmap_str = ' '.join(f'xmlns:{k}="{v}"' for k, v in node.nsmap.items() if k)
frag_xml = etree.tostring(node)
wrapped = etree.fromstring(f'<wrap {nsmap_str}>{frag_xml.decode()}</wrap>')
inner = wrapped[0]
try:
    c14n2 = etree.tostring(inner, method="c14n2")
    print("c14n2_hash:", hashlib.sha256(c14n2).hexdigest())
except Exception as e:
    print("c14n2_hash:", str(e))
