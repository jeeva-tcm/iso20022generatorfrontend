import os
import re

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipped {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern: 
    # match 1: <button type="button" class="uetr-refresh-btn" (click)="openBicSearch..." title="Search Global BIC Directory"><mat-icon...>search</mat-icon></button>
    # match 2: <input formControlName="..." ...>
    
    pattern = r'(<button type="button" class="uetr-refresh-btn" \(click\)="[^"]+" title="Search Global BIC Directory"><mat-icon(?: style="[^"]*")?>search</mat-icon></button>)(<input formControlName="[^"]*"[^>]*>)'

    def replacer(match):
        btn = match.group(1)
        inp = match.group(2)
        
        # We replace the button class and add inline styles to make it look like a solid blue action-btn.
        new_btn = btn.replace('class="uetr-refresh-btn"', 'class="action-btn" style="padding: 0 12px; height: 36px; min-width: 0; margin: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px;"')
        
        # Return input FIRST, then button, wrapped in a div.
        return f'<div class="uetr-control-row" style="display: flex; gap: 8px;">\n{inp}\n{new_btn}\n</div>'

    new_content, count = re.subn(pattern, replacer, content)
    
    if count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed {count} buttons in {filepath}")
    else:
        print(f"No match found in {filepath}")

base_dir = r"c:/Users/DELL/iso-validator/iso20022generatorfrontend/src/app/pages/manual-entry"
process_file(os.path.join(base_dir, 'pain002', 'pain002.component.html'))
process_file(os.path.join(base_dir, 'pain008', 'pain008.component.html'))

print("Completed layout fixes.")
