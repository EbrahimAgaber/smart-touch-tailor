import re

with open("C:/my-pos/v2/generate_zatca_csr.js", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("rdn('2.5.4.11', 'Head Office'),            // OU", "rdn('2.5.4.11', '1000000001'),            // OU")

with open("C:/my-pos/v2/generate_zatca_csr.js", "w", encoding="utf-8") as f:
    f.write(code)
