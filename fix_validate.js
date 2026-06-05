const fs = require('fs');

const fullPath = "C:\\Users\\HP\\Desktop\\iso final\\iso20022generatorfrontend\\src\\app\\pages\\validate\\validate.component.ts";

const new_functions = `  isLayerPass(report: any, k: string) {
    const s = (this.getLayerStatus(report, k) || '').toUpperCase();
    if (!s || s.trim() === '') return false;
    if (s.includes('FAIL') || s.includes('ERROR') || s.includes('❌') || s.includes('?')) return false;
    if (s.includes('WARN') || s.includes('⚠')) return false;
    return s.includes('PASS') || s.includes('SUCCESS') || s.includes('VALID') || s.includes('✔');
  }

  isLayerFail(report: any, k: string) {
    const s = (this.getLayerStatus(report, k) || '').toUpperCase();
    return s.includes('FAIL') || s.includes('ERROR') || s.includes('❌') || s.includes('?');
  }

  isLayerWarn(report: any, k: string) {
    const s = (this.getLayerStatus(report, k) || '').toUpperCase();
    if (s.includes('WARN') || s.includes('⚠')) return true;
    if (s.includes('FAIL') || s.includes('ERROR') || s.includes('❌') || s.includes('?')) return false;
    if (!s || s.trim() === '') return false;
    return false;
  }`;

const pattern = /\s*isLayerPass\(report: any, k: string\) \{[\s\S]*?isLayerWarn\(report: any, k: string\) \{[\s\S]*?\n\s*\}/;

const content = fs.readFileSync(fullPath, 'utf8');
const new_content = content.replace(pattern, "\n" + new_functions);
if (new_content !== content) {
    fs.writeFileSync(fullPath, new_content, 'utf8');
    console.log("Replaced");
} else {
    console.log("No match found");
}
