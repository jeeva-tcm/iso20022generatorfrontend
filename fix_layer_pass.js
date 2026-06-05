const fs = require('fs');
const path = require('path');

const directory = "C:\\Users\\HP\\Desktop\\iso final\\iso20022generatorfrontend\\src\\app\\pages\\manual-entry";

const new_functions = `  isLayerPass(k: string) {
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
  }`;

const pattern = /  isLayerPass\(k: string\) \{[\s\S]*?  isLayerWarn\(k: string\) \{[\s\S]*?\n  \}/;

let count = 0;

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('isLayerPass(k: string) {')) {
                const new_content = content.replace(pattern, new_functions);
                if (new_content !== content) {
                    fs.writeFileSync(fullPath, new_content, 'utf8');
                    count++;
                }
            }
        }
    }
}

walk(directory);
console.log(`Replaced in ${count} files`);
