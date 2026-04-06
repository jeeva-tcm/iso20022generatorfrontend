import os
import re
import glob

directory = r'c:\Users\DELL\iso-validator\iso20022generatorfrontend\src\app\pages\manual-entry'

files = glob.glob(os.path.join(directory, '**', '*.component.ts'), recursive=True)

method_pattern = re.compile(
    r'(?P<indent>[ \t]+)openBicSearch\((?P<params>[^)]+)\)(?:\s*:\s*void)?\s*\{'
    r'[\s\S]*?'
    r'(?P=indent)\}\n',
    re.MULTILINE
)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    def replacer(match):
        indent = match.group('indent')
        params = match.group('params')
        # typically param is `f: string` or `controlName: string` or `f: string, index?: number`
        # Let's extract the main control name
        param_parts = params.split(',')
        first_param = param_parts[0].split(':')[0].strip()
        
        has_index = len(param_parts) > 1 and 'index' in param_parts[1]
        
        if has_index:
            new_method = f"""{indent}openBicSearch({first_param}: string, index?: number) {{
{indent}    const dialogRef = this.dialog.open(BicSearchDialogComponent, {{
{indent}        width: '800px',
{indent}        disableClose: true
{indent}    }});

{indent}    dialogRef.afterClosed().subscribe(result => {{
{indent}        if (result && result.bic) {{
{indent}            if (index !== undefined) {{
{indent}                // assuming form array logic is needed if index is present but we usually just want to avoid errors
{indent}                // Actually, let's keep it simple for array patches if needed, but for now standard patch:
{indent}                // Wait, pain001 and camt.054 use index. Let's not break their specific logic if it exists.
"""
            # Better checking: if index is there, do we just fall back on standard?
            pass
        
        # We will standardise the simple openBicSearch
        # If it's the complex one, we just do:
        replacement = f"""{indent}openBicSearch({params}) {{
{indent}    const dialogRef = this.dialog.open(BicSearchDialogComponent, {{
{indent}        width: '800px',
{indent}        disableClose: true
{indent}    }});

{indent}    dialogRef.afterClosed().subscribe(result => {{
{indent}        if (result && result.bic) {{
"""
        if has_index: # Keep whatever logic was there or just standard?
            # Looking at pain001 from earlier context:
            # it uses index. 
            pass
        
        return "MATCH"

pass
