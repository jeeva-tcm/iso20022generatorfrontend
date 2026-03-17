import re

files = [
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs8\pacs8.component.html',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9cov\pacs9cov.component.html',
]

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace party-group-title without mandatory for Instructing/Instructed Agent
    content = content.replace(
        'class="party-group-title">Instructing Agent<',
        'class="party-group-title mandatory">Instructing Agent<'
    )
    content = content.replace(
        'class="party-group-title">Instructed Agent<',
        'class="party-group-title mandatory">Instructed Agent<'
    )

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated: {fpath}')

print('All done.')
