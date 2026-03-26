import os

files_to_update = [
    r"c:\Users\hp\Documents\ISO validator new\iso20022generatorfrontend\src\app\pages\manual-entry\pacs8\pacs8.component.html",
    r"c:\Users\hp\Documents\ISO validator new\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9\pacs9.component.html",
    r"c:\Users\hp\Documents\ISO validator new\iso20022generatorfrontend\src\app\pages\manual-entry\pacs9cov\pacs9cov.component.html"
]

for file_path in files_to_update:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update Category Purpose Code select to input+datalist
    # We want to match various styles of indentation
    import re
    
    # Match the whole select block
    # Indentation: (\s*)
    p_select = re.compile(r'(\s*)<select\s+formControlName="ctgyPurpCd">.*?</select>', re.DOTALL)
    replacement = r'''\1<input formControlName="ctgyPurpCd" [matTooltip]="'Select or provide a 4-character ISO purpose code'" list="purpList" placeholder="Select or enter code">
\1<datalist id="purpList">
\1    <option *ngFor="let p of purposes" [value]="p">{{p}}</option>
\1</datalist>'''
    
    new_content = p_select.sub(replacement, content)
    
    # 2. Remove Purpose Code field (purpCd)
    # Match the block starting with comments or direct div
    # Look for both "Purpose Code Moved Here" and direct purpCd div
    p_purp = re.compile(r'\s*<!-- Purpose Code (Moved Here|Correct Position) -->\s*<div class="form-group intermediary-field">.*?label.*?Purpose Code.*?purpCd.*?</div>\s*</div>', re.DOTALL)
    # Sometimes it's just the div without a preceding comment
    p_purp_direct = re.compile(r'\s*<div class="form-group intermediary-field">.*?label.*?Purpose Code.*?purpCd.*?</div>\s*</div>', re.DOTALL)
    
    # Need to be careful not to remove the WRONG div if there's no comment
    # Let's use the most specific one first
    new_content = p_purp.sub('', new_content)
    
    # Check if purpCd is still there (only if it was the Transaction one)
    # Usually it's in a form-group with Purpose Code label
    if 'formControlName="purpCd"' in new_content:
        # Match from <div class="form-group" to the end of that specific div
        # We look for a div that contains purpCd
        p_purp_generic = re.compile(r'\s*<div[^>]*class="form-group[^"]*"[^>]*>.*?label.*?Purpose Code.*?purpCd.*?</div>\s*</div>', re.DOTALL)
        new_content = p_purp_generic.sub('', new_content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {file_path}")
