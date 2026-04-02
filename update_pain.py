import os
import re

ts_append = """
  openBicSearch(controlName: string, index?: number) {
    const dialogRef = this.dialog.open(BicSearchDialogComponent, { width: '800px', disableClose: true });
    dialogRef.afterClosed().subscribe(result => {
      if (result && result.bic) {
        if (index !== undefined) {
           const grp = this.transactions.at(index) as FormGroup;
           grp.patchValue({ [controlName]: result.bic });
           grp.get(controlName)?.markAsDirty();
        } else {
           this.form.patchValue({ [controlName]: result.bic });
           this.form.get(controlName)?.markAsDirty();
        }
      }
    });
  }
}
"""

def process_ts(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'openBicSearch' in content:
        print(f"Skipping TS, already has openBicSearch: {filepath}")
        return

    # 1. Imports
    if 'MatDialog' not in content:
        content = re.sub(r"import \{([^}]+)\} from '@angular/material/dialog';", r"import {\1, MatDialog} from '@angular/material/dialog';", content)
        if 'MatDialog' not in content:
             content = "import { MatDialog } from '@angular/material/dialog';\n" + content

    if 'BicSearchDialogComponent' not in content:
        content = "import { BicSearchDialogComponent } from '../bic-search-dialog/bic-search-dialog.component';\n" + content

    # 2. Add MatDialog to constructor
    if 'private dialog: MatDialog' not in content:
        content = re.sub(r'constructor\(\s*', 'constructor(\n    private dialog: MatDialog,\n    ', content)

    # 3. Add openBicSearch before last closing brace
    content = content.rstrip()
    if content.endswith('}'):
        content = content[:-1] + ts_append

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated TS: {filepath}")

def process_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to find places like:
    # <div class="form-group"><label>Sender BIC...<input formControlName="fromBic"...
    # And insert a button after the label, or after the input
    # Let's target the input tag: `<input formControlName="xxxBic"` and inject the button right after it.
    
    # We must differentiate between inputs in a loop (index needed) vs base form
    # If the input is inside `*ngFor="let tx of transactions.controls; let i = index"`, it should pass `i`.
    
    # Actually, a safer regex replacement to add button before `<input formControlName="...Bic..."`.
    def replacer(match):
        full_match = match.group(0)
        fcn = match.group(1)
        
        # Dont inject twice
        if fcn + "')" in content or fcn + "', i)" in content:
             pass # Maybe it exists? Better check locally

        # Check if we are inside tx-grid or tx-card, usually we'll just check if it's in the transactions block.
        # But this is a simple text replacement, let's just make it context-aware of 'i' if in tx loop
        # For simplicity, if the control is inside formControlName within a repeater it might just be the control's name.
        is_tx = False
        # Pain formats prefix 'tx.' or just in the formArray
        if 'tx' in full_match or 'index' in full_match or 'Bic' in fcn: 
           pass
        
        # A simple heuristic: if it comes after `<div formArrayName="transactions"`, we pass `i`.
        # However, regex can't easily know.
        
        return full_match

    # Let's do it another way: split the file by `<div formArrayName="transactions"`
    parts = content.split('formArrayName="transactions"')
    
    def inject_buttons(text, in_array):
        # find formControlName="somethingBic" or "somethingAnyBIC"
        lines = text.split('\n')
        out_lines = []
        for line in lines:
            if 'formControlName="' in line and re.search(r'Bic|BIC', line):
                # find the formControlName
                m = re.search(r'formControlName="([^"]+)"', line)
                if m:
                    fcn = m.group(1)
                    if 'openBicSearch' not in line and 'BIC' in fcn.upper():
                        # construct button
                        idx_arg = f", i" if in_array else ""
                        btn = f'<button type="button" class="uetr-refresh-btn" (click)="openBicSearch(\'{fcn}\'{idx_arg})" title="Search Global BIC Directory"><mat-icon style="font-size: 16px; width: 16px; height: 16px;">search</mat-icon></button>'
                        # insert before the input so it sits next to label or input
                        line = line.replace(f'<input formControlName="{fcn}"', f'{btn}<input formControlName="{fcn}"')
            out_lines.append(line)
        return '\n'.join(out_lines)

    if len(parts) > 1:
        part0 = inject_buttons(parts[0], False)
        part1 = inject_buttons('formArrayName="transactions"' + parts[1], True)
        content = part0 + part1
    else:
        content = inject_buttons(content, False)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated HTML: {filepath}")


base_dir = r"c:/Users/DELL/iso-validator/iso20022generatorfrontend/src/app/pages/manual-entry"
for comp in ['pain002', 'pain008']:
    ts = os.path.join(base_dir, comp, f"{comp}.component.ts")
    html = os.path.join(base_dir, comp, f"{comp}.component.html")
    
    if os.path.exists(ts):
        process_ts(ts)
    if os.path.exists(html):
        process_html(html)

print("Done.")
