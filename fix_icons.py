import sys
import os

files = [
    r'c:\Users\HP\Documents\ISO20022 Validator new\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html',
    r'c:\Users\HP\Documents\ISO20022 Validator new\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9cov\pacs9cov.component.html',
    r'c:\Users\HP\Documents\ISO20022 Validator new\iso20022generatorfrontend\src\app\pages\manual-entry\pacs8\pacs8.component.html'
]

replacements = [
    ('âœ…', '<mat-icon style="color: #10b981; font-size: 20px;">check_circle</mat-icon>'),
    ('â Œ', '<mat-icon style="color: #ef4444; font-size: 20px;">cancel</mat-icon>'),
    ('âš ï¸ ', '<mat-icon style="color: #f59e0b; font-size: 20px;">warning</mat-icon>'),
    ('&#x2705;', '<mat-icon style="color: #10b981; font-size: 20px;">check_circle</mat-icon>'),
    ('&#x274C;', '<mat-icon style="color: #ef4444; font-size: 20px;">cancel</mat-icon>'),
    ('&#x26A0;&#xFE0F;', '<mat-icon style="color: #f59e0b; font-size: 20px;">warning</mat-icon>'),
    ('ðŸ’¡ Fix:', '<mat-icon style="font-size: 16px; width: 16px; height: 16px; vertical-align: middle;">lightbulb</mat-icon> Fix:'),
    ('💡 Fix:', '<mat-icon style="font-size: 16px; width: 16px; height: 16px; vertical-align: middle;">lightbulb</mat-icon> Fix:')
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file_path}")
