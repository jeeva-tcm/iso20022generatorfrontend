import os

files = [
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9cov\pacs9cov.component.html',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\pacs8\pacs8.component.html',
    r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\camt057\camt057.component.html',
]

replacements = [
    # Section titles (party-group-title)
    ('Debtor Financial Institution', 'Debtor'),
    ('Creditor Financial Institution', 'Creditor'),

    # Template context titles (title:'...')
    ("title:'Debtor FI'", "title:'Debtor'"),
    ("title:'Creditor FI'", "title:'Creditor'"),
    ("title:'Debtor FI'", "title:'Debtor'"),   # duplicate safety

    # Labels in HTML
    ('>Debtor FI Account<', '>Debtor Account<'),
    ('>Creditor FI Account<', '>Creditor Account<'),
    ('>Debtor FI Account ID<', '>Debtor Account ID<'),
    ('>Creditor FI Account ID<', '>Creditor Account ID<'),
    ('>Debtor FI Name<', '>Debtor Name<'),
    ('>Creditor FI Name<', '>Creditor Name<'),

    # HTML comments  
    ('<!-- Debtor FI -->', '<!-- Debtor -->'),
    ('<!-- Creditor FI -->', '<!-- Creditor -->'),
    ('<!-- Debtor FI Account -->', '<!-- Debtor Account -->'),
    ('<!-- Creditor FI Account -->', '<!-- Creditor Account -->'),
]

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for old, new in replacements:
        content = content.replace(old, new)

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

    changed = content != original
    print(f'{"Updated" if changed else "No change"}: {os.path.basename(fpath)}')

print('All done.')
