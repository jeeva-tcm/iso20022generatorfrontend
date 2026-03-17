path = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry\camt057\camt057.component.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'class="party-group-title">Debtor Agent<',
    'class="party-group-title mandatory">Debtor Agent<'
)
content = content.replace(
    'class="party-group-title">Intermediary Agent<',
    'class="party-group-title mandatory">Intermediary Agent<'
)
content = content.replace(
    'class="party-group-title">Expected Debtor Information<',
    'class="party-group-title mandatory">Expected Debtor Information<'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
