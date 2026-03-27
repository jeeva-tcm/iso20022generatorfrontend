import re
c = 0
with open('c:/Users/hp/Documents/ISO validator new/iso20022generatorfrontend/src/app/pages/manual-entry/pacs9/pacs9.component.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        opens = len(re.findall(r'<div(?!er)', line)) # avoid mat-icon or similar if they contain div, but here it's just <div
        closes = len(re.findall(r'</div>', line))
        c += opens - closes
        if c < 0:
            print(f"Negative balance at line {i+1}: {c} --- {line.strip()}")
            # Break to find the first error
            break
print(f"Final balance check: {c}")
