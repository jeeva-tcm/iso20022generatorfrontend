path = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Show lines around the problematic block
for i, l in enumerate(lines[180:207], start=181):
    print(f"{i}: {repr(l[:80])}")
