from lxml import etree
tree = etree.parse("java_signed3.xml")
ns = {'xades': 'http://uri.etsi.org/01903/v1.3.2#'}
node = tree.xpath("//xades:SignedProperties[@Id='xadesSignedProperties']", namespaces=ns)[0]
try:
    c14n2 = etree.tostring(node, method="c14n2")
    import hashlib
    print("c14n2:", hashlib.sha256(c14n2).hexdigest())
except Exception as e:
    print("c14n2 ERROR:", e)
