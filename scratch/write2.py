import re
with open(r'C:\Users\bin-g\.gemini\antigravity\brain\a79c91cb-2632-435f-afd0-cfd197406048\scratch\code.txt', 'r', encoding='utf-8') as f:
    code = f.read()

match = re.search(r'```jsx\n([\s\S]*?)```', code)
if match:
    with open('c:/my-pos/V4/src/pages/TailorPos.jsx', 'w', encoding='utf-8') as f:
        f.write(match.group(1))
    print("Success")
else:
    print("No match found")
