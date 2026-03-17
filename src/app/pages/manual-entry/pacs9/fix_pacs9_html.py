
path = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove the two account sections
# Sect 1: 182 to 190 (0-indexed: 181 to 190)
# Sect 2: 196 to 204 (0-indexed: 195 to 204)
# Adjusting for deletions:
# Delete 195:205 first
del lines[195:205]
# Delete 181:191 second
del lines[181:191]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Success')
