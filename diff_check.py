import difflib

a = open('exact_sp_string.txt','rb').read().decode('utf-8')  # what validator hashes
# The block in the signed XML (raw, no ns decls added)
content = open('ZATCA_INV-ourown_signed.xml','rb').read().decode('utf-8')
idx = content.find('<xades:SignedProperties Id="xadesSignedProperties">')
end = content.find('</xades:SignedProperties>') + len('</xades:SignedProperties>')
b = content[idx:end]  # what's in signed XML

print('VALIDATOR (asXML) length:', len(a))
print('SIGNED XML length:', len(b))
print()
print('=== DIFF (validator vs signed XML) ===')
for line in difflib.context_diff(b.split('\n'), a.split('\n'), fromfile='signed_xml', tofile='validator_asXML'):
    print(repr(line))
