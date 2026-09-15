import re

with open("C:/my-pos/v2/generate_zatca_csr.js", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("const DEVICE_SERIAL  = '1-SmartTouch-2-POS-9013';", "const DEVICE_SERIAL  = '1-AlBasma|2-v2|3-SN1782511221.6472';")
code = code.replace("const VAT_NUMBER     = '300075585600003';", "const VAT_NUMBER     = '311111111111113';")
code = code.replace("const BRANCH_NAME    = 'POS-9013';", "const BRANCH_NAME    = '1100';")
code = code.replace("const BRANCH_INDUS   = 'Retail';", "const BRANCH_INDUS   = 'Retail';")
code = code.replace("Maximum Speed Tech Supply LTD", "Al-Basma Trading")
code = code.replace("TST-886431145-399999999900003", "Al-Basma POS Test")
code = code.replace("Riyadh Branch", "1100")
code = code.replace("Riyadh", "Jeddah")

with open("C:/my-pos/v2/generate_zatca_csr.js", "w", encoding="utf-8") as f:
    f.write(code)
