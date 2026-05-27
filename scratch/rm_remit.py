import os
import re

html_file = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\mt-to-mx\mt-to-mx.component.html'
with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove the MT103 REMIT mat-option from html
html = re.sub(
    r'\s*<mat-option value="MT103 REMIT">\s*<div class="opt-layout">\s*<div class="opt-text">\s*<span class="opt-title">MT103 REMIT \(pacs\.008-Remit\)</span>\s*<span class="opt-sub">Customer Credit Transfer \(Remit\)</span>\s*</div>\s*</div>\s*</mat-option>',
    '',
    html
)
with open(html_file, 'w', encoding='utf-8') as f:
    f.write(html)


ts_file = r'c:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\mt-to-mx\mt-to-mx.component.ts'
with open(ts_file, 'r', encoding='utf-8') as f:
    ts = f.read()

# Remove from dictionary mapping
ts = re.sub(
    r"\s*'MT103 REMIT': { mx: 'pacs\.008\.001\.08', desc: 'FI to FI Customer Credit Transfer \(Remit\)' },",
    '',
    ts
)

# Remove detection logic
ts = re.sub(
    r"\s*if \(type === 'MT103' && \(mt\.includes\('\{119:REMIT\}'\) \|\| mt\.includes\(':119:REMIT'\) \|\| mt\.includes\(':77T:'\)\)\) return 'MT103 REMIT';",
    '',
    ts
)

# Remove switch case
ts = re.sub(
    r"\s*case 'MT103 REMIT': this\.mtInput = this\.getSampleMT103Remit\(\); break;",
    '',
    ts
)

with open(ts_file, 'w', encoding='utf-8') as f:
    f.write(ts)

print("Removed MT103 REMIT from frontend.")
