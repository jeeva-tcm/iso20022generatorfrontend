import re
depth = 0
with open('c:/Users/hp/Documents/ISO validator new/iso20022generatorfrontend/src/app/pages/manual-entry/pacs9/pacs9.component.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        opens = len(re.findall(r'<div(?!er)', line))
        closes = len(re.findall(r'</div>', line))
        depth += opens - closes
        if depth < 0:
            print(f"Error at line {i+1}: Negative depth {depth} --- {line.strip()}")
            break
print(f"Final depth: {depth}")
