
path = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 182-190 and 196-204 (1-indexed)
# 182-190 is lines[181:190]
# 196-204 is lines[195:204]
# We should do the later one first to not mess up indices
del lines[195:204]
del lines[181:191]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
