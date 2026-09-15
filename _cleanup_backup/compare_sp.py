import hashlib, base64

# This is what the JS computes (from my_hashed_string.txt if it were written)
# Let's reconstruct it from what we know the signed XML contains
content = open('ZATCA_INV-ourown_signed.xml', 'rb').read().decode('utf-8')

# Extract what's in signed XML
idx = content.find('<xades:SignedProperties Id="xadesSignedProperties">')
end = content.find('</xades:SignedProperties>') + len('</xades:SignedProperties>')
sp_in_xml = content[idx:end]

# Apply same transforms as JS does
sp_hashed = sp_in_xml
sp_hashed = sp_hashed.replace('<xades:SignedProperties Id="xadesSignedProperties">', '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">')
sp_hashed = sp_hashed.replace('<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>', '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>')
sp_hashed = sp_hashed.replace('<ds:DigestValue>', '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
sp_hashed = sp_hashed.replace('<ds:X509IssuerName>', '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')
sp_hashed = sp_hashed.replace('<ds:X509SerialNumber>', '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">')

print('JS would hash length:', len(sp_hashed))
js_hash_hex = hashlib.sha256(sp_hashed.encode('utf-8')).hexdigest()
js_hash_b64 = base64.b64encode(js_hash_hex.encode('utf-8')).decode()
print('JS hash B64(Hex):', js_hash_b64)

# What validator computes
validator_str = open('exact_sp_string.txt', 'rb').read().decode('utf-8')
print('\nValidator hashes length:', len(validator_str))
val_hash_hex = hashlib.sha256(validator_str.encode('utf-8')).hexdigest()
val_hash_b64 = base64.b64encode(val_hash_hex.encode('utf-8')).decode()
print('Validator hash B64(Hex):', val_hash_b64)

print('\nMatch:', js_hash_b64 == val_hash_b64)
print('\n=== DIFF between JS string and Validator string ===')
import difflib
for line in difflib.context_diff(sp_hashed.split('\n'), validator_str.split('\n'), fromfile='js', tofile='validator'):
    print(repr(line))
