import os
import glob
import re

base_dir = r"c:/Users/HP/Documents/ISO20022 Validator new/iso20022generatorfrontend/src/app/pages/manual-entry"

css_files = []
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.component.css') and 'camt052' not in root:
            css_files.append(os.path.join(root, f))

# The new scrollbar CSS to replace anything related to textarea.code-editor::-webkit-scrollbar
new_scrollbar = '''
.left-panel, .right-panel {
    scrollbar-width: thin;
    scrollbar-color: #add8e6 transparent;
}

textarea.code-editor {
    scrollbar-width: thin;
    scrollbar-color: #add8e6 var(--editor-bg);
}

.left-panel::-webkit-scrollbar,
.right-panel::-webkit-scrollbar,
textarea.code-editor::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.left-panel::-webkit-scrollbar-track,
.right-panel::-webkit-scrollbar-track {
    background: transparent;
}

textarea.code-editor::-webkit-scrollbar-track {
    background: var(--editor-bg);
}

.left-panel::-webkit-scrollbar-thumb,
.right-panel::-webkit-scrollbar-thumb,
textarea.code-editor::-webkit-scrollbar-thumb {
    background-color: #add8e6; /* Light Blue */
    border-radius: 4px;
}

.left-panel::-webkit-scrollbar-thumb:hover,
.right-panel::-webkit-scrollbar-thumb:hover,
textarea.code-editor::-webkit-scrollbar-thumb:hover {
    background-color: #87cefa; /* Light Sky Blue */
}
'''

for css_file in css_files:
    with open(css_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. split-view
    content = re.sub(
        r'\.split-view\s*\{[\s\S]*?height:\s*calc\(100vh\s*-\s*120px\);\s*(?:margin-top:\s*-1rem;\s*)?\}',
        '.split-view {\n    display: flex;\n    gap: 1.5rem;\n    align-items: stretch;\n    flex: 1;\n    min-height: 0;\n    margin-top: -1rem;\n    padding-bottom: 1rem;\n}',
        content
    )

    # 2. left-panel
    if 'padding-bottom: 2rem;' not in content and '.left-panel {' in content:
        content = re.sub(
            r'(\.left-panel\s*\{[^}]*?)(padding-right:\s*0\.5rem;)(\s*\})',
            r'\g<1>\g<2>\n    padding-bottom: 2rem;\g<3>',
            content
        )

    # 3. right-panel
    if 'overflow-y: hidden;' not in content and '.right-panel {' in content:
        content = re.sub(
            r'(\.right-panel\s*\{[^}]*?)(overflow-y:\s*auto;)([^}]*?)(\s*\})',
            r'\g<1>overflow-y: hidden;\n    display: flex;\n    flex-direction: column;\g<3>\g<4>',
            content
        )

    # 4. editor-wrapper
    if 'height: 500px;' in content and '.editor-wrapper {' in content:
        content = re.sub(
            r'(\.editor-wrapper\s*\{[^}]*?)height:\s*500px;([^}]*?\})',
            r'\g<1>flex: 1;\n    min-height: 0;\g<2>',
            content
        )

    # 5. preview-box addition
    if '.preview-box' not in content:
        content = re.sub(
            r'(\.content-box\s*\{[\s\S]*?\})',
            r'\g<1>\n\n.preview-box {\n    flex: 1;\n    min-height: 0;\n    display: flex;\n    flex-direction: column;\n}',
            content, count=1
        )

    # 6. scrollbars replace
    # We strip out the old textarea.code-editor::-webkit-scrollbar rules
    old_scroll_regex = r'(?:textarea)?\.code-editor::-webkit-scrollbar(?:-track|-thumb(?:[:a-zA-Z]*)?)?\s*\{[\s\S]*?\}'
    content = re.sub(old_scroll_regex, '', content)
    
    # Check if we already appended
    if 'scrollbar-color: #add8e6 transparent;' not in content:
        # Append before /* Preview Actions */ if possible
        if '/* Preview Actions */' in content:
            content = content.replace('/* Preview Actions */', new_scrollbar + '\n\n/* Preview Actions */')
        else:
            content += new_scrollbar
            
    # Clean up empty multiple newlines
    content = re.sub(r'\n{4,}', r'\n\n\n', content)

    with open(css_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {css_file}")
