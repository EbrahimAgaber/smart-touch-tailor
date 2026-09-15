import codecs

with codecs.open('c:/my-pos/V4/src/pages/TailorPos.jsx', 'r', 'utf-8') as f:
    code = f.read()

code = code.replace(r'\`', '`')
code = code.replace(r'\$', '$')

with codecs.open('c:/my-pos/V4/src/pages/TailorPos.jsx', 'w', 'utf-8') as f:
    f.write(code)
print("Replaced!")
