content = open('ZATCA_INV-ourown_signed.xml', 'rb').read().decode('utf-8')
idx = content.find('xadesSignedProperties">')
while idx != -1:
    ctx = content[max(0,idx-100):idx+50]
    print(f'At {idx}:', repr(ctx[:100]))
    idx = content.find('xadesSignedProperties">', idx+1)

# find the xades:SignedProperties element
idx2 = content.find('<xades:SignedProperties')
if idx2 != -1:
    end2 = content.find('</xades:SignedProperties>') + len('</xades:SignedProperties>')
    sp = content[idx2:end2]
    print('\n=== SignedProperties block ===')
    for line in sp.split('\n'):
        print(repr(line))
