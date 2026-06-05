import os
import re

directory = r"C:\Users\HP\Desktop\iso final\iso20022generatorfrontend\src\app\pages\manual-entry"

new_functions = """  isLayerPass(k: string) {
    const s = (this.getLayerStatus(k) || '').toUpperCase();
    if (!s || s.trim() === '') return false;
    if (s.includes('FAIL') || s.includes('ERROR') || s.includes('❌') || s.includes('?')) return false;
    if (s.includes('WARN') || s.includes('⚠')) return false;
    const layerNum = Number(k);
    const hasLayerWarnings = (this.validationReport?.details ?? []).some(
        (d: any) => Number(d?.layer) === layerNum && d?.severity === 'WARNING'
    );
    if (hasLayerWarnings) return false;
    return s.includes('PASS') || s.includes('SUCCESS') || s.includes('VALID') || s.includes('✔');
  }

  isLayerFail(k: string) {
    const s = (this.getLayerStatus(k) || '').toUpperCase();
    return s.includes('FAIL') || s.includes('ERROR') || s.includes('❌') || s.includes('?');
  }

  isLayerWarn(k: string) {
    const s = (this.getLayerStatus(k) || '').toUpperCase();
    if (s.includes('WARN') || s.includes('⚠')) return true;
    if (s.includes('FAIL') || s.includes('ERROR') || s.includes('❌') || s.includes('?')) return false;
    if (!s || s.trim() === '') return false;
    const layerNum = Number(k);
    return (this.validationReport?.details ?? []).some(
        (d: any) => Number(d?.layer) === layerNum && d?.severity === 'WARNING'
    );
  }"""

pattern = re.compile(r'  isLayerPass\(k: string\) \{.*?  isLayerWarn\(k: string\) \{.*?\}\n', re.DOTALL)

count = 0
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(".ts"):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if "isLayerPass(k: string)" in content:
                new_content = pattern.sub(new_functions + "\n", content)
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count += 1

print(f"Replaced in {count} files")
