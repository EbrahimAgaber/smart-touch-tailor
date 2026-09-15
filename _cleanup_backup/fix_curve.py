import re

with open("C:/my-pos/v2/generate_zatca_csr.js", "r", encoding="utf-8") as f:
    code = f.read()

# Change curve
code = code.replace("namedCurve: 'prime256v1',", "namedCurve: 'secp256k1',")
code = code.replace("rdn('2.5.4.3',  DEVICE_SERIAL),            // CN", "rdn('2.5.4.3',  'Al-Basma POS Test'),            // CN")

# Replace the base64 output at the end to be base64-of-base64 if needed? No, just output the PEM base64
code = code.replace("console.log(csrB64);", "console.log(Buffer.from(csrPem, 'utf8').toString('base64'));")
code = code.replace("console.log(`\\nLength: ${csrB64.length} characters`);", "console.log(`\\nLength: ${Buffer.from(csrPem, 'utf8').toString('base64').length} characters`);")

with open("C:/my-pos/v2/generate_zatca_csr.js", "w", encoding="utf-8") as f:
    f.write(code)
