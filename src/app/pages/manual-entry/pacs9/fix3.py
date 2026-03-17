path = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove instd agent account block (lines 196-204, 0-indexed 195-203 inclusive)
del lines[195:205]
# Remove instg agent account block (lines 182-190, 0-indexed 181-189 inclusive)
del lines[181:191]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done, total lines:', len(lines))
